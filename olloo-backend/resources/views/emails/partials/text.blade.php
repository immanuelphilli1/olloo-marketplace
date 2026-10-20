@php
    $shell = config('email-shell.brand');
    $text = $text ?? '';
@endphp
@if ($text !== '')
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: {{ $shell['foreground'] }}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
        {{ $text }}
    </p>
@endif
