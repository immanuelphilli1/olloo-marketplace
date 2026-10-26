@php
    $shell = config('email-shell.brand');
    $subject = $subject ?? ($shell['name'] ?? 'olloo');
    $preheader = trim($__env->yieldContent('preheader'));
    $logoUrl = $logoUrl ?? email_logo_url();
    $width = (int) ($shell['width'] ?? 560);
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>{{ $subject }}</title>
</head>
<body style="margin: 0; padding: 0; width: 100%; background: {{ $shell['canvas'] }}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
    @if ($preheader !== '')
        <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent; mso-hide: all;">
            {{ $preheader }}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
        </div>
    @endif

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: {{ $shell['canvas'] }};">
        <tr>
            <td align="center" style="padding: 28px 12px;">
                <table role="presentation" width="{{ $width }}" cellspacing="0" cellpadding="0" border="0" style="width: {{ $width }}px; max-width: 100%; background: {{ $shell['surface'] }}; border: 1px solid {{ $shell['border'] }}; border-radius: 12px; overflow: hidden;">
                    <tr>
                        <td style="padding: 24px 28px 16px; background: {{ $shell['surface'] }}; color: {{ $shell['foreground'] }}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td>
                                        <img src="{{ $logoUrl }}" width="48" height="48" alt="{{ $shell['logo_alt'] ?? $shell['name'] }}" style="display: block; border: 0; border-radius: 8px;">
                                    </td>
                                    <td style="padding-left: 12px;">
                                        <div style="font-size: 18px; font-weight: 800; letter-spacing: -0.02em; color: {{ $shell['foreground'] }};">{{ $shell['name'] }}</div>
                                    </td>
                                </tr>
                            </table>
                            <div style="margin-top: 16px; border-bottom: 2px solid {{ $shell['accent'] }};"></div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 28px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: {{ $shell['foreground'] }}; font-size: 15px; line-height: 1.6;">
                            @yield('content')
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 18px 32px 24px; border-top: 1px solid {{ $shell['border'] }}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 12px; color: {{ $shell['muted'] }}; line-height: 1.5;">
                            @hasSection('footer_note')
                                <div style="margin-bottom: 8px;">@yield('footer_note')</div>
                            @else
                                <div style="margin-bottom: 8px;">{{ $shell['footer_note'] }}</div>
                            @endif
                            {{ $shell['footer'] }}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
