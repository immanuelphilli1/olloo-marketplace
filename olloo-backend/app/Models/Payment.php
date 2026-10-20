<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use HasRid;

    protected $fillable = [
        'rid',
        'order_id',
        'user_id',
        'payment_method_id',
        'provider',
        'status',
        'amount_minor',
        'currency_code',
        'external_reference',
        'checkout_url',
        'metadata',
    ];

    protected $hidden = [
        'id',
    ];

    protected function casts(): array
    {
        return [
            'amount_minor' => 'integer',
            'metadata' => 'array',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
