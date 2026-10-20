<?php

declare(strict_types=1);

namespace App\Models;

use App\Jobs\RefreshDeliveryQuotes;
use App\Models\Concerns\HasRid;
use App\Shipping\ShippingRuleResolver;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ShippingRule extends Model
{
    use HasRid;

    public const STRATEGY_FLAT = 'flat';

    public const STRATEGY_FREE_OVER_THRESHOLD = 'free_over_threshold';

    /** @var list<string> */
    public const STRATEGIES = [
        self::STRATEGY_FLAT,
        self::STRATEGY_FREE_OVER_THRESHOLD,
    ];

    protected $fillable = [
        'rid',
        'name',
        'strategy',
        'fee_minor',
        'currency_code',
        'country',
        'shipping_class_id',
        'min_subtotal_minor',
        'transit_days_min',
        'transit_days_max',
        'priority',
        'is_active',
    ];

    protected $hidden = [
        'id',
    ];

    protected function casts(): array
    {
        return [
            'fee_minor' => 'integer',
            'min_subtotal_minor' => 'integer',
            'transit_days_min' => 'integer',
            'transit_days_max' => 'integer',
            'priority' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        $forgetAfterCommit = static function (): void {
            // Runs immediately when no transaction is open.
            DB::afterCommit(static function (): void {
                Cache::forget(ShippingRuleResolver::CACHE_KEY);
                RefreshDeliveryQuotes::dispatch();
            });
        };

        static::saved($forgetAfterCommit);
        static::deleted($forgetAfterCommit);
    }

    public function shippingClass(): BelongsTo
    {
        return $this->belongsTo(ShippingClass::class);
    }

    public function effectiveFeeMinor(): int
    {
        if ($this->strategy === self::STRATEGY_FREE_OVER_THRESHOLD) {
            return 0;
        }

        return (int) $this->fee_minor;
    }
}
