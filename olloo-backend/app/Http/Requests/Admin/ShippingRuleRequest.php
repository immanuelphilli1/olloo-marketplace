<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use App\Models\ShippingClass;
use App\Models\ShippingRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

abstract class ShippingRuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user('staff');

        return $user !== null && $user->can('manage_shipping_settings');
    }

    /**
     * Money enters in major units (staff type "20.00"); the controller maps
     * to minor units for storage.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'strategy' => ['required', 'string', Rule::in(ShippingRule::STRATEGIES)],
            'fee' => ['required', 'numeric', 'min:0'],
            'currency_code' => ['required', 'string', 'size:3', 'exists:currencies,code'],
            'country' => ['nullable', 'string', 'size:2'],
            'threshold' => ['nullable', 'numeric', 'min:0'],
            'priority' => ['required', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'shipping_class_rid' => ['nullable', 'string', 'exists:shipping_classes,rid'],
            'transit_days_min' => ['required', 'integer', 'min:0', 'max:120'],
            'transit_days_max' => ['required', 'integer', 'min:0', 'max:120', 'gte:transit_days_min'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'transit_days_min.required' => 'Enter the fewest business days the courier takes.',
            'transit_days_max.required' => 'Enter the most business days the courier takes.',
            'transit_days_max.gte' => 'The longest transit time cannot be shorter than the shortest.',
            'shipping_class_rid.exists' => 'That shipping class no longer exists. Pick another, or any class.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function validatedForStorage(): array
    {
        $data = $this->validated();

        return [
            'name' => $data['name'],
            'strategy' => $data['strategy'],
            'fee_minor' => (int) round((float) $data['fee'] * 100),
            'currency_code' => strtoupper((string) $data['currency_code']),
            'country' => is_string($data['country'] ?? null) && $data['country'] !== ''
                ? strtoupper($data['country'])
                : null,
            'min_subtotal_minor' => isset($data['threshold'])
                ? (int) round((float) $data['threshold'] * 100)
                : null,
            'priority' => (int) $data['priority'],
            'is_active' => (bool) ($data['is_active'] ?? true),
            'shipping_class_id' => ! empty($data['shipping_class_rid'])
                ? ShippingClass::query()->where('rid', $data['shipping_class_rid'])->value('id')
                : null,
            'transit_days_min' => (int) $data['transit_days_min'],
            'transit_days_max' => (int) $data['transit_days_max'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $strategy = $this->input('strategy');

            if ($strategy === ShippingRule::STRATEGY_FREE_OVER_THRESHOLD) {
                if ((float) $this->input('fee', 0) !== 0.0) {
                    $validator->errors()->add('fee', 'Free-over-threshold rules must have a zero fee.');
                }
                if ($this->input('threshold') === null) {
                    $validator->errors()->add('threshold', 'Free-over-threshold rules require a subtotal threshold.');
                }
            }

            if ($strategy === ShippingRule::STRATEGY_FLAT && $this->input('threshold') !== null) {
                $validator->errors()->add('threshold', 'Flat rules do not take a subtotal threshold.');
            }
        });
    }
}
