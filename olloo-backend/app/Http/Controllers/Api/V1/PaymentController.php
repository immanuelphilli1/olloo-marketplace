<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PaymentController extends Controller
{
    public function show(Request $request, string $paymentId): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return api_error('unauthenticated', 'Authentication required.', 401);
        }

        $payment = Payment::query()
            ->where('rid', $paymentId)
            ->where('user_id', $user->id)
            ->first();

        if (! $payment) {
            return api_error('payment_not_found', 'Payment not found.', 404);
        }

        return response()->json([
            'rid' => $payment->rid,
            'provider' => $payment->provider,
            'status' => $payment->status,
            'amount' => money((int) $payment->amount_minor, (string) $payment->currency_code),
            'orderId' => $payment->order?->rid,
        ]);
    }
}
