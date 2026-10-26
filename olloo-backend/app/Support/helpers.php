<?php

declare(strict_types=1);

use App\Currency\CurrencyConverter;
use Illuminate\Http\JsonResponse;

if (! function_exists('generate_rid')) {
    function generate_rid(): string
    {
        $characters = '0123456789abcdefghijklmnopqrstuvwxyz';
        $rid = '';

        for ($i = 0; $i < 12; $i++) {
            $rid .= $characters[random_int(0, strlen($characters) - 1)];
        }

        return $rid;
    }
}

if (! function_exists('api_error')) {
    /**
     * @param  array<string, mixed>|null  $details
     */
    function api_error(
        string $code,
        string $message,
        int $status = 400,
        ?array $details = null,
    ): JsonResponse {
        $error = [
            'code' => $code,
            'message' => $message,
        ];

        if ($details !== null) {
            $error['details'] = $details;
        }

        return response()->json(['error' => $error], $status);
    }
}

if (! function_exists('money')) {
    /**
     * Minor units to the wire shape, using the currency's own decimal places
     * (0 for JPY-style currencies, 3 for KWD-style). Unknown currencies throw.
     *
     * @return array{amount: float|int, currency: string}
     */
    function money(int $amountMinor, string $currency, bool $asDecimal = true): array
    {
        if (! $asDecimal) {
            return ['amount' => $amountMinor, 'currency' => $currency];
        }

        $places = app(CurrencyConverter::class)->decimalPlaces($currency);

        return [
            'amount' => $places === 0 ? $amountMinor : round($amountMinor / 10 ** $places, $places),
            'currency' => $currency,
        ];
    }
}

if (! function_exists('generate_order_reference')) {
    function generate_order_reference(): string
    {
        return '#HCO'.strtoupper(substr(generate_rid(), 0, 4)).random_int(100000000, 999999999);
    }
}

if (! function_exists('email_logo_url')) {
    /**
     * Brand logo URL for emails. Pass an email_logs rid to use the open-tracking path.
     */
    function email_logo_url(?string $emailLogRid = null): string
    {
        if (is_string($emailLogRid) && $emailLogRid !== '') {
            return route('mail.brand-asset', ['rid' => $emailLogRid]);
        }

        $path = (string) config('brand.logo.path', 'images/brand/olloo-logo.png');

        return asset($path);
    }
}

if (! function_exists('email_brand_logo_candidates')) {
    /**
     * Absolute and relative logo URLs that may appear in rendered HTML before tracking rewrite.
     *
     * @return list<string>
     */
    function email_brand_logo_candidates(): array
    {
        $path = ltrim((string) config('brand.logo.path', 'images/brand/olloo-logo.png'), '/');

        return array_values(array_unique(array_filter([
            asset($path),
            url($path),
            url('/'.$path),
            '/'.$path,
        ])));
    }
}
