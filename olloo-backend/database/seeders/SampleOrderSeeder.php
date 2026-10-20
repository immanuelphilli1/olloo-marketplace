<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\OrderPaymentStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\Address;
use App\Models\Country;
use App\Models\Currency;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderTrackingEvent;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Seeder;

class SampleOrderSeeder extends Seeder
{
    public function run(): void
    {
        $customer = User::query()
            ->where('email', 'demo@handco.test')
            ->where('user_type', 'customer')
            ->first();

        if ($customer === null) {
            return;
        }

        $product = Product::query()
            ->where('slug', 'aerosmart-earbuds')
            ->first()
            ?? Product::query()->where('is_active', true)->first();

        if ($product === null) {
            return;
        }

        $address = Address::query()->updateOrCreate(
            [
                'user_id' => $customer->id,
                'address_line' => '12 Marina Walk',
            ],
            [
                'country_id' => Country::query()->where('code', 'AE')->value('id'),
                'first_name' => 'Demo',
                'last_name' => 'Customer',
                'phone_country_code' => '+971',
                'phone_number' => '501234567',
                'region' => 'Dubai',
                'city' => 'Dubai',
                'city_line' => 'Dubai Marina',
                'is_default' => true,
            ],
        );

        $variant = $product->defaultVariant()->first();
        $unitPrice = $variant?->price_minor ?? $product->price_minor;
        $quantity = 1;
        $shipping = 0;
        $itemsTotal = $unitPrice * $quantity;
        $total = $itemsTotal + $shipping;

        // The base is the store default, not the product's currency. They match
        // while the catalogue is priced in USD, but conflating them would write
        // a wrong base the day a product is priced in another currency.
        $baseCurrency = Currency::defaultCode();
        $orderCurrency = $product->currency_code;
        $baseTotal = $orderCurrency === $baseCurrency ? $total : null;

        $order = Order::query()->updateOrCreate(
            [
                'user_id' => $customer->id,
                'order_reference' => '#HCOSEED000000001',
            ],
            [
                'address_id' => $address->id,
                'status' => OrderStatus::Delivered,
                'payment_status' => OrderPaymentStatus::Paid,
                'payment_method' => 'card',
                'currency_code' => $orderCurrency,
                'base_currency_code' => $baseCurrency,
                'items_total_minor' => $itemsTotal,
                'items_discount_minor' => 0,
                'shipping_minor' => $shipping,
                'total_minor' => $total,
                // Only meaningful when the order was charged in the base
                // currency; NULL rather than a guessed conversion otherwise.
                'base_total_minor' => $baseTotal,
                'estimated_delivery' => 'Delivered',
                'shipping_snapshot' => [
                    'method' => 'standard',
                    'label' => 'Standard delivery',
                    'feeMinor' => $shipping,
                ],
                'address_snapshot' => [
                    'country' => 'United Arab Emirates',
                    'countryCode' => 'AE',
                    'firstName' => $address->first_name,
                    'lastName' => $address->last_name,
                    'phoneCountryCode' => $address->phone_country_code,
                    'phoneNumber' => $address->phone_number,
                    'addressLine' => $address->address_line,
                    'region' => $address->region,
                    'city' => $address->city,
                    'cityLine' => $address->city_line,
                ],
                'placed_at' => now()->subDays(10),
                'shipped_at' => now()->subDays(6),
                'delivered_at' => now()->subDays(3),
            ],
        );

        $order->forceFill(['updated_at' => now()->subDays(3)])->saveQuietly();

        OrderItem::query()->where('order_id', $order->id)->delete();

        OrderItem::query()->create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant?->id,
            'product_rid' => $product->rid,
            'product_name' => $product->name,
            'variant_name' => $variant?->name ?? 'Standard',
            'sku' => $variant?->sku,
            'image' => $product->image,
            'unit_price_minor' => $unitPrice,
            'source_currency_code' => $product->currency_code,
            'source_unit_price_minor' => $unitPrice,
            'quantity' => $quantity,
        ]);

        Payment::query()->updateOrCreate(
            [
                'order_id' => $order->id,
                'external_reference' => 'fake_seed_order_1',
            ],
            [
                'user_id' => $customer->id,
                'provider' => 'fake',
                'status' => PaymentStatus::Completed->value,
                'amount_minor' => $total,
                'currency_code' => $order->currency_code,
                'checkout_url' => null,
                'metadata' => ['seeded' => true],
            ],
        );

        OrderTrackingEvent::query()->where('order_id', $order->id)->delete();

        $events = [
            ['label' => 'Order placed', 'description' => 'We received your order.', 'days_ago' => 10],
            ['label' => 'Processing', 'description' => 'Items are being prepared.', 'days_ago' => 9],
            ['label' => 'Shipped', 'description' => 'Your parcel is on the way.', 'days_ago' => 6],
            ['label' => 'Delivered', 'description' => 'Package delivered successfully.', 'days_ago' => 3],
        ];

        foreach ($events as $event) {
            OrderTrackingEvent::query()->create([
                'order_id' => $order->id,
                'label' => $event['label'],
                'description' => $event['description'],
                'occurred_at' => now()->subDays($event['days_ago']),
            ]);
        }
    }
}
