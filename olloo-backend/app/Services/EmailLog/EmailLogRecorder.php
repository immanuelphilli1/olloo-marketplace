<?php

declare(strict_types=1);

namespace App\Services\EmailLog;

use App\Enums\EmailLogStatus;
use App\Models\EmailLog;
use App\Models\User;
use App\Services\ExternalRequestLogger;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\Part\DataPart;
use Throwable;

final class EmailLogRecorder
{
    public const HEADER_RID = 'X-HandCO-Email-Log-Rid';

    private bool $transportHandledFailure = false;

    public function __construct(
        private readonly ExternalRequestLogger $requestLogger,
    ) {}

    public function transportHandledFailure(): bool
    {
        $handled = $this->transportHandledFailure;
        $this->transportHandledFailure = false;

        return $handled;
    }

    /**
     * Create (or refresh) a sending log from a Symfony message.
     *
     * @param  array<string, mixed>  $context
     */
    public function start(Email $message, array $context = []): EmailLog
    {
        $existingRid = $this->headerValue($message, self::HEADER_RID);
        $payload = $this->extractMessagePayload($message, $context);

        if (is_string($existingRid) && $existingRid !== '') {
            $log = EmailLog::query()->where('rid', $existingRid)->first();
            if ($log instanceof EmailLog) {
                $log->fill($payload);
                $log->status = EmailLogStatus::Sending;
                $log->sending_at = $log->sending_at ?? now();
                $log->save();
                $this->injectOpenTrackingLogo($message, $log);

                return $log;
            }
        }

        $auth = $this->resolveAuth();

        $log = EmailLog::query()->create([
            ...$payload,
            'status' => EmailLogStatus::Sending,
            'sending_at' => now(),
            'user_id' => $auth['user_id'],
            'guard' => $auth['guard'],
        ]);

        $message->getHeaders()->addTextHeader(self::HEADER_RID, $log->rid);
        $this->injectOpenTrackingLogo($message, $log);

        return $log;
    }

    public function markOpenedByRid(string $rid, Request $request): ?EmailLog
    {
        $log = $this->findByRid($rid);
        if (! $log instanceof EmailLog) {
            return null;
        }

        $now = now();
        $history = is_array($log->open_history) ? $log->open_history : [];
        $history[] = $this->clientOpenSnapshot($request, $now);

        $updates = [
            'open_count' => count($history),
            'last_opened_at' => $now,
            'open_history' => array_values($history),
        ];

        if ($log->read_at === null) {
            $updates['read_at'] = $now;
        }

        $log->forceFill($updates)->save();

        return $log;
    }

    /**
     * @return array<string, mixed>
     */
    private function clientOpenSnapshot(Request $request, Carbon $openedAt): array
    {
        $forwardedFor = $request->headers->get('X-Forwarded-For');
        $acceptLanguage = $request->headers->get('Accept-Language');
        $referer = $request->headers->get('Referer');
        $via = $request->headers->get('Via');
        $secChUa = $request->headers->get('Sec-CH-UA');
        $secChUaMobile = $request->headers->get('Sec-CH-UA-Mobile');
        $secChUaPlatform = $request->headers->get('Sec-CH-UA-Platform');

        return array_filter([
            'opened_at' => $openedAt->toIso8601String(),
            'ip' => $request->ip(),
            'ips' => $request->ips(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 1024) ?: null,
            'accept_language' => $acceptLanguage !== null && $acceptLanguage !== ''
                ? mb_substr($acceptLanguage, 0, 255)
                : null,
            'referer' => $referer !== null && $referer !== ''
                ? mb_substr($referer, 0, 1024)
                : null,
            'forwarded_for' => $forwardedFor !== null && $forwardedFor !== ''
                ? mb_substr($forwardedFor, 0, 512)
                : null,
            'via' => $via !== null && $via !== '' ? mb_substr($via, 0, 255) : null,
            'sec_ch_ua' => $secChUa !== null && $secChUa !== '' ? mb_substr($secChUa, 0, 255) : null,
            'sec_ch_ua_mobile' => $secChUaMobile,
            'sec_ch_ua_platform' => $secChUaPlatform !== null && $secChUaPlatform !== ''
                ? mb_substr($secChUaPlatform, 0, 64)
                : null,
            'method' => $request->method(),
        ], fn ($value) => $value !== null && $value !== '' && $value !== []);
    }

    /**
     * Rewrite brand logo src values to the path-token open tracker for this log.
     */
    public function injectOpenTrackingLogo(Email $message, EmailLog $log): void
    {
        $html = $message->getHtmlBody();
        if (is_object($html)) {
            $html = (string) $html;
        }
        if (! is_string($html) || trim($html) === '') {
            return;
        }

        $trackingUrl = email_logo_url($log->rid);
        $rewritten = $html;

        foreach (email_brand_logo_candidates() as $candidate) {
            if ($candidate !== '' && str_contains($rewritten, $candidate)) {
                $rewritten = str_replace($candidate, $trackingUrl, $rewritten);
            }
        }

        // Relative brand path without leading domain (common in local previews).
        $relative = '/'.ltrim((string) config('brand.logo.path', 'images/brand/olloo-logo.png'), '/');
        if (str_contains($rewritten, $relative) && ! str_contains($rewritten, $trackingUrl)) {
            $rewritten = str_replace($relative, $trackingUrl, $rewritten);
        }

        if ($rewritten === $html) {
            return;
        }

        $message->html($rewritten);
        $log->html_body = $rewritten;
        $log->save();
    }

    /**
     * @param  array<string, mixed>  $context
     */
    public function markSent(Email $message, array $context = []): EmailLog
    {
        $log = $this->findByMessage($message) ?? $this->start($message, $context);

        $payload = $this->extractMessagePayload($message, $context);
        $started = $log->sending_at ?? $log->created_at;
        $durationMs = $started ? (int) max(0, $started->diffInMilliseconds(now())) : null;

        $log->fill($payload);
        $log->status = EmailLogStatus::Sent;
        $log->sent_at = now();
        $log->failed_at = null;
        $log->exception_class = null;
        $log->exception_message = null;
        $log->duration_ms = $durationMs;
        $log->message_id = $this->resolveMessageId($message) ?? $log->message_id;
        $log->save();

        $this->mirrorToRequestHistory($log, success: true);

        return $log;
    }

    public function markFailed(EmailLog $log, Throwable $exception, ?Email $message = null): EmailLog
    {
        if ($message instanceof Email) {
            $log->fill($this->extractMessagePayload($message, []));
            $log->message_id = $this->resolveMessageId($message) ?? $log->message_id;
        }

        $started = $log->sending_at ?? $log->queued_at ?? $log->created_at;
        $durationMs = $started ? (int) max(0, $started->diffInMilliseconds(now())) : null;

        $log->status = EmailLogStatus::Failed;
        $log->failed_at = now();
        $log->exception_class = $exception::class;
        $log->exception_message = mb_substr($exception->getMessage(), 0, 5000);
        $log->duration_ms = $durationMs;
        $log->save();

        $this->transportHandledFailure = true;
        $this->mirrorToRequestHistory($log, success: false, exception: $exception);

        return $log;
    }

    /**
     * Persist a failure when we only have job / mailable context (no Symfony message).
     *
     * @param  array<string, mixed>  $context
     */
    public function recordFailureWithoutMessage(Throwable $exception, array $context = []): EmailLog
    {
        $auth = $this->resolveAuth();

        $log = EmailLog::query()->create([
            'status' => EmailLogStatus::Failed,
            'mailer' => Arr::get($context, 'mailer'),
            'mailable_class' => Arr::get($context, 'mailable_class'),
            'notification_class' => Arr::get($context, 'notification_class'),
            'subject' => Arr::get($context, 'subject'),
            'to_addresses' => Arr::get($context, 'to_addresses'),
            'queue' => Arr::get($context, 'queue'),
            'meta' => Arr::get($context, 'meta'),
            'exception_class' => $exception::class,
            'exception_message' => mb_substr($exception->getMessage(), 0, 5000),
            'failed_at' => now(),
            'user_id' => $auth['user_id'],
            'guard' => $auth['guard'],
        ]);

        $this->mirrorToRequestHistory($log, success: false, exception: $exception);

        return $log;
    }

    public function findByMessage(Email $message): ?EmailLog
    {
        $rid = $this->headerValue($message, self::HEADER_RID);
        if (! is_string($rid) || $rid === '') {
            return null;
        }

        return EmailLog::query()->where('rid', $rid)->first();
    }

    public function findByRid(string $rid): ?EmailLog
    {
        return EmailLog::query()->where('rid', $rid)->first();
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    public function extractMessagePayload(Email $message, array $context = []): array
    {
        $html = $message->getHtmlBody();
        $text = $message->getTextBody();
        if (is_object($html)) {
            $html = (string) $html;
        }
        if (is_object($text)) {
            $text = (string) $text;
        }

        $html = is_string($html) ? $html : null;
        $text = is_string($text) ? $text : null;

        $attachments = [];
        foreach ($message->getAttachments() as $part) {
            if (! $part instanceof DataPart) {
                continue;
            }
            $attachments[] = [
                'name' => $part->getFilename() ?: 'attachment',
                'content_type' => $part->getContentType(),
                'size' => strlen($part->bodyToString()),
                'inline' => $part->getDisposition() === 'inline',
            ];
        }

        $headers = [];
        foreach ($message->getHeaders()->all() as $header) {
            $name = $header->getName();
            if (strcasecmp($name, self::HEADER_RID) === 0) {
                continue;
            }
            $headers[$name] = $header->getBodyAsString();
        }

        $size = strlen((string) $html) + strlen((string) $text);
        foreach ($attachments as $attachment) {
            $size += (int) ($attachment['size'] ?? 0);
        }

        return [
            'mailer' => Arr::get($context, 'mailer') ?? config('mail.default'),
            'transport' => Arr::get($context, 'transport'),
            'mailable_class' => Arr::get($context, 'mailable_class'),
            'notification_class' => Arr::get($context, 'notification_class'),
            'subject' => $message->getSubject(),
            'from_addresses' => $this->mapAddresses($message->getFrom()),
            'to_addresses' => $this->mapAddresses($message->getTo()),
            'cc_addresses' => $this->mapAddresses($message->getCc()),
            'bcc_addresses' => $this->mapAddresses($message->getBcc()),
            'reply_to_addresses' => $this->mapAddresses($message->getReplyTo()),
            'html_body' => $html,
            'text_body' => $text,
            'headers' => $headers,
            'attachments' => $attachments === [] ? null : $attachments,
            'size_bytes' => $size,
            'locale' => Arr::get($context, 'locale'),
            'queue' => Arr::get($context, 'queue'),
            'entity_type' => Arr::get($context, 'entity_type'),
            'entity_rid' => Arr::get($context, 'entity_rid'),
            'meta' => array_filter([
                'symfony_message_class' => $message::class,
                ...(is_array(Arr::get($context, 'meta')) ? Arr::get($context, 'meta') : []),
            ], fn ($v) => $v !== null && $v !== ''),
        ];
    }

    /**
     * @param  list<Address>  $addresses
     * @return list<array{address: string, name: string|null}>
     */
    private function mapAddresses(array $addresses): array
    {
        return array_values(array_map(
            fn (Address $address) => [
                'address' => $address->getAddress(),
                'name' => $address->getName() !== '' ? $address->getName() : null,
            ],
            $addresses,
        ));
    }

    private function headerValue(Email $message, string $name): ?string
    {
        $header = $message->getHeaders()->get($name);
        if ($header === null) {
            return null;
        }

        $value = trim($header->getBodyAsString());

        return $value !== '' ? $value : null;
    }

    private function resolveMessageId(Email $message): ?string
    {
        $header = $message->getHeaders()->get('Message-ID')
            ?? $message->getHeaders()->get('Message-Id');

        if ($header === null) {
            return null;
        }

        $value = trim($header->getBodyAsString());

        return $value !== '' ? $value : null;
    }

    /**
     * @return array{user_id: int|null, guard: string|null}
     */
    private function resolveAuth(): array
    {
        foreach (['staff', 'web', 'sanctum'] as $guard) {
            $user = Auth::guard($guard)->user();
            if ($user instanceof Authenticatable && isset($user->id)) {
                return [
                    'user_id' => $user instanceof User ? $user->id : null,
                    'guard' => $guard,
                ];
            }
        }

        return ['user_id' => null, 'guard' => null];
    }

    private function mirrorToRequestHistory(EmailLog $log, bool $success, ?Throwable $exception = null): void
    {
        $to = collect($log->to_addresses ?? [])
            ->pluck('address')
            ->filter()
            ->values()
            ->all();

        $this->requestLogger->logOutgoing([
            'service' => $log->mailer ?: (string) config('mail.default'),
            'action' => 'mail_send',
            'request' => [
                'method' => 'POST',
                'url' => ($log->mailer ?: 'mail').'://send',
                'body' => [
                    'subject' => $log->subject,
                    'to' => $to,
                    'mailable_class' => $log->mailable_class,
                    'notification_class' => $log->notification_class,
                    'email_log_rid' => $log->rid,
                ],
            ],
            'response' => [
                'status_code' => null,
                'headers' => [],
                'body' => null,
                'success' => $success,
            ],
            'duration_ms' => $log->duration_ms,
            'exception' => $exception,
            'meta' => [
                'email_log_rid' => $log->rid,
                'message_id' => $log->message_id,
            ],
            'entities' => [
                [
                    'type' => EmailLog::class,
                    'id' => $log->id,
                    'rid' => $log->rid,
                ],
            ],
        ]);
    }
}
