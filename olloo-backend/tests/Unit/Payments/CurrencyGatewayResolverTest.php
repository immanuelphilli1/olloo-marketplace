<?php

declare(strict_types=1);

namespace Tests\Unit\Payments;

use App\Models\Currency;
use App\Payments\CurrencyGatewayResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

final class CurrencyGatewayResolverTest extends TestCase
{
    use RefreshDatabase;

    public function test_resolves_provider_from_currency_row(): void
    {
        Currency::query()->create([
            'code' => 'AED',
            'name' => 'UAE Dirham',
            'payment_provider' => 'fake',
            'is_default' => true,
        ]);

        $resolver = new CurrencyGatewayResolver;

        $this->assertSame('fake', $resolver->forCurrency('AED'));
    }

    public function test_fails_loud_when_provider_blank(): void
    {
        Currency::query()->create([
            'code' => 'XXX',
            'name' => 'Broken',
            'payment_provider' => '',
            'is_default' => false,
        ]);

        $this->expectException(InvalidArgumentException::class);

        (new CurrencyGatewayResolver)->forCurrency('XXX');
    }

    public function test_override_provider_wins(): void
    {
        Currency::query()->create([
            'code' => 'AED',
            'name' => 'UAE Dirham',
            'payment_provider' => 'stripe',
            'is_default' => true,
        ]);

        $this->assertSame('paystack', (new CurrencyGatewayResolver)->forCurrency('AED', 'paystack'));
    }
}
