<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreShippingRuleRequest;
use App\Http\Requests\Admin\UpdateShippingRuleRequest;
use App\Models\Currency;
use App\Models\ShippingClass;
use App\Models\ShippingRule;
use App\Shipping\ShippingConfigurationException;
use App\Shipping\ShippingQuoteContext;
use App\Shipping\ShippingRuleResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class ShippingRuleController extends Controller
{
    public function __construct(
        private readonly ShippingRuleResolver $resolver,
    ) {}

    public function index(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('manage_shipping_settings'), 403);

        $rules = ShippingRule::query()
            ->with('shippingClass:id,rid,name')
            ->orderBy('priority')
            ->orderBy('id')
            ->paginate((int) config('admin.per_page'))
            ->through(fn (ShippingRule $rule) => $this->serialize($rule));

        return Inertia::render('Admin/Settings/Shipping/Index', [
            'rules' => $rules,
            'currencies' => $this->currencyOptions(),
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('manage_shipping_settings'), 403);

        return Inertia::render('Admin/Settings/Shipping/Create', [
            'strategies' => ShippingRule::STRATEGIES,
            'currencies' => $this->currencyOptions(),
            'shippingClasses' => $this->shippingClassOptions(),
        ]);
    }

    public function store(StoreShippingRuleRequest $request): RedirectResponse
    {
        ShippingRule::query()->create($request->validatedForStorage());

        return redirect()->route('admin.shipping-rules.index')
            ->with('success', 'Shipping rule created.');
    }

    public function edit(Request $request, ShippingRule $shippingRule): Response
    {
        abort_unless($request->user('staff')?->can('manage_shipping_settings'), 403);

        return Inertia::render('Admin/Settings/Shipping/Edit', [
            'rule' => $this->serialize($shippingRule),
            'strategies' => ShippingRule::STRATEGIES,
            'currencies' => $this->currencyOptions(),
            'shippingClasses' => $this->shippingClassOptions(),
        ]);
    }

    public function update(UpdateShippingRuleRequest $request, ShippingRule $shippingRule): RedirectResponse
    {
        $shippingRule->update($request->validatedForStorage());

        return redirect()->route('admin.shipping-rules.index')
            ->with('success', 'Shipping rule updated.');
    }

    public function destroy(Request $request, ShippingRule $shippingRule): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('manage_shipping_settings'), 403);

        if ($this->isLastActiveRule($shippingRule)) {
            return redirect()->back()->withErrors([
                'rule' => 'Cannot delete the final active rule. Deactivate it only if another active rule exists.',
            ]);
        }

        $shippingRule->delete();

        return redirect()->route('admin.shipping-rules.index')
            ->with('success', 'Shipping rule deleted.');
    }

    public function toggle(Request $request, ShippingRule $shippingRule): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('manage_shipping_settings'), 403);

        if ($shippingRule->is_active && $this->isLastActiveRule($shippingRule)) {
            return redirect()->back()->withErrors([
                'rule' => 'Cannot deactivate the final active rule.',
            ]);
        }

        $shippingRule->update(['is_active' => ! $shippingRule->is_active]);

        return redirect()->route('admin.shipping-rules.index')
            ->with('success', 'Shipping rule updated.');
    }

    public function testQuote(Request $request): JsonResponse
    {
        abort_unless($request->user('staff')?->can('manage_shipping_settings'), 403);

        $data = $request->validate([
            'country' => ['nullable', 'string', 'size:2'],
            'currency' => ['required', 'string', 'size:3', 'exists:currencies,code'],
            'subtotal' => ['required', 'numeric', 'min:0'],
            'shipping_class_rid' => ['nullable', 'string', 'exists:shipping_classes,rid'],
        ]);

        $context = new ShippingQuoteContext(
            currency: strtoupper($data['currency']),
            country: is_string($data['country'] ?? null) && $data['country'] !== ''
                ? strtoupper($data['country'])
                : null,
            subtotalMinor: (int) round((float) $data['subtotal'] * 100),
            shippingClassId: ! empty($data['shipping_class_rid'])
                ? ShippingClass::query()->where('rid', $data['shipping_class_rid'])->value('id')
                : null,
        );

        try {
            $rule = $this->resolver->resolve($context);
        } catch (ShippingConfigurationException) {
            return response()->json([
                'matchedRule' => null,
                'checks' => $this->failedChecks($context),
                'fee' => null,
                'currency' => $context->currency,
            ]);
        }

        return response()->json([
            'matchedRule' => ['rid' => $rule->rid, 'name' => $rule->name],
            'checks' => $this->passedChecks($rule, $context),
            'fee' => number_format($rule->effectiveFeeMinor() / 100, 2, '.', ''),
            'currency' => $rule->currency_code,
            'transitDays' => ['min' => (int) $rule->transit_days_min, 'max' => (int) $rule->transit_days_max],
        ]);
    }

    private function isLastActiveRule(ShippingRule $rule): bool
    {
        if (! $rule->is_active) {
            return false;
        }

        return ! ShippingRule::query()
            ->where('is_active', true)
            ->where('id', '!=', $rule->id)
            ->exists();
    }

    /**
     * @return array{rid: string, name: string, strategy: string, fee: string, feeMajor: float, currency: string, country: ?string, threshold: ?string, thresholdMajor: ?float, priority: int, isActive: bool}
     */
    private function serialize(ShippingRule $rule): array
    {
        $feeMinor = $rule->effectiveFeeMinor();

        return [
            'rid' => $rule->rid,
            'name' => $rule->name,
            'strategy' => $rule->strategy,
            'fee' => $rule->currency_code.' '.number_format($feeMinor / 100, 2, '.', ''),
            'feeMajor' => round($feeMinor / 100, 2),
            'currency' => $rule->currency_code,
            'country' => $rule->country,
            'threshold' => $rule->min_subtotal_minor !== null
                ? $rule->currency_code.' '.number_format($rule->min_subtotal_minor / 100, 2, '.', '')
                : null,
            'thresholdMajor' => $rule->min_subtotal_minor !== null
                ? round($rule->min_subtotal_minor / 100, 2)
                : null,
            'priority' => (int) $rule->priority,
            'isActive' => (bool) $rule->is_active,
            'shippingClassRid' => $rule->shippingClass?->rid,
            'shippingClassName' => $rule->shippingClass?->name,
            'transitDaysMin' => (int) $rule->transit_days_min,
            'transitDaysMax' => (int) $rule->transit_days_max,
        ];
    }

    /**
     * @return list<array{rid: string, name: string}>
     */
    private function shippingClassOptions(): array
    {
        return ShippingClass::query()->orderBy('name')->get(['rid', 'name'])->map->only(['rid', 'name'])->values()->all();
    }

    /**
     * @return list<string>
     */
    private function currencyOptions(): array
    {
        return Currency::query()->orderBy('code')->pluck('code')->all();
    }

    /**
     * @return list<array{label: string, passed: bool}>
     */
    private function passedChecks(ShippingRule $rule, ShippingQuoteContext $context): array
    {
        return [
            ['label' => 'Active', 'passed' => true],
            ['label' => 'Currency matches ('.$context->currency.')', 'passed' => true],
            [
                'label' => $rule->country === null
                    ? 'No country restriction'
                    : 'Country matches ('.$rule->country.')',
                'passed' => true,
            ],
            [
                'label' => $rule->min_subtotal_minor === null
                    ? 'No subtotal threshold'
                    : 'Subtotal meets threshold',
                'passed' => true,
            ],
        ];
    }

    /**
     * @return list<array{label: string, passed: bool}>
     */
    private function failedChecks(ShippingQuoteContext $context): array
    {
        $scoped = ShippingRule::query()
            ->where('is_active', true)
            ->where('currency_code', $context->currency);

        $checks = [];
        $checks[] = [
            'label' => 'At least one active rule',
            'passed' => ShippingRule::query()->where('is_active', true)->exists(),
        ];
        $checks[] = [
            'label' => 'Currency matches ('.$context->currency.')',
            'passed' => (clone $scoped)->exists(),
        ];

        if (! $checks[1]['passed']) {
            $checks[] = ['label' => 'Country matches', 'passed' => false];
            $checks[] = ['label' => 'Subtotal meets threshold', 'passed' => false];

            return $checks;
        }

        $countryOk = (clone $scoped)->where(function ($query) use ($context): void {
            $query->whereNull('country');
            if ($context->country !== null) {
                $query->orWhere('country', $context->country);
            }
        })->exists();

        $checks[] = [
            'label' => $context->country === null
                ? 'Country-agnostic rule available'
                : 'Country matches ('.$context->country.')',
            'passed' => $countryOk,
        ];
        $checks[] = [
            'label' => 'Subtotal meets a threshold',
            'passed' => (clone $scoped)->where(function ($query) use ($context): void {
                $query->whereNull('min_subtotal_minor')
                    ->orWhere('min_subtotal_minor', '<=', $context->subtotalMinor);
            })->exists(),
        ];

        return $checks;
    }
}
