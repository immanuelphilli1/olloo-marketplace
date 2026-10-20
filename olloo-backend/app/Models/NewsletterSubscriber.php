<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;

class NewsletterSubscriber extends Model
{
    use HasRid;

    protected $fillable = [
        'rid',
        'email',
        'unsubscribe_token',
        'subscribed_at',
        'unsubscribed_at',
    ];

    protected $hidden = [
        'id',
        'unsubscribe_token',
    ];

    protected function casts(): array
    {
        return [
            'subscribed_at' => 'datetime',
            'unsubscribed_at' => 'datetime',
        ];
    }
}
