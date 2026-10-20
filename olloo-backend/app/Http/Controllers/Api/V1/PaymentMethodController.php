<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Currency\ShopperLocale;
use App\Http\Controllers\Controller;
use App\Models\Country;
use App\Models\PaymentMethod;
use App\Models\SavedPaymentMethod;
use App\Services\PaymentMethodResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class PaymentMethodController extends Controller
{
    /** @var list<array{id: string, label: string}> */
    private const NETWORKS = [
        ['id' => 'mtn', 'label' => 'MTN'],
        ['id' => 'vodafone_cash', 'label' => 'Vodafone Cash'],
        ['id' => 'airtel_tigo', 'label' => 'AirtelTigo Money'],
        ['id' => 'telecel_cash', 'label' => 'Telecel Cash'],
    ];

    public function index(Request $request): JsonResponse
    {
        $methods = SavedPaymentMethod::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('is_default')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (SavedPaymentMethod $method): array => $this->toRecord($method))
            ->values()
            ->all();

        return response()->json(['paymentMethods' => $methods]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $method = $this->findOwned($request, $id);
        if (! $method) {
            return api_error('payment_method_not_found', 'Payment method not found.', 404);
        }

        $wasDefault = $method->is_default;
        $userId = $method->user_id;
        $method->delete();

        if ($wasDefault) {
            $next = SavedPaymentMethod::query()
                ->where('user_id', $userId)
                ->orderByDesc('created_at')
                ->first();
            if ($next) {
                $next->update(['is_default' => true]);
            }
        }

        return response()->json(['success' => true]);
    }

    public function setDefault(Request $request, string $id): JsonResponse
    {
        $method = $this->findOwned($request, $id);
        if (! $method) {
            return api_error('payment_method_not_found', 'Payment method not found.', 404);
        }

        DB::transaction(function () use ($method, $request): void {
            SavedPaymentMethod::query()
                ->where('user_id', $request->user()->id)
                ->update(['is_default' => false]);

            $method->update(['is_default' => true]);
        });

        return response()->json($this->toRecord($method->fresh()));
    }

    public function networks(): JsonResponse
    {
        return response()->json(['networks' => self::NETWORKS]);
    }

    /**
     * Checkout methods (how to pay), filtered by currency and destination.
     * Public: the checkout page needs this before sign-in.
     *
     * `currency` and `country` are optional overrides. Omitted, they resolve the
     * way every other price does, both from `ShopperLocale` (`?country=`, else the
     * shopper's preferred or assigned country, else their IP, else the store
     * default), so the currency and the country can never describe two different
     * shoppers.
     *
     * `country` is the market the shopper pays from, not where the parcel goes.
     * A method's country list says where the method is offered, which follows the
     * market: a UAE card pays an order shipping to Ghana perfectly well. Passing
     * the delivery destination instead emptied the list for anyone crossing a
     * market border, which dead-ended checkout rather than narrowing it.
     */
    public function checkoutOptions(Request $request, PaymentMethodResolver $methods, ShopperLocale $locale): JsonResponse
    {
        $data = $request->validate([
            'currency' => ['nullable', 'string', 'size:3'],
            'country' => ['nullable', 'string', 'max:120'],
        ]);

        $currency = isset($data['currency']) && trim($data['currency']) !== ''
            ? strtoupper(trim($data['currency']))
            : $locale->currency();

        if (isset($data['country']) && trim($data['country']) !== '') {
            // An unknown country must fail loudly. Falling back to "destination
            // unknown" here would widen the list rather than narrow it, which is
            // the opposite of what a typo should cause.
            $resolved = Country::resolve(trim($data['country']));
            if (! $resolved instanceof Country) {
                return api_error('country_not_found', 'Unknown country. Send an ISO code such as GH.', 422);
            }

            $country = $resolved->code;
        } else {
            // No address, no separate lookup: the same locale that priced the
            // cart names the market. `DeliveryDestination::forUser()` is the
            // shipping question and must not answer this one.
            $country = $locale->country()?->code;
        }

        return response()->json([
            'paymentMethods' => $methods->available($currency, $country)
                ->map(fn (PaymentMethod $method): array => [
                    'rid' => $method->rid,
                    'code' => $method->code,
                    'label' => $method->label,
                    'icon' => $method->icon,
                    'iconUrl' => $method->icon_url,
                    'currencies' => $method->currencyList(),
                    'countries' => $method->countryList(),
                ])
                ->values()
                ->all(),
        ]);
    }

    private function findOwned(Request $request, string $rid): ?SavedPaymentMethod
    {
        return SavedPaymentMethod::query()
            ->where('user_id', $request->user()->id)
            ->where('rid', $rid)
            ->first();
    }

    /**
     * @return array{rid: string, cardholderName: string, type: string, maskedDetail: string, network: ?string, isDefault: bool}
     */
    private function toRecord(SavedPaymentMethod $method): array
    {
        return [
            'rid' => $method->rid,
            'cardholderName' => $method->cardholder_name,
            'type' => $method->type,
            'maskedDetail' => $method->masked_detail,
            'network' => $method->network,
            'isDefault' => (bool) $method->is_default,
        ];
    }
}
