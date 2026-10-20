<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use Database\Seeders\PaymentMethodSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Symfony\Component\Yaml\Yaml;
use Tests\Concerns\BuildsCheckout;
use Tests\TestCase;

/**
 * Contract parity: every field the OpenAPI spec marks required for a live
 * response must actually be present on the wire. docs/openapi.yaml is the
 * contract, so this fails when code and spec drift apart.
 */
final class ContractSchemaTest extends TestCase
{
    use BuildsCheckout;
    use RefreshDatabase;

    /** @var array<string, mixed>|null */
    private static ?array $spec = null;

    public function test_product_listing_matches_the_documented_required_fields(): void
    {
        $this->seedCatalog();

        $listing = $this->getJson('/api/v1/products?country=AE')->assertOk()->json();
        $this->assertDocumented($listing, '#/components/schemas/ProductListing');
        $this->assertDocumented($listing['items'][0], '#/components/schemas/ProductCard');

        $featured = $this->getJson('/api/v1/products/featured')->assertOk()->json();
        $this->assertDocumented($featured['items'][0], '#/components/schemas/ProductCard');
    }

    public function test_product_detail_matches_the_documented_required_fields(): void
    {
        $product = $this->seedCatalog();

        $detail = $this->getJson('/api/v1/products/'.$product->rid.'?country=AE')->assertOk()->json();
        $this->assertDocumented($detail, '#/paths/~1v1~1products~1{product}/get/responses/200/content/application~1json/schema');
        $this->assertDocumented($detail['product'], '#/components/schemas/ProductCard');
        $this->assertDocumented($detail['variants'][0], '#/components/schemas/ProductVariant');
    }

    public function test_cart_and_checkout_match_the_documented_required_fields(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();

        $cart = $this->withToken($token)->getJson('/api/v1/cart')->assertOk()->json();
        $this->assertDocumented($cart, '#/components/schemas/Cart');
        $this->assertDocumented($cart['items'][0], '#/components/schemas/CartItem');
        $this->assertDocumented($cart['summary'], '#/components/schemas/CartSummary');

        $preview = $this->withToken($token)->getJson('/api/v1/checkout/preview')->assertOk()->json();
        $this->assertDocumented(
            $preview,
            '#/paths/~1v1~1checkout~1preview/get/responses/200/content/application~1json/schema'
        );
    }

    public function test_order_list_and_detail_match_the_documented_required_fields(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();
        $this->addToCart($token, $product)->assertOk();
        $this->placeOrder($token, $this->createAddress($token))->assertCreated();

        $orders = $this->withToken($token)->getJson('/api/v1/orders')->assertOk()->json();
        $this->assertDocumented($orders['orders'][0], '#/components/schemas/OrderRecord');

        $detail = $this->withToken($token)->getJson('/api/v1/orders/'.$orders['orders'][0]['rid'])->assertOk()->json();
        $this->assertDocumented($detail, '#/components/schemas/OrderDetail');
        $this->assertDocumented($detail['shipping'], '#/components/schemas/OrderShippingSnapshot');
    }

    public function test_geo_and_payment_method_payloads_match_the_documented_required_fields(): void
    {
        $this->seedCatalog();
        $this->seed(PaymentMethodSeeder::class);

        $this->assertDocumented(
            $this->getJson('/api/v1/addresses/lookup/countries')->assertOk()->json()['countries'][0],
            '#/paths/~1v1~1addresses~1lookup~1countries/get/responses/200/content/application~1json/schema/properties/countries/items'
        );

        $methods = $this->getJson('/api/v1/payment-methods/checkout')->assertOk()->json()['paymentMethods'];
        $this->assertNotEmpty($methods, 'Payment methods must be seeded for this assertion.');
        $this->assertDocumented($methods[0], '#/components/schemas/CheckoutMethod');
    }

    public function test_locale_matches_the_documented_required_fields(): void
    {
        $this->seedCatalog();

        $locale = $this->getJson('/api/v1/locale?country=AE')->assertOk()->json();
        $this->assertDocumented($locale, '#/components/schemas/Locale');
        $this->assertDocumented($locale['country'], '#/components/schemas/Locale/properties/country');
        $this->assertDocumented($locale['currency'], '#/components/schemas/Locale/properties/currency');

        // The route must actually hand back the shared schema, or a client
        // following the spec would find nothing to validate against.
        $this->assertSame(
            '#/components/schemas/Locale',
            $this->resolve('#/paths/~1v1~1locale/get/responses/200/content/application~1json/schema')['$ref']
        );
    }

    public function test_setting_a_preferred_country_returns_the_documented_locale(): void
    {
        $this->seedCatalog();
        [, $token] = $this->customer();

        $locale = $this->withToken($token)
            ->putJson('/api/v1/users/me/country', ['preferredCountry' => 'AE'])
            ->assertOk()
            ->assertJsonPath('countrySource', 'preferred')
            ->json();

        $this->assertDocumented($locale, '#/components/schemas/Locale');
        $this->assertDocumented($locale['country'], '#/components/schemas/Locale/properties/country');
        $this->assertDocumented($locale['currency'], '#/components/schemas/Locale/properties/currency');
    }

    /**
     * Assert every documented required field of a schema pointer is a key on the payload.
     *
     * @param  array<string, mixed>  $payload
     */
    private function assertDocumented(array $payload, string $pointer): void
    {
        $schema = $this->resolve($pointer);
        $required = $schema['required'] ?? [];

        $missing = array_values(array_diff($required, array_keys($payload)));

        $this->assertSame([], $missing, "Missing documented fields for {$pointer}: ".implode(', ', $missing));
    }

    /**
     * Resolve a local JSON pointer, merging allOf branches so composed schemas
     * (OrderDetail, ReviewedReview) contribute their required fields.
     *
     * @return array<string, mixed>
     */
    private function resolve(string $pointer): array
    {
        self::$spec ??= Yaml::parseFile(base_path('docs/openapi.yaml'));

        $node = self::$spec;
        foreach (explode('/', ltrim($pointer, '#/')) as $segment) {
            $segment = str_replace(['~1', '~0'], ['/', '~'], $segment);
            $this->assertIsArray($node, "Pointer {$pointer} does not resolve.");
            $this->assertArrayHasKey($segment, $node, "Pointer {$pointer} has no {$segment}.");
            $node = $node[$segment];
        }

        $this->assertIsArray($node, "Pointer {$pointer} is not an object schema.");

        $required = $node['required'] ?? [];
        foreach ($node['allOf'] ?? [] as $branch) {
            $required = [...$required, ...($branch['required'] ?? [])];

            if (isset($branch['$ref'])) {
                $required = [...$required, ...($this->resolve('#'.$branch['$ref'])['required'] ?? [])];
            }
        }

        return [...$node, 'required' => array_values(array_unique($required))];
    }
}
