<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\OrderPaymentStatus;
use App\Enums\OrderStatus;
use App\Models\Concerns\HasRid;
use App\Services\ProductStats;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class Order extends Model
{
    use HasRid;

    protected $fillable = [
        'rid',
        'order_reference',
        'user_id',
        'address_id',
        'status',
        'payment_status',
        'payment_method',
        'currency_code',
        'base_currency_code',
        'items_total_minor',
        'items_discount_minor',
        'shipping_minor',
        'tax_minor',
        'total_minor',
        'base_total_minor',
        'estimated_delivery',
        'shipping_snapshot',
        'fx_snapshot',
        'address_snapshot',
        'placed_at',
        'shipped_at',
        'delivered_at',
    ];

    protected $hidden = [
        'id',
    ];

    protected function casts(): array
    {
        return [
            'items_total_minor' => 'integer',
            'items_discount_minor' => 'integer',
            'shipping_minor' => 'integer',
            'tax_minor' => 'integer',
            'total_minor' => 'integer',
            'base_total_minor' => 'integer',
            'shipping_snapshot' => 'array',
            'fx_snapshot' => 'array',
            'address_snapshot' => 'array',
            'placed_at' => 'datetime',
            'shipped_at' => 'datetime',
            'delivered_at' => 'datetime',
            'status' => OrderStatus::class,
            'payment_status' => OrderPaymentStatus::class,
        ];
    }

    protected static function booted(): void
    {
        // Sold counts follow paid, not cancelled orders.
        static::saved(static function (Order $order): void {
            if (! $order->wasRecentlyCreated && $order->wasChanged(['payment_status', 'status'])) {
                DB::afterCommit(static function () use ($order): void {
                    $stats = app(ProductStats::class);
                    foreach ($order->items()->whereNotNull('product_id')->distinct()->pluck('product_id') as $productId) {
                        $stats->refreshSold((int) $productId);
                    }
                });
            }
        });
    }

    public function user(): BelongsTo
    {
        // Closed accounts are soft-deleted; their orders still show the customer.
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function address(): BelongsTo
    {
        return $this->belongsTo(Address::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function returns(): HasMany
    {
        return $this->hasMany(OrderReturn::class);
    }

    public function taxLines(): HasMany
    {
        return $this->hasMany(OrderTaxLine::class);
    }

    public function trackingEvents(): HasMany
    {
        return $this->hasMany(OrderTrackingEvent::class);
    }
}
