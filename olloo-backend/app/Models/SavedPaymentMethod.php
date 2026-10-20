<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SavedPaymentMethod extends Model
{
    use HasRid;

    protected $fillable = [
        'rid',
        'user_id',
        'type',
        'cardholder_name',
        'masked_detail',
        'network',
        'provider_token',
        'is_default',
    ];

    protected $hidden = [
        'id',
        'provider_token',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'provider_token' => 'encrypted',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
