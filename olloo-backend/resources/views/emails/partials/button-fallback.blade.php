@php
    $shell = config('email-shell.brand');
    $url = is_string($url ?? null) ? $url : '';
@endphp
@if ($url !== '')
    <div style="margin: 0 0 18px; padding-top: 4px; max-width: 100%;">
        <p style="margin: 0 0 6px; font-size: 13px; line-height: 1.5; color: {{ $shell['muted'] }};">
            {{ $shell['button_fallback'] }}
        </p>
        <p style="margin: 0; word-break: break-all; overflow-wrap: anywhere; font-size: 13px; line-height: 1.5;">
            <a href="{{ $url }}" style="color: {{ $shell['accent'] }}; text-decoration: underline; font-weight: 400; word-break: break-all; overflow-wrap: anywhere;">{{ $url }}</a>
        </p>
    </div>
@endif
