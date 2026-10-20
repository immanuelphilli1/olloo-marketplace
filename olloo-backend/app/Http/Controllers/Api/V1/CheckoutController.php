<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Currency\ShopperLocale;
use App\Enums\OrderPaymentStatus;
use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Models\Address;
use App\Models\Country;
use App\Models\Order;
use App\Models\PaymentMethod;
use App\Models\User;
use App\Services\CartService;
use App\Services\CheckoutPaymentService;
use App\Services\PaymentMethodResolver;
use App\Services\ShippingService;
use App\Shipping\DeliveryDestination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

final class CheckoutController extends Controller
{
    public function __construct(
        private readonly CartService $carts,
        private readonly ShippingService $shipping,
        private readonly CheckoutPaymentService $payments,
        private readonly PaymentMethodResolver $paymentMethods,
        private readonly ShopperLocale $locale,
    ) {}

    public function preview(Request $request): JsonResponse
    {
        $cart = $this->carts->resolveCart($request);
        $payload = $this->carts->toResponse($cart);
        $selected = array_values(array_filter(
            $payload['items'],
            fn (array $item): bool => (bool) ($item['selected'] ?? false),
        ));

        $addressPreview = $this->defaultAddressPreview($request);
        $destination = $this->previewDestination($request);
        $market = $this->shopperMarket();
        $quote = $this->shipping->quoteForCart($cart, $destination);

        return response()
            ->json([
                'items' => $selected,
                'address' => $addressPreview,
                'shipping' => [
                    'feeMoney' => money($quote['feeMinor'], $quote['currency']),
                    'deliveryDays' => $quote['deliveryDays'],
                    'courierLabel' => $quote['courierLabel'],
                ],
                // The market, not $destination above: a method's country list is
                // where it is offered, so shipping abroad must not change how
                // the shopper pays. See shopperMarket().
                'paymentMethods' => $this->paymentMethods->available($cart->currency_code, $market)
                    ->map(fn (PaymentMethod $method): array => [
                        'rid' => $method->rid,
                        'code' => $method->code,
                        'label' => $method->label,
                        'icon' => $method->icon,
                        'iconUrl' => $method->icon_url,
                    ])
                    ->values()
                    ->all(),
                'summary' => $payload['summary'],
            ])
            ->header('X-Cart-Id', $cart->rid);
    }

    public function shippingQuote(Request $request): JsonResponse
    {
        $data = $request->validate([
            'addressRid' => ['nullable', 'string'],
            'country' => ['required_without:addressRid', 'string', 'max:120'],
            'firstName' => ['required_without:addressRid', 'string', 'max:120'],
            'lastName' => ['required_without:addressRid', 'string', 'max:120'],
            'phoneCountryCode' => ['required_without:addressRid', 'string', 'max:16'],
            'phoneNumber' => ['required_without:addressRid', 'string', 'max:40'],
            'addressLine' => ['required_without:addressRid', 'string', 'max:255'],
            'region' => ['required_without:addressRid', 'string', 'max:120'],
            'city' => ['required_without:addressRid', 'string', 'max:120'],
            'cityLine' => ['nullable', 'string', 'max:120'],
        ]);

        if (! empty($data['addressRid'])) {
            $user = $request->user();
            if (! $user) {
                return api_error('unauthenticated', 'Authentication required to use a saved address.', 401);
            }

            $address = Address::query()
                ->where('user_id', $user->id)
                ->where('rid', $data['addressRid'])
                ->with('country')
                ->first();

            if (! $address) {
                return api_error('address_not_found', 'Address not found.', 404);
            }

            $countryCode = $address->country->code;
        } else {
            $country = Country::resolve((string) $data['country']);
            if (! $country instanceof Country) {
                return api_error('country_not_found', 'Unknown country. Send an ISO code (for example AE) or a country rid.', 422);
            }

            $countryCode = $country->code;
        }

        $cart = $this->carts->resolveCart($request);
        $quote = $this->shipping->quoteForCart($cart, $countryCode);

        return response()->json([
            'feeMoney' => money($quote['feeMinor'], $quote['currency']),
            'deliveryDays' => $quote['deliveryDays'],
            'courierLabel' => $quote['courierLabel'],
            // Totals for this address, tax included.
            'summary' => $this->carts->summaryFor($cart, $countryCode),
        ]);
    }

    /**
     * Open a provider checkout for an order created by POST /orders. The amount
     * is always the order's frozen total, never recomputed from the cart.
     */
    public function paymentIntent(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return api_error('unauthenticated', 'Authentication required to start checkout.', 401);
        }

        $data = $request->validate([
            'orderId' => ['required', 'string'],
            'paymentMethodId' => ['nullable', 'string'],
        ]);

        $order = Order::query()
            ->where('user_id', $user->id)
            ->where('rid', $data['orderId'])
            ->first();

        if (! $order instanceof Order) {
            return api_error('order_not_found', 'Order not found.', 404);
        }

        if ($order->payment_status === OrderPaymentStatus::Paid) {
            return api_error('order_already_paid', 'This order is already paid.', 409);
        }

        if ($order->status !== OrderStatus::PendingPayment) {
            return api_error('order_not_payable', 'This order can no longer be paid. Place a new order.', 409, [
                'status' => $order->status->value,
            ]);
        }

        try {
            // Return URLs come from the resolved provider's own config.
            $payment = $this->payments->initiate(
                order: $order,
                customerEmail: $user->email,
                paymentMethodRef: $data['paymentMethodId'] ?? null,
            );
        } catch (InvalidArgumentException $e) {
            return api_error('payment_provider_error', $e->getMessage(), 422);
        }

        return response()->json([
            'checkoutUrl' => $payment->checkout_url,
            'paymentRid' => $payment->rid,
            'provider' => $payment->provider,
            'paymentMethodId' => $payment->paymentMethod?->rid,
            'orderId' => $order->rid,
            'amount' => money((int) $payment->amount_minor, $payment->currency_code),
        ]);
    }

    /**
     * Where this order is going, for the shipping quote and the tax.
     *
     * The saved address only, never `?country=`: that param picks the currency
     * the shopper pays in, and a shopper in Dubai shipping to Accra should be
     * quoted Accra freight.
     */
    private function previewDestination(Request $request): ?string
    {
        $user = $request->user();

        return $user instanceof User ? DeliveryDestination::forUser($user) : null;
    }

    /**
     * The market the shopper is paying from, for the payment method filter.
     *
     * The injected `ShopperLocale`, the same answer the cart currency came from,
     * so the price and the payment filter cannot disagree about who the shopper
     * is. It is the market and not the address because `payment_methods.countries`
     * says where a method is offered, which follows the market: filtering on the
     * delivery destination emptied the list for anyone crossing a market border.
     */
    private function shopperMarket(): ?string
    {
        return $this->locale->country()?->code;
    }

    /**
     * @return array{contact: string, line1: string, line2: string}|null
     */
    private function defaultAddressPreview(Request $request): ?array
    {
        $user = $request->user();
        if (! $user) {
            return null;
        }

        $address = Address::query()
            ->where('user_id', $user->id)
            ->where('is_default', true)
            ->first()
            ?? Address::query()->where('user_id', $user->id)->orderByDesc('id')->first();

        if (! $address) {
            return null;
        }

        return [
            'contact' => trim($address->first_name.' '.$address->last_name)
                .' | '.$address->phone_country_code.' '.$address->phone_number,
            'line1' => $address->address_line,
            'line2' => trim(implode(' ', array_filter([
                $address->city,
                $address->region,
                $address->country->name,
            ]))),
        ];
    }
}
