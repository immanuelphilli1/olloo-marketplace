<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\EmailLogStatus;
use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmailLog extends Model
{
    use HasRid;

    protected $fillable = [
        'rid',
        'status',
        'mailer',
        'transport',
        'mailable_class',
        'notification_class',
        'subject',
        'message_id',
        'from_addresses',
        'to_addresses',
        'cc_addresses',
        'bcc_addresses',
        'reply_to_addresses',
        'html_body',
        'text_body',
        'headers',
        'attachments',
        'size_bytes',
        'locale',
        'queue',
        'user_id',
        'guard',
        'entity_type',
        'entity_rid',
        'exception_class',
        'exception_message',
        'meta',
        'duration_ms',
        'queued_at',
        'sending_at',
        'sent_at',
        'failed_at',
        'read_at',
        'last_opened_at',
        'open_count',
        'open_history',
    ];

    protected $hidden = [
        'id',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'status' => EmailLogStatus::class,
            'from_addresses' => 'array',
            'to_addresses' => 'array',
            'cc_addresses' => 'array',
            'bcc_addresses' => 'array',
            'reply_to_addresses' => 'array',
            'headers' => 'array',
            'attachments' => 'array',
            'meta' => 'array',
            'open_history' => 'array',
            'size_bytes' => 'integer',
            'duration_ms' => 'integer',
            'open_count' => 'integer',
            'queued_at' => 'datetime',
            'sending_at' => 'datetime',
            'sent_at' => 'datetime',
            'failed_at' => 'datetime',
            'read_at' => 'datetime',
            'last_opened_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isRead(): bool
    {
        return $this->read_at !== null;
    }

    public function primaryRecipient(): ?string
    {
        $to = $this->to_addresses ?? [];

        return is_array($to) && isset($to[0]['address']) ? (string) $to[0]['address'] : null;
    }

    public function hasHtml(): bool
    {
        return is_string($this->html_body) && trim($this->html_body) !== '';
    }

    public function shortClass(?string $fqcn): ?string
    {
        if ($fqcn === null || $fqcn === '') {
            return null;
        }

        $parts = explode('\\', $fqcn);

        return $parts[array_key_last($parts)] ?: $fqcn;
    }
}
