<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\CartService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class CartController extends Controller
{
    public function __construct(
        private readonly CartService $carts,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $cart = $this->carts->resolveCart($request);

        return $this->carts->toJsonResponse($cart);
    }

    public function addItem(Request $request): JsonResponse
    {
        $data = $request->validate([
            'productId' => ['required', 'string'],
            'variantId' => ['nullable', 'string'],
            'quantity' => ['sometimes', 'integer', 'min:1'],
        ]);

        $cart = $this->carts->resolveCart($request);
        $cart = $this->carts->addItem(
            $cart,
            $data['productId'],
            $data['variantId'] ?? null,
            (int) ($data['quantity'] ?? 1),
        );

        return $this->carts->toJsonResponse($cart);
    }

    public function updateItem(Request $request, string $itemId): JsonResponse
    {
        $data = $request->validate([
            'quantity' => ['sometimes', 'integer', 'min:0'],
            'selected' => ['sometimes', 'boolean'],
        ]);

        if (! array_key_exists('quantity', $data) && ! array_key_exists('selected', $data)) {
            return api_error('validation_error', 'Provide quantity and/or selected.', 422);
        }

        $cart = $this->carts->resolveCart($request);
        $cart = $this->carts->updateItem(
            $cart,
            $itemId,
            array_key_exists('quantity', $data) ? (int) $data['quantity'] : null,
            array_key_exists('selected', $data) ? (bool) $data['selected'] : null,
        );

        return $this->carts->toJsonResponse($cart);
    }

    public function removeItem(Request $request, string $itemId): JsonResponse
    {
        $cart = $this->carts->resolveCart($request);
        $cart = $this->carts->removeItem($cart, $itemId);

        return $this->carts->toJsonResponse($cart);
    }

    public function removeSelected(Request $request): JsonResponse
    {
        $cart = $this->carts->resolveCart($request);
        $cart = $this->carts->removeSelected($cart);

        return $this->carts->toJsonResponse($cart);
    }

    public function selectAll(Request $request): JsonResponse
    {
        $data = $request->validate([
            'selected' => ['required', 'boolean'],
        ]);

        $cart = $this->carts->resolveCart($request);
        $cart = $this->carts->selectAll($cart, (bool) $data['selected']);

        return $this->carts->toJsonResponse($cart);
    }

    public function moveSelectedToWishlist(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return api_error('unauthenticated', 'Authentication required.', 401);
        }

        $cart = $this->carts->resolveCart($request);
        $cart = $this->carts->moveSelectedToWishlist($user, $cart);

        return $this->carts->toJsonResponse($cart);
    }

    public function merge(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return api_error('unauthenticated', 'Authentication required.', 401);
        }

        $cart = $this->carts->mergeGuestCartAfterLogin($request, $user);

        return $this->carts->toJsonResponse($cart);
    }
}
