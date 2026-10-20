@php
    $shell = config('email-shell.brand');
    $url = is_string($url ?? null) ? $url : '';
    $label = $label ?? 'Continue';
@endphp
@if ($url !== '')
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 22px 0 8px;">
        <tr>
            <td>
                <a href="{{ $url }}" style="display: inline-block; padding: 12px 22px; background: {{ $shell['accent'] }}; color: {{ $shell['button_text'] }}; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 700; line-height: 1.2;">
                    {{ $label }}
                </a>
            </td>
        </tr>
    </table>

    @include('emails.partials.button-fallback', ['url' => $url])
@endif
