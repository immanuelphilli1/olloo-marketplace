<?php

declare(strict_types=1);

namespace App\Shipping;

use App\Currency\CurrencyConverter;
use App\Models\ShippingRule;
use Illuminate\Support\Facades\Cache;

/**
 * Matches a shipping rule for a quote context. Matching only; fee and
 * delivery math live in ShippingService.
 *
 * Eligibility: active AND (rule country null OR context country set and
 * equal) AND (no threshold OR subtotal satisfies it). Rules in the context
 * currency are tried first, then rules in other currencies, whose threshold
 * is checked against the subtotal converted back at the shopper rate (a rule
 * with no usable rate is skipped). Within each, priority ASC, id ASC.
 *
 * Shipping classes: for a classed item, rules for that class are tried first;
 * if none match, rules without a class apply. Standard items (no class) only
 * use rules without a class.
 */
final class ShippingRuleResolver
{
    public const CACHE_KEY = 'shipping.rules.v2';

    public function __construct(
        private readonly CurrencyConverter $fx,
    ) {}

    public function resolve(ShippingQuoteContext $context): ShippingRule
    {
        $rules = $this->activeRulesOrdered();
        $passes = $context->shippingClassId !== null ? [$context->shippingClassId, null] : [null];

        foreach ($passes as $classId) {
            foreach ([true, false] as $sameCurrency) {
                foreach ($rules as $rule) {
                    if ($rule->shipping_class_id === $classId
                        && ($rule->currency_code === $context->currency) === $sameCurrency
                        && $this->matches($rule, $context)) {
                        return $rule;
                    }
                }
            }
        }

        throw new ShippingConfigurationException(
            'No active shipping rule matches this quote.'
        );
    }

    public function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * @return list<ShippingRule>
     */
    private function activeRulesOrdered(): array
    {
        /** @var list<ShippingRule> */
        return Cache::rememberForever(self::CACHE_KEY, static function (): array {
            return ShippingRule::query()
                ->where('is_active', true)
                ->orderBy('priority')
                ->orderBy('id')
                ->get()
                ->all();
        });
    }

    /**
     * Countries that have their own rules. Any other destination is quoted
     * with the rules that have no country.
     *
     * @return list<string>
     */
    public function ruleCountries(): array
    {
        return collect($this->activeRulesOrdered())->pluck('country')->filter()->unique()->values()->all();
    }

    private function matches(ShippingRule $rule, ShippingQuoteContext $context): bool
    {
        if ($rule->currency_code !== $context->currency && ! $this->fx->canConvert($rule->currency_code, $context->currency)) {
            return false;
        }

        if ($rule->country !== null
            && ($context->country === null || $rule->country !== $context->country)) {
            return false;
        }

        if ($rule->min_subtotal_minor !== null
            && $this->fx->convertBack($context->subtotalMinor, $rule->currency_code, $context->currency) < $rule->min_subtotal_minor) {
            return false;
        }

        return true;
    }
}
