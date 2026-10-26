<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Enums\OrderPaymentStatus;
use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Product;
use App\Models\Review;
use App\Models\User;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\BuildsCheckout;
use Tests\TestCase;

final class ReviewsAndFamiliesTest extends TestCase
{
    use BuildsCheckout;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    public function test_unreviewed_products_show_five_stars_and_reviewed_ones_their_average(): void
    {
        $product = $this->seedCatalog();
        $product->update(['rating' => 0, 'review_count' => 0]);

        $this->getJson('/api/v1/products/'.$product->rid)
            ->assertOk()
            ->assertJsonPath('ratingValue', 5)
            ->assertJsonPath('reviewCount', 0)
            ->assertJsonPath('product.ratingValue', 5);

        Review::query()->create(['product_id' => $product->id, 'rating' => 3, 'is_approved' => true]);

        $this->getJson('/api/v1/products/'.$product->rid)
            ->assertJsonPath('ratingValue', 3)
            ->assertJsonPath('reviewCount', 1);
    }

    public function test_a_paid_order_opens_reviews_before_it_is_delivered(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $orderRid = $this->placeOrder($token, $this->createAddress($token))->json('orderId');

        // Unpaid: nothing to review yet.
        $this->withToken($token)->getJson('/api/v1/reviews/waiting')->assertJsonCount(0, 'items');

        Order::query()->where('rid', $orderRid)->update([
            'status' => OrderStatus::Processing->value,
            'payment_status' => OrderPaymentStatus::Paid->value,
        ]);

        $lineRid = $this->withToken($token)->getJson('/api/v1/reviews/waiting')
            ->assertJsonCount(1, 'items')
            ->json('items.0.rid');

        $this->withToken($token)->postJson('/api/v1/reviews', ['reviewId' => $lineRid, 'rating' => 4, 'title' => 'Good'])
            ->assertCreated();
    }

    public function test_a_cancelled_order_cannot_be_reviewed(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $orderRid = $this->placeOrder($token, $this->createAddress($token))->json('orderId');
        Order::query()->where('rid', $orderRid)->update([
            'status' => OrderStatus::Cancelled->value,
            'payment_status' => OrderPaymentStatus::Paid->value,
        ]);

        $this->withToken($token)->getJson('/api/v1/reviews/waiting')->assertJsonCount(0, 'items');
    }

    public function test_the_author_sees_their_pending_review_on_the_product_page(): void
    {
        $product = $this->seedCatalog();
        [$user, $token] = $this->customer();
        Review::query()->create([
            'product_id' => $product->id,
            'user_id' => $user->id,
            'rating' => 5,
            'title' => 'Love it',
            'body' => 'Great sound.',
            'author_display' => 'Ama',
            'is_approved' => false,
        ]);

        $this->withToken($token)->getJson('/api/v1/products/'.$product->rid.'/reviews')
            ->assertOk()
            ->assertJsonCount(0, 'reviews')
            ->assertJsonPath('myReview.status', 'pending')
            ->assertJsonPath('myReview.title', 'Love it');

        // Nobody else sees an unapproved review. withToken() persists for the
        // whole test and the guard caches its user, so both are reset.
        $this->flushHeaders();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/products/'.$product->rid.'/reviews')
            ->assertJsonPath('myReview', null);
    }

    public function test_products_in_a_family_are_offered_as_options_in_natural_order(): void
    {
        $small = $this->seedCatalog(priceMinor: 150000);
        $large = $this->seedCatalog(priceMinor: 320000);
        $medium = $this->seedCatalog(priceMinor: 210000);
        $small->update(['family_key' => 'tcl-p635-tv', 'family_option_name' => 'Size', 'family_option_value' => '32 inch']);
        $large->update(['family_key' => 'tcl-p635-tv', 'family_option_name' => 'Size', 'family_option_value' => '55 inch']);
        $medium->update(['family_key' => 'tcl-p635-tv', 'family_option_name' => 'Size', 'family_option_value' => '43 inch']);

        $response = $this->getJson('/api/v1/products/'.$medium->rid)->assertOk();

        $response->assertJsonPath('family.optionName', 'Size');
        $this->assertSame(['32 inch', '43 inch', '55 inch'], array_column($response->json('family.options'), 'value'));
        $this->assertSame([false, true, false], array_column($response->json('family.options'), 'isCurrent'));
        $response->assertJsonPath('family.options.2.priceMoney', ['amount' => 3200, 'currency' => 'USD']);

        // Hidden products drop out, and a lone product shows no selector.
        $large->update(['is_active' => false]);
        $small->update(['is_active' => false]);
        $this->getJson('/api/v1/products/'.$medium->rid)->assertJsonPath('family', null);
    }

    public function test_admin_slugs_the_family_key_and_refuses_a_repeated_option(): void
    {
        config(['admin.mfa_forced' => false, 'inertia.testing.ensure_pages_exist' => false]);
        $first = $this->seedCatalog();
        $second = $this->seedCatalog();
        $first->update(['family_key' => 'tcl-p635-tv', 'family_option_name' => 'Size', 'family_option_value' => '32 inch']);

        $this->seed(AdminPermissionsSeeder::class);
        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-family@example.com',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ]);
        $staff->syncPermissions(AdminPermissionsSeeder::PERMISSIONS);
        $prefix = trim((string) config('admin.path_prefix'), '/');
        $variant = $this->defaultVariant($second);
        $payload = fn (string $option): array => [
            'name' => $second->name,
            'slug' => $second->slug,
            'category_rid' => $second->category->rid,
            'tags' => [],
            'price' => '179.00',
            'is_active' => true,
            'is_featured' => false,
            'is_new_arrival' => false,
            'variants' => [['rid' => $variant->rid, 'name' => 'Standard', 'sku' => $variant->sku, 'price' => null, 'track_stock' => false, 'stock_quantity' => null, 'is_default' => true]],
            'family_key' => 'TCL P635 TV',
            'family_option_name' => 'Size',
            'family_option_value' => $option,
        ];

        $this->actingAs($staff, 'staff')->put('/'.$prefix.'/products/'.$second->rid, $payload('32 Inch'))
            ->assertSessionHasErrors('family_option_value');

        $this->actingAs($staff, 'staff')->put('/'.$prefix.'/products/'.$second->rid, $payload('43 inch'))
            ->assertSessionHasNoErrors();

        $this->assertSame('tcl-p635-tv', Product::query()->find($second->id)->family_key);
    }
}
