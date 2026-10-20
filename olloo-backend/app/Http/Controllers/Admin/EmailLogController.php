<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\EmailLogStatus;
use App\Http\Controllers\Controller;
use App\Models\EmailLog;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class EmailLogController extends Controller
{
    public function index(Request $request): InertiaResponse
    {
        abort_unless($request->user('staff')?->can('view_email_logs'), 403);

        $status = trim((string) $request->query('status', ''));
        $mailer = trim((string) $request->query('mailer', ''));
        $mailable = trim((string) $request->query('mailable', ''));
        $search = trim((string) $request->query('search', ''));
        $from = trim((string) $request->query('from', ''));
        $to = trim((string) $request->query('to', ''));
        $hasHtml = $request->query('has_html');
        $failedOnly = $request->boolean('failed_only');
        $read = trim((string) $request->query('read', ''));

        $query = EmailLog::query()->with(['user:id,rid,name,email'])->latest('id');

        if ($failedOnly) {
            $query->where('status', EmailLogStatus::Failed);
        } elseif ($status !== '' && EmailLogStatus::tryFrom($status)) {
            $query->where('status', $status);
        }

        if ($mailer !== '') {
            $query->where('mailer', $mailer);
        }

        if ($mailable !== '') {
            $query->where(function ($q) use ($mailable): void {
                $q->where('mailable_class', 'like', '%'.$mailable.'%')
                    ->orWhere('notification_class', 'like', '%'.$mailable.'%');
            });
        }

        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($q) use ($like, $search): void {
                $q->where('rid', $search)
                    ->orWhere('subject', 'like', $like)
                    ->orWhere('message_id', 'like', $like)
                    ->orWhere('to_addresses', 'like', $like)
                    ->orWhere('from_addresses', 'like', $like)
                    ->orWhere('exception_message', 'like', $like);
            });
        }

        if ($from !== '') {
            $query->where('created_at', '>=', $from.' 00:00:00');
        }
        if ($to !== '') {
            $query->where('created_at', '<=', $to.' 23:59:59');
        }

        if ($hasHtml === '1') {
            $query->whereNotNull('html_body')->where('html_body', '!=', '');
        } elseif ($hasHtml === '0') {
            $query->where(function ($q): void {
                $q->whereNull('html_body')->orWhere('html_body', '');
            });
        }

        if ($read === '1') {
            $query->whereNotNull('read_at');
        } elseif ($read === '0') {
            $query->whereNull('read_at');
        }

        $logs = $query->paginate((int) config('admin.per_page'))->withQueryString()->through(fn (EmailLog $log) => $this->toListItem($log));

        $today = now()->startOfDay();

        return Inertia::render('Admin/EmailLogs/Index', [
            'logs' => $logs,
            'filters' => [
                'status' => $status,
                'mailer' => $mailer,
                'mailable' => $mailable,
                'search' => $search,
                'from' => $from,
                'to' => $to,
                'has_html' => is_string($hasHtml) ? $hasHtml : '',
                'failed_only' => $failedOnly ? '1' : '',
                'read' => $read,
            ],
            'mailers' => EmailLog::query()->whereNotNull('mailer')->distinct()->orderBy('mailer')->pluck('mailer')->values()->all(),
            'statuses' => array_map(fn (EmailLogStatus $s) => $s->value, EmailLogStatus::cases()),
            'stats' => [
                'sentToday' => EmailLog::query()->where('status', EmailLogStatus::Sent)->where('sent_at', '>=', $today)->count(),
                'failedToday' => EmailLog::query()->where('status', EmailLogStatus::Failed)->where('failed_at', '>=', $today)->count(),
                'sending' => EmailLog::query()->where('status', EmailLogStatus::Sending)->count(),
                'readToday' => EmailLog::query()->whereNotNull('read_at')->where('read_at', '>=', $today)->count(),
                'total' => EmailLog::query()->count(),
            ],
        ]);
    }

    public function show(Request $request, EmailLog $emailLog): InertiaResponse
    {
        abort_unless($request->user('staff')?->can('view_email_logs'), 403);

        $emailLog->load(['user:id,rid,name,email']);

        return Inertia::render('Admin/EmailLogs/Show', [
            'log' => $this->toDetail($emailLog),
        ]);
    }

    public function previewHtml(Request $request, EmailLog $emailLog): Response
    {
        abort_unless($request->user('staff')?->can('view_email_logs'), 403);

        $html = $emailLog->html_body;
        if (! is_string($html) || trim($html) === '') {
            $text = $emailLog->text_body ?: '(No HTML body stored for this email.)';
            $html = '<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;white-space:pre-wrap;">'
                .e($text)
                .'</body></html>';
        } else {
            $html = $this->stripOpenTrackingForPreview($html, $emailLog);
        }

        return response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Content-Security-Policy' => "default-src 'none'; img-src data: https: http:; style-src 'unsafe-inline'; font-src data: https:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'SAMEORIGIN',
            'Referrer-Policy' => 'no-referrer',
        ]);
    }

    /**
     * Replace path-token tracking logo URLs with the static brand asset so admin
     * previews never record opens.
     */
    private function stripOpenTrackingForPreview(string $html, EmailLog $emailLog): string
    {
        $staticLogo = email_logo_url();
        $candidates = array_values(array_unique(array_filter([
            email_logo_url($emailLog->rid),
            url('/images/mail/'.$emailLog->rid.'.png'),
            url('images/mail/'.$emailLog->rid.'.png'),
            '/images/mail/'.$emailLog->rid.'.png',
        ])));

        foreach ($candidates as $trackingUrl) {
            $html = str_replace($trackingUrl, $staticLogo, $html);
        }

        $html = preg_replace(
            '#https?://[^"\'\s>]+/images/mail/'.preg_quote($emailLog->rid, '#').'\.png#i',
            $staticLogo,
            $html,
        ) ?? $html;

        return $html;
    }

    public function download(Request $request, EmailLog $emailLog): Response
    {
        abort_unless($request->user('staff')?->can('view_email_logs'), 403);

        $eml = $this->toEml($emailLog);
        $filename = 'email-'.$emailLog->rid.'.eml';

        return response($eml, 200, [
            'Content-Type' => 'message/rfc822',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function toListItem(EmailLog $log): array
    {
        return [
            'rid' => $log->rid,
            'status' => $log->status->value,
            'mailer' => $log->mailer,
            'subject' => $log->subject,
            'to' => collect($log->to_addresses ?? [])->pluck('address')->filter()->values()->all(),
            'mailableClass' => $log->mailable_class,
            'mailableShort' => $log->shortClass($log->mailable_class),
            'notificationClass' => $log->notification_class,
            'notificationShort' => $log->shortClass($log->notification_class),
            'hasHtml' => $log->hasHtml(),
            'attachmentCount' => is_array($log->attachments) ? count($log->attachments) : 0,
            'sizeBytes' => $log->size_bytes,
            'durationMs' => $log->duration_ms,
            'exceptionMessage' => $log->exception_message,
            'isRead' => $log->isRead(),
            'readAt' => $log->read_at?->toIso8601String(),
            'lastOpenedAt' => $log->last_opened_at?->toIso8601String(),
            'openCount' => (int) $log->open_count,
            'sentAt' => $log->sent_at?->toIso8601String(),
            'failedAt' => $log->failed_at?->toIso8601String(),
            'createdAt' => $log->created_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function toDetail(EmailLog $log): array
    {
        return [
            ...$this->toListItem($log),
            'transport' => $log->transport,
            'messageId' => $log->message_id,
            'from' => $log->from_addresses ?? [],
            'cc' => $log->cc_addresses ?? [],
            'bcc' => $log->bcc_addresses ?? [],
            'replyTo' => $log->reply_to_addresses ?? [],
            'htmlBody' => $log->html_body,
            'textBody' => $log->text_body,
            'headers' => $log->headers ?? [],
            'attachments' => $log->attachments ?? [],
            'locale' => $log->locale,
            'queue' => $log->queue,
            'guard' => $log->guard,
            'entityType' => $log->entity_type,
            'entityRid' => $log->entity_rid,
            'exceptionClass' => $log->exception_class,
            'meta' => $log->meta,
            'openHistory' => array_values(is_array($log->open_history) ? $log->open_history : []),
            'queuedAt' => $log->queued_at?->toIso8601String(),
            'sendingAt' => $log->sending_at?->toIso8601String(),
            'user' => $log->user ? [
                'rid' => $log->user->rid,
                'name' => $log->user->name,
                'email' => $log->user->email,
            ] : null,
            'previewUrl' => route('admin.email-logs.preview', $log),
            'downloadUrl' => route('admin.email-logs.download', $log),
        ];
    }

    private function toEml(EmailLog $log): string
    {
        $headers = [];
        foreach ($log->headers ?? [] as $name => $value) {
            if (! is_string($name) || ! is_string($value)) {
                continue;
            }
            $headers[] = $name.': '.$value;
        }

        if ($headers === []) {
            $from = $log->from_addresses[0]['address'] ?? 'noreply@localhost';
            $to = collect($log->to_addresses ?? [])->pluck('address')->implode(', ');
            $headers[] = 'From: '.$from;
            $headers[] = 'To: '.$to;
            $headers[] = 'Subject: '.($log->subject ?? '');
            $headers[] = 'MIME-Version: 1.0';
            if ($log->hasHtml()) {
                $headers[] = 'Content-Type: text/html; charset=UTF-8';
            } else {
                $headers[] = 'Content-Type: text/plain; charset=UTF-8';
            }
        }

        $body = $log->html_body ?: ($log->text_body ?: '');

        return implode("\r\n", $headers)."\r\n\r\n".$body;
    }
}
