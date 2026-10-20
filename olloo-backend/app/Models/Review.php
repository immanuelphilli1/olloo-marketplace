<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use App\Services\ProductStats;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

class Review extends Model
{
    use HasRid;

    protected $fillable = [
        'rid',
        'product_id',
        'user_id',
        'order_item_id',
        'rating',
        'title',
        'body',
        'author_display',
        'location',
        'is_approved',
    ];

    protected $hidden = [
        'id',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'is_approved' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        $refresh = static function (Review $review): void {
            DB::afterCommit(static fn () => app(ProductStats::class)->refreshReviews($review->product_id));
        };

        static::saved(static function (Review $review) use ($refresh): void {
            if ($review->wasRecentlyCreated || $review->wasChanged(['is_approved', 'rating', 'product_id'])) {
                $refresh($review);
            }
        });
        static::deleted($refresh);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }
}
