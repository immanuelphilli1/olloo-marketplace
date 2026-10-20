<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Country;
use App\Models\Currency;
use App\Models\Order;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ShippingRule;
use App\Models\TaxRate;
use App\Models\User;
use Database\Seeders\AdminPermissionsSeeder;
use Database\Seeders\CategorySeeder;
use Database\Seeders\ContentSeeder;
use Database\Seeders\CurrencySeeder;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\GeoSeeder;
use Database\Seeders\PaymentMethodSeeder;
use Database\Seeders\ProductionDatabaseSeeder;
use Database\Seeders\ProductSeeder;
use Database\Seeders\SampleOrderSeeder;
use Database\Seeders\ShippingRuleSeeder;
use Database\Seeders\TaxSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * The deploy seeder runs against a live database on every release, so the
 * property that matters is not "does it work once" but "does running it again
 * change anything staff did not intend".
 *
 * Each excluded seeder has a test naming the damage it would do, so putting one
 * back in ProductionDatabaseSeeder fails here instead of in production.
 */
final class ProductionDatabaseSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_seeds_the_catalogs_a_fresh_install_needs(): void
    {
        $this->seed(ProductionDatabaseSeeder::class);

        $this->assertGreaterThan(0, Currency::query()->count());
        $this->assertGreaterThan(0, PaymentMethod::query()->count());
        $this->assertGreaterThan(0, Permission::query()->count());

        // A currency has to name a country, or an unplaceable shopper has none.
        foreach (Currency::query()->get() as $currency) {
            $this->assertNotNull($currency->country_code, "{$currency->code} has no country.");
            $this->assertNotNull($currency->country, "{$currency->code} points at a missing country.");
        }
    }

    public function test_running_it_twice_changes_nothing(): void
    {
        $this->seed(ProductionDatabaseSeeder::class);
        $before = $this->snapshot();

        $this->seed(ProductionDatabaseSeeder::class);

        $this->assertSame($before, $this->snapshot(), 'The deploy seeder must be idempotent.');
    }

    public function test_it_preserves_staff_choices_on_a_live_database(): void
    {
        $this->seed(ProductionDatabaseSeeder::class);

        // What the admin Currencies page lets staff change.
        Currency::query()->where('code', 'GHS')->update(['is_default' => true, 'payment_provider' => 'stripe']);
        Currency::query()->where('code', 'USD')->update(['is_default' => false]);

        // What the admin Payment methods page lets staff change.
        PaymentMethod::query()->where('code', 'usd_cards')->update([
            'label' => 'Visa and Mastercard',
            'sort_order' => 99,
            'is_active' => false,
        ]);

        $this->seed(ProductionDatabaseSeeder::class);

        $ghs = Currency::query()->where('code', 'GHS')->sole();
        $this->assertTrue($ghs->is_default, 'A deploy must not move the default currency back.');
        $this->assertSame('stripe', $ghs->payment_provider, 'A deploy must not revert a provider change.');

        $card = PaymentMethod::query()->where('code', 'usd_cards')->sole();
        $this->assertSame('Visa and Mastercard', $card->label);
        $this->assertSame(99, $card->sort_order);
        $this->assertFalse($card->is_active, 'A deploy must not reactivate a method staff parked.');
    }

    public function test_it_backfills_a_currency_that_predates_the_country_column(): void
    {
        $this->seed(ProductionDatabaseSeeder::class);
        Currency::query()->where('code', 'AED')->update(['country_code' => null]);

        $this->seed(ProductionDatabaseSeeder::class);

        $this->assertSame('AE', Currency::query()->where('code', 'AED')->value('country_code'));
    }

    public function test_it_excludes_seeders_that_would_revert_staff_work(): void
    {
        // These three are not in the deploy seeder, so set them up the way
        // DatabaseSeeder would and confirm a deploy leaves them alone.
        $this->seed([GeoSeeder::class, CurrencySeeder::class, ShippingRuleSeeder::class, TaxSeeder::class, CategorySeeder::class]);
        $this->seed(ProductionDatabaseSeeder::class);

        // ShippingRuleSeeder re-applies fee payloads on every run.
        ShippingRule::query()->where('name', 'Default flat rate')->update(['fee_minor' => 12345]);
        // TaxSeeder re-applies rate payloads on every run.
        TaxRate::query()->where('name', 'UAE VAT')->update(['rate_bp' => 999]);
        // CategorySeeder puts is_active in its payload, so retired rows return.
        Category::query()->where('slug', 'electronics')->update(['is_active' => false]);

        $this->seed(ProductionDatabaseSeeder::class);

        $this->assertSame(12345, (int) ShippingRule::query()->where('name', 'Default flat rate')->value('fee_minor'));
        $this->assertSame(999, (int) TaxRate::query()->where('name', 'UAE VAT')->value('rate_bp'));
        $this->assertFalse((bool) Category::query()->where('slug', 'electronics')->value('is_active'));
    }

    public function test_it_never_reaches_demo_data(): void
    {
        $this->seed(ProductionDatabaseSeeder::class);

        // UserSeeder creates logins with a published password.
        $this->assertSame(0, User::query()->count());
        // ProductSeeder and SampleOrderSeeder are a demo catalogue.
        $this->assertSame(0, Product::query()->count());
        $this->assertSame(0, Order::query()->count());
    }

    /**
     * It must not include the demo seeders by reference or inheritance, which a
     * stray `call(DatabaseSeeder::class)` would do.
     */
    public function test_the_listed_seeders_are_exactly_the_documented_ones(): void
    {
        // Short names: the seeder shares the Database\Seeders namespace, so it
        // references its siblings unqualified.
        $source = (string) file_get_contents(base_path('database/seeders/ProductionDatabaseSeeder.php'));

        foreach ([DatabaseSeeder::class, ProductSeeder::class, UserSeeder::class, SampleOrderSeeder::class, ShippingRuleSeeder::class, TaxSeeder::class, CategorySeeder::class, ContentSeeder::class] as $excluded) {
            $short = substr(strrchr($excluded, '\\') ?: '', 1);
            $this->assertStringNotContainsString(
                $short.'::class,',
                $source,
                "{$short} must stay out of the deploy seeder.",
            );
        }

        foreach ([AdminPermissionsSeeder::class, CurrencySeeder::class, GeoSeeder::class, PaymentMethodSeeder::class] as $included) {
            $short = substr(strrchr($included, '\\') ?: '', 1);
            $this->assertStringContainsString($short.'::class', $source);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function snapshot(): array
    {
        return [
            'currencies' => Currency::query()->orderBy('code')->get()
                ->map(fn (Currency $c): array => [$c->code, $c->name, $c->country_code, $c->payment_provider, $c->decimal_places, $c->is_default])
                ->all(),
            'methods' => PaymentMethod::query()->orderBy('code')->get()
                ->map(fn (PaymentMethod $m): array => [$m->code, $m->label, $m->provider, $m->currencies, $m->countries, $m->sort_order, $m->is_active])
                ->all(),
            'permissions' => Permission::query()->orderBy('name')->pluck('name')->all(),
            'country_count' => Country::query()->count(),
        ];
    }
}
