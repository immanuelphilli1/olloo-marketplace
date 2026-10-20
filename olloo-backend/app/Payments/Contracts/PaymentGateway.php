<?php

declare(strict_types=1);

namespace App\Payments\Contracts;

use App\Payments\DTOs\CheckoutRequest;
use App\Payments\DTOs\CheckoutSession;
use App\Payments\DTOs\VerifiedCharge;
use App\Payments\DTOs\WebhookEvent;
use Illuminate\Http\Request;

interface PaymentGateway
{
    public function key(): string;

    /**
     * Start a provider checkout. Return/cancel URLs already carry our payment
     * reference (attached centrally); pass them through unmodified apart from
     * provider-mandated placeholders. Never rely on the provider to echo a
     * reference back.
     */
    public function createCheckout(CheckoutRequest $request): CheckoutSession;

    public function parseWebhook(Request $request): WebhookEvent;

    /**
     * Confirm charge status with the provider API (do not trust webhook body alone).
     */
    public function verifyCharge(string $externalReference): VerifiedCharge;
}
