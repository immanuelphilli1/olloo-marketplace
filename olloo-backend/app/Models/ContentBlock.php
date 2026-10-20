<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;

class ContentBlock extends Model
{
    use HasRid;

    protected $fillable = [
        'rid',
        'key',
        'payload',
    ];

    protected $hidden = [
        'id',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
        ];
    }
}
