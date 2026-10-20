# Email Logs (copyable module)

HandCO stores every outbound email in `email_logs` and exposes an admin UI with a sandboxed HTML renderer. Other apps can copy this stack almost as-is.

## What you get

- DB row per send attempt: recipients, subject, HTML + text bodies, headers, attachment metadata, mailer/transport, mailable/notification class, timings, exceptions
- Works for SMTP and Laravel defaults (`array`, `log`, notifications like password reset)
- Sync **and** queued failures recorded
- Open tracking via the brand logo URL path token (`/images/mail/{email_log_rid}.png`)
- Thin mirror into Request History (`action=mail_send`) linked by `EmailLog` entity
- Admin **Email Logs** index (filters + stats) and show page (preview / HTML / text / headers / meta, `.eml` download)

## Email shell (Graphite Minimal)

Product emails should extend `emails.layouts.brand` and use the shared partials:

| Piece | Path |
|-------|------|
| Layout | `resources/views/emails/layouts/brand.blade.php` |
| CTA + raw link fallback | `resources/views/emails/partials/button.blade.php` |
| Raw link only | `resources/views/emails/partials/button-fallback.blade.php` |
| Tokens | `config/email-shell.php` |
| Example | `resources/views/emails/example.blade.php` |

Button partials always include: "If you cannot click the button, copy and paste this link into your browser:" plus the raw URL.

At send time, `EmailLogRecorder` rewrites the brand logo `src` to the open-tracking path for that log's `rid`.

## Pieces to copy

| Piece | Path |
|-------|------|
| Migration | `database/migrations/2026_09_20_180000_create_email_logs_table.php` |
| Model | `app/Models/EmailLog.php` |
| Status enum | `app/Enums/EmailLogStatus.php` |
| Recorder | `app/Services/EmailLog/EmailLogRecorder.php` |
| Transport wrapper | `app/Mail/Transport/LoggingTransport.php` |
| Mail manager | `app/Mail/LoggingMailManager.php` |
| Listener | `app/Listeners/RecordOutboundEmail.php` |
| Open tracker | `app/Http/Controllers/MailBrandAssetController.php` (`mail.brand-asset`) |
| Provider wiring | `app/Providers/AppServiceProvider.php` (`mail.manager` singleton + events) |
| Admin controller + pages | `app/Http/Controllers/Admin/EmailLogController.php`, `resources/js/Pages/Admin/EmailLogs/*` |
| Permission | `view_email_logs` |

## How logging works

1. `LoggingMailManager` wraps every Symfony transport with `LoggingTransport`.
2. On send: create/update `email_logs` as `sending`, inject tracking logo URL, then `sent` or `failed`.
3. `MessageSending` / `MessageSent` enrich mailable / notification class names (including framework defaults).
4. `JobExceptionOccurred` records queued failures that never reached the transport (deduped when transport already logged).
5. When a client loads `/images/mail/{rid}.png`, set `read_at` (first open), append a client snapshot to `open_history`, bump `open_count`, return the logo bytes.

Correlation header: `X-HandCO-Email-Log-Rid` (stripped from stored headers).

## Admin routes

- `admin.email-logs.index`
- `admin.email-logs.show`
- `admin.email-logs.preview` (CSP-locked HTML for the iframe)
- `admin.email-logs.download` (`.eml`)

## Public open-tracking route

- `mail.brand-asset` → `GET /images/mail/{rid}.png`

## Security notes

- Preview iframe uses `sandbox=""` (no scripts) plus a tight CSP on the preview response.
- Bodies can contain PII; restrict with `view_email_logs`.
- Attachment **bytes** are not stored, only name / type / size metadata.
- Unknown rids still receive the logo file (no existence leak via status code); only matching logs are marked read.

## Verify

```bash
php artisan migrate
php artisan db:seed --class=AdminPermissionsSeeder
php artisan test --filter=EmailLogTest
```

Send a test mail locally (`MAIL_MAILER=array` or `log`) and open **System → Email Logs**.
