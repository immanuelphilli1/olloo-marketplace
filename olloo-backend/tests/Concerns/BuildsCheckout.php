<?php

declare(strict_types=1);

namespace Tests\Concerns;

use App\Models\Category;
use App\Models\CategoryAttribute;
use App\Models\Country;
use App\Models\Currency;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShippingRule;
use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;

/**
 * Minimal store for checkout tests: USD as the default currency (fake
 * provider), a flat 20.00 shipping rule, UAE as a country, and one product.
 *
 * The product is priced in the default currency, so a test that changes the
 * default must convert or it will be quoting a product it has no rate for.
 */
trait BuildsCheckout
{
    protected function seedCatalog(?int $stock = null, int $priceMinor = 17900): Product
    {
        // All three currencies we sell in, because tests build shipping rules and
        // payment methods in AED and GHS as well as the default. updateOrCreate,
        // not firstOrCreate: the base-currency migration already inserted USD
        // with the production provider (stripe) and firstOrCreate would leave it
        // there, so checkout would try to reach Stripe in tests.
        foreach ([['USD', 'US', true], ['AED', 'AE', false], ['GHS', 'GH', false]] as [$code, $country, $isDefault]) {
            Currency::query()->updateOrCreate(
                ['code' => $code],
                [
                    'name' => $code === 'USD' ? 'US Dollar' : $code,
                    // The market each currency belongs to, which is where an
                    // unplaceable shopper lands. Same as CurrencySeeder.
                    'country_code' => $country,
                    // The fake provider throws in production, which is what we
                    // want here: no test can reach a real gateway by accident.
                    'payment_provider' => 'fake',
                    'is_default' => $isDefault,
                ],
            );
        }

        Country::query()->firstOrCreate(['code' => 'AE'], ['name' => 'United Arab Emirates', 'phone_code' => '+971', 'currency_code' => 'AED']);
        Country::query()->firstOrCreate(['code' => 'US'], ['name' => 'United States', 'phone_code' => '+1', 'currency_code' => 'USD']);
        Country::query()->firstOrCreate(['code' => 'GH'], ['name' => 'Ghana', 'phone_code' => '+233', 'currency_code' => 'GHS']);

        if (! ShippingRule::query()->exists()) {
            ShippingRule::query()->create([
                'name' => 'Default flat rate',
                'strategy' => ShippingRule::STRATEGY_FLAT,
                'fee_minor' => 2000,
                'currency_code' => 'USD',
                'country' => null,
                'min_subtotal_minor' => null,
                'priority' => 100,
                'is_active' => true,
                'transit_days_min' => 2,
                'transit_days_max' => 4,
            ]);
        }

        $category = Category::query()->firstOrCreate(['slug' => 'electronics'], ['label' => 'Electronics', 'is_active' => true]);

        $slug = 'aerosmart-earbuds'.(Product::query()->exists() ? '-'.Str::lower(Str::random(4)) : '');
        $product = Product::query()->create([
            'slug' => $slug,
            'category_id' => $category->id,
            'name' => 'AeroSmart Wireless Earbuds',
            'image' => '/images/p.jpg',
            'price_minor' => $priceMinor,
            'original_price_minor' => 21900,
            'currency_code' => 'USD',
            'rating' => 4.7,
            'is_featured' => true,
            'is_new_arrival' => true,
            'is_active' => true,
        ]);

        $this->defineAttribute($category, 'brand', 'Brand');
        $this->defineAttribute($category, 'color', 'Color');
        $product->syncAttributes(['brand' => 'Sony', 'color' => 'Black']);

        ProductVariant::query()->create([
            'product_id' => $product->id,
            'name' => 'Standard',
            'sku' => Str::upper($slug).'-STD',
            'stock_quantity' => $stock,
            'is_default' => true,
        ]);

        return $product;
    }

    /**
     * @param  list<string>|null  $options
     */
    protected function defineAttribute(Category $category, string $key, string $label, ?array $options = null): CategoryAttribute
    {
        return CategoryAttribute::query()->updateOrCreate(
            ['category_id' => $category->id, 'key' => $key],
            ['label' => $label, 'options' => $options],
        );
    }

    protected function defaultVariant(Product $product): ProductVariant
    {
        return $product->variants()->where('is_default', true)->firstOrFail();
    }

    /**
     * @return array{0: User, 1: string}
     */
    protected function customer(): array
    {
        $user = User::factory()->create();

        return [$user, $user->createToken('access')->plainTextToken];
    }

    protected function createAddress(string $token, string $country = 'AE'): string
    {
        return (string) $this->withToken($token)->postJson('/api/v1/addresses', [
            'country' => $country,
            'firstName' => 'Demo',
            'lastName' => 'User',
            'phoneCountryCode' => '+971',
            'phoneNumber' => '501234567',
            'addressLine' => 'Street 1',
            'region' => 'Dubai',
            'city' => 'Dubai',
            'isDefault' => true,
        ])->assertCreated()->json('rid');
    }

    protected function addToCart(string $token, Product $product, int $quantity = 1): TestResponse
    {
        return $this->withToken($token)->postJson('/api/v1/cart/items', [
            'productId' => $product->rid,
            'quantity' => $quantity,
        ]);
    }

    /**
     * @param  list<string>|null  $cartItemIds  defaults to every line in the cart
     */
    protected function placeOrder(string $token, string $addressRid, ?array $cartItemIds = null, ?string $key = null): TestResponse
    {
        $cartItemIds ??= $this->withToken($token)->getJson('/api/v1/cart')->json('items.*.rid');

        return $this->withToken($token)
            ->withHeader('Idempotency-Key', $key ?? (string) Str::uuid())
            ->postJson('/api/v1/orders', [
                'addressId' => $addressRid,
                'cartItemIds' => $cartItemIds,
            ]);
    }

    protected function paymentIntent(string $token, string $orderRid, ?string $key = null): TestResponse
    {
        return $this->withToken($token)
            ->withHeader('Idempotency-Key', $key ?? (string) Str::uuid())
            ->postJson('/api/v1/checkout/payment-intent', ['orderId' => $orderRid]);
    }
}
