<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\CartService;
use App\Services\OrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class OrderController extends Controller
{
    public function __construct(
        private readonly OrderService $orders,
        private readonly CartService $carts,
    ) {}

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return api_error('unauthenticated', 'Authentication required.', 401);
        }

        $data = $request->validate([
            'addressId' => ['required', 'string'],
            'cartItemIds' => ['required', 'array', 'min:1'],
            'cartItemIds.*' => ['string'],
        ]);

        // Guest cart lines (X-Cart-Id) merge into the user cart before checkout.
        $cart = $this->carts->mergeGuestCartAfterLogin($request, $user);
        $cart->load('items');

        $requestedRids = array_values($data['cartItemIds']);
        $matched = $cart->items->whereIn('rid', $requestedRids);
        if ($matched->count() !== count(array_unique($requestedRids))) {
            // Guest line rids are replaced during merge; fall back to selected lines.
            $requestedRids = $cart->items
                ->where('selected', true)
                ->pluck('rid')
                ->values()
                ->all();
        }

        if ($requestedRids === []) {
            return api_error('cart_empty', 'No cart items to order.', 422);
        }

        $order = $this->orders->placeOrder($user, $cart, $data['addressId'], $requestedRids);

        return response()
            ->json($this->orders->placedResponse($order), 201)
            ->header('X-Cart-Id', $cart->rid);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return api_error('unauthenticated', 'Authentication required.', 401);
        }

        return response()->json($this->orders->listForUser($user, $request));
    }

    public function show(Request $request, string $orderId): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return api_error('unauthenticated', 'Authentication required.', 401);
        }

        $order = $this->orders->findForUser($user, $orderId);

        return response()->json($this->orders->toDetail($order));
    }

    public function buyAgain(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return api_error('unauthenticated', 'Authentication required.', 401);
        }

        $limit = (int) $request->query('limit', 12);

        return response()->json([
            'products' => $this->orders->buyAgainProducts($user, $limit),
        ]);
    }

    public function buyAgainFromOrder(Request $request, string $orderId): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return api_error('unauthenticated', 'Authentication required.', 401);
        }

        $order = $this->orders->findForUser($user, $orderId);
        $cart = $this->carts->resolveCart($request);
        $cart = $this->orders->buyAgainFromOrder($user, $order, $cart);

        return $this->carts->toJsonResponse($cart);
    }

    /**
     * A shopper cancelling their own order, while it is still awaiting payment.
     * Nothing has been charged, so this releases the held stock rather than
     * moving money. Paid or dispatched orders are refused here and handled by
     * staff (a refund) or the return flow.
     */
    public function cancel(Request $request, string $orderId): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return api_error('unauthenticated', 'Authentication required.', 401);
        }

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $order = $this->orders->cancelByCustomer(
            $user,
            $this->orders->findForUser($user, $orderId),
            $data['reason'] ?? null,
        );

        return response()->json([
            'orderId' => $order->rid,
            'orderReference' => $order->order_reference,
            'status' => $order->status->value,
            'paymentStatus' => $order->payment_status->value,
        ]);
    }

    public function returnRequest(Request $request, string $orderId): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return api_error('unauthenticated', 'Authentication required.', 401);
        }

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $order = $this->orders->findForUser($user, $orderId);
        $ret = $this->orders->requestReturn($user, $order, $data['reason'] ?? null);

        return response()->json([
            'success' => true,
            'returnId' => $ret->rid,
            'rid' => $ret->rid,
            'status' => $ret->status,
        ], 201);
    }

    public function tracking(Request $request, string $orderId): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return api_error('unauthenticated', 'Authentication required.', 401);
        }

        $order = $this->orders->findForUser($user, $orderId);

        return response()->json([
            'events' => $this->orders->tracking($order),
        ]);
    }
}
