<?php

declare(strict_types=1);

namespace App\Payments\DTOs;

final class WebhookEvent
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public readonly string $provider,
        public readonly string $externalEventId,
        public readonly string $eventType,
        public readonly ?string $reference,
        public readonly array $payload,
        public readonly bool $paid,
    ) {}
}
