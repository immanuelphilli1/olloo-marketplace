<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class StaffNotification extends Model
{
    use HasRid;
    use SoftDeletes;

    protected $fillable = [
        'rid',
        'user_id',
        'type',
        'title',
        'message',
        'data',
        'read_at',
    ];

    protected $hidden = [
        'id',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'read_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function markAsRead(): void
    {
        if ($this->read_at === null) {
            $this->forceFill(['read_at' => now()])->save();
        }
    }

    public function markAsUnread(): void
    {
        if ($this->read_at !== null) {
            $this->forceFill(['read_at' => null])->save();
        }
    }

    public function isRead(): bool
    {
        return $this->read_at !== null;
    }
}
