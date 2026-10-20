<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;

class ContentPage extends Model
{
    use HasRid;

    protected $fillable = [
        'rid',
        'slug',
        'title',
        'last_updated',
        'intro',
        'blocks',
    ];

    protected $hidden = [
        'id',
    ];

    protected function casts(): array
    {
        return [
            'intro' => 'array',
            'blocks' => 'array',
        ];
    }
}
