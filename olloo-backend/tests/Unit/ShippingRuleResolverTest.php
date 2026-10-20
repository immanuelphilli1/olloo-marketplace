<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\ShippingClass;
use App\Models\ShippingRule;
use App\Shipping\ShippingConfigurationException;
use App\Shipping\ShippingQuoteContext;
use App\Shipping\ShippingRuleResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\SeedsCurrencies;
use Tests\TestCase;

final class ShippingRuleResolverTest extends TestCase
{
    use RefreshDatabase;
    use SeedsCurrencies;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedCurrencies();
    }

    private function rule(array $overrides): ShippingRule
    {
        return ShippingRule::query()->create(array_merge([
            'name' => 'Rule',
            'strategy' => ShippingRule::STRATEGY_FLAT,
            'fee_minor' => 2000,
            'currency_code' => 'AED',
            'country' => null,
            'min_subtotal_minor' => null,
            'priority' => 100,
            'is_active' => true,
            'transit_days_min' => 2,
            'transit_days_max' => 4,
        ], $overrides));
    }

    private function context(array $overrides = []): ShippingQuoteContext
    {
        return new ShippingQuoteContext(
            currency: $overrides['currency'] ?? 'AED',
            country: $overrides['country'] ?? null,
            subtotalMinor: $overrides['subtotalMinor'] ?? 0,
            shippingClassId: $overrides['class'] ?? null,
        );
    }

    public function test_threshold_beats_generic_flat(): void
    {
        $this->rule([
            'name' => 'UAE free over 500',
            'strategy' => ShippingRule::STRATEGY_FREE_OVER_THRESHOLD,
            'fee_minor' => 0,
            'country' => 'AE',
            'min_subtotal_minor' => 50000,
            'priority' => 10,
        ]);
        $this->rule([
            'name' => 'UAE flat',
            'country' => 'AE',
            'fee_minor' => 2000,
            'priority' => 20,
        ]);

        $resolver = app(ShippingRuleResolver::class);

        $this->assertSame(
            'UAE free over 500',
            $resolver->resolve($this->context(['country' => 'AE', 'subtotalMinor' => 60000]))->name
        );
        $this->assertSame(
            'UAE flat',
            $resolver->resolve($this->context(['country' => 'AE', 'subtotalMinor' => 40000]))->name
        );
    }

    public function test_priority_wins_over_specificity(): void
    {
        $this->rule(['name' => 'Global flat', 'fee_minor' => 3000, 'priority' => 10]);
        $this->rule(['name' => 'UAE flat', 'country' => 'AE', 'fee_minor' => 2000, 'priority' => 20]);

        $this->assertSame(
            'Global flat',
            app(ShippingRuleResolver::class)->resolve($this->context(['country' => 'AE']))->name
        );
    }

    public function test_currency_must_match_exactly(): void
    {
        $this->rule(['name' => 'USD rule', 'currency_code' => 'USD', 'country' => 'AE', 'priority' => 10]);

        $this->expectException(ShippingConfigurationException::class);

        app(ShippingRuleResolver::class)->resolve($this->context(['country' => 'AE']));
    }

    public function test_country_rule_needs_context_country(): void
    {
        $this->rule(['name' => 'UAE flat', 'country' => 'AE', 'priority' => 10]);
        $this->rule(['name' => 'Global flat', 'priority' => 20]);

        $this->assertSame(
            'Global flat',
            app(ShippingRuleResolver::class)->resolve($this->context())->name
        );
    }

    public function test_classed_items_prefer_their_class_rules_then_fall_back(): void
    {
        $bulky = ShippingClass::query()->create(['name' => 'Bulky']);
        $fragile = ShippingClass::query()->create(['name' => 'Fragile']);
        $this->rule(['name' => 'Standard flat', 'priority' => 10]);
        $this->rule(['name' => 'Bulky flat', 'shipping_class_id' => $bulky->id, 'fee_minor' => 15000, 'priority' => 100]);

        $resolver = app(ShippingRuleResolver::class);

        // A class rule wins for its class even with a worse priority.
        $this->assertSame('Bulky flat', $resolver->resolve($this->context(['class' => $bulky->id]))->name);
        // No rule for the class: open rules apply.
        $this->assertSame('Standard flat', $resolver->resolve($this->context(['class' => $fragile->id]))->name);
        // Standard items never use class rules.
        $this->assertSame('Standard flat', $resolver->resolve($this->context())->name);
    }

    public function test_rule_countries_lists_countries_with_their_own_rules(): void
    {
        $this->rule(['name' => 'UAE flat', 'country' => 'AE']);
        $this->rule(['name' => 'Ghana flat', 'country' => 'GH', 'currency_code' => 'GHS']);
        $this->rule(['name' => 'Global flat']);

        $this->assertEqualsCanonicalizing(['AE', 'GH'], app(ShippingRuleResolver::class)->ruleCountries());
    }

    public function test_no_match_throws(): void
    {
        $this->expectException(ShippingConfigurationException::class);

        app(ShippingRuleResolver::class)->resolve($this->context());
    }

    public function test_inactive_rules_ignored(): void
    {
        $this->rule(['name' => 'Disabled', 'is_active' => false, 'priority' => 10]);

        $this->expectException(ShippingConfigurationException::class);

        app(ShippingRuleResolver::class)->resolve($this->context());
    }
}
