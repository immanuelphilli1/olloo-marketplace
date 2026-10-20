@php
    $shell = config('email-shell.brand');
    $text = $text ?? '';
@endphp
@if ($text !== '')
    <h1 style="margin: 0 0 12px; font-size: 22px; line-height: 1.25; font-weight: 700; color: {{ $shell['foreground'] }}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
        {{ $text }}
    </h1>
@endif
