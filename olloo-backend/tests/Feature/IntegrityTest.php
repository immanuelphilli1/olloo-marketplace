<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\OrderPaymentStatus;
use App\Enums\OrderStatus;
use App\Models\Country;
use App\Models\Currency;
use App\Models\Order;
use App\Models\Product;
use App\Models\Review;
use App\Models\SavedPaymentMethod;
use App\Models\Tag;
use App\Models\User;
use Database\Seeders\AdminPermissionsSeeder;
use Database\Seeders\CurrencySeeder;
use Database\Seeders\GeoSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\BuildsCheckout;
use Tests\TestCase;

final class IntegrityTest extends TestCase
{
    use BuildsCheckout;
    use RefreshDatabase;

    /**
     * Every currency we sell in needs its market, and unplaceable shoppers land
     * in the default currency's market.
     *
     * Without this, `ShopperLocale` silently answered `country: null` on a fresh
     * install, which reads as "no delivery claims, no tax" rather than as a bug.
     */
    public function test_every_seeded_currency_names_a_country_that_exists(): void
    {
        $this->seed(GeoSeeder::class);
        $this->seed(CurrencySeeder::class);

        $currencies = Currency::query()->orderBy('code')->get();
        $this->assertNotEmpty($currencies);

        foreach ($currencies as $currency) {
            $this->assertNotNull(
                $currency->country_code,
                "Currency {$currency->code} has no country_code, so a shopper we cannot place has nowhere to go.",
            );

            $this->assertNotNull(
                $currency->country,
                "Currency {$currency->code} points at country {$currency->country_code}, which does not exist. Run countries:sync.",
            );
        }

        // Exactly one default: the one ShopperLocale prices in and falls back to.
        $defaults = Currency::query()->where('is_default', true)->get();
        $this->assertCount(1, $defaults);
        $this->assertNotNull($defaults->first()->country);
    }

    public function test_mfa_secrets_and_payment_tokens_are_encrypted_at_rest(): void
    {
        $user = User::factory()->create(['two_factor_secret' => 'JBSWY3DPEHPK3PXP']);
        $method = SavedPaymentMethod::query()->create([
            'user_id' => $user->id,
            'type' => 'card',
            'cardholder_name' => 'A B',
            'masked_detail' => '**** 4242',
            'provider_token' => 'pm_secret_123',
        ]);

        $this->assertNotSame('JBSWY3DPEHPK3PXP', DB::table('users')->where('id', $user->id)->value('two_factor_secret'));
        $this->assertNotSame('pm_secret_123', DB::table('saved_payment_methods')->where('id', $method->id)->value('provider_token'));
        $this->assertSame('JBSWY3DPEHPK3PXP', $user->fresh()->two_factor_secret);
        $this->assertSame('pm_secret_123', $method->fresh()->provider_token);
    }

    public function test_tags_keep_their_order_and_the_first_is_the_badge(): void
    {
        $product = $this->seedCatalog();
        $ids = collect(['Zebra', 'Alpha', 'Mid'])->map(fn (string $name) => Tag::query()->create(['name' => $name, 'slug' => strtolower($name)])->id)->all();

        $product->syncTagsInOrder($ids);

        $this->assertSame(['Zebra', 'Alpha', 'Mid'], $product->tags()->pluck('name')->all());
        $this->getJson('/api/v1/products')->assertJsonPath('items.0.tags', ['Zebra', 'Alpha', 'Mid']);
    }

    public function test_rating_and_review_count_follow_approved_reviews(): void
    {
        $product = $this->seedCatalog();
        $product->update(['rating' => 4.9, 'review_count' => 500]);

        $first = Review::query()->create(['product_id' => $product->id, 'rating' => 5, 'is_approved' => false]);
        $this->assertSame(0, $product->refresh()->review_count);

        $first->update(['is_approved' => true]);
        Review::query()->create(['product_id' => $product->id, 'rating' => 2, 'is_approved' => true]);
        $product->refresh();
        $this->assertSame(2, $product->review_count);
        $this->assertSame('3.50', (string) $product->rating);

        $first->delete();
        $this->assertSame(1, $product->refresh()->review_count);
    }

    public function test_sold_count_follows_paid_orders_and_cancellations(): void
    {
        Queue::fake();
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product, 3)->assertOk();
        $order = Order::query()->where('rid', $this->placeOrder($token, $this->createAddress($token))->json('orderId'))->firstOrFail();

        $this->assertSame(0, $product->refresh()->sold_count);

        $order->update(['payment_status' => OrderPaymentStatus::Paid, 'status' => OrderStatus::Processing]);
        $this->assertSame(3, $product->refresh()->sold_count);

        $order->update(['status' => OrderStatus::Cancelled]);
        $this->assertSame(0, $product->refresh()->sold_count);
    }

    public function test_recount_command_rebuilds_stats(): void
    {
        $product = $this->seedCatalog();
        Product::query()->whereKey($product->id)->update(['rating' => 4.7, 'review_count' => 128, 'sold_count' => 940]);

        $this->artisan('catalog:recount')->assertSuccessful();

        $product->refresh();
        $this->assertSame(0, $product->review_count);
        $this->assertSame(0, $product->sold_count);
    }

    public function test_unknown_currency_codes_are_rejected_by_the_database(): void
    {
        $product = $this->seedCatalog();

        $this->expectException(QueryException::class);
        DB::table('products')->where('id', $product->id)->update(['currency_code' => 'XXX']);
    }

    public function test_status_changes_record_shipped_and_delivered_dates(): void
    {
        Queue::fake();
        config(['admin.mfa_forced' => false]);
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $order = Order::query()->where('rid', $this->placeOrder($token, $this->createAddress($token))->json('orderId'))->firstOrFail();
        $order->update(['payment_status' => OrderPaymentStatus::Paid, 'status' => OrderStatus::Processing]);

        $this->seed(AdminPermissionsSeeder::class);
        $staff = User::query()->create([
            'name' => 'Admin', 'email' => 'admin-dates@handco.test', 'password' => 'password', 'user_type' => 'staff',
            'email_verified_at' => now(), 'must_change_password' => false, 'two_factor_enabled' => false,
        ])->syncPermissions(AdminPermissionsSeeder::PERMISSIONS);
        $prefix = '/'.trim((string) config('admin.path_prefix'), '/');

        $this->actingAs($staff, 'staff')->put($prefix.'/orders/'.$order->rid.'/status', ['status' => 'shipped']);
        $this->assertNotNull($order->refresh()->shipped_at);
        $this->assertNull($order->delivered_at);

        $this->travel(2)->days();
        $this->actingAs($staff, 'staff')->put($prefix.'/orders/'.$order->rid.'/status', ['status' => 'delivered']);
        $order->refresh();
        $this->assertTrue($order->delivered_at->greaterThan($order->shipped_at));
    }
}
