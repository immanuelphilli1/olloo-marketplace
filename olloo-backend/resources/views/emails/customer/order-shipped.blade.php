@extends('emails.layouts.brand')

@section('preheader')
{{ $order->order_reference }} is on the way.
@endsection

@section('content')
    @include('emails.partials.heading', ['text' => 'Your order is on the way'])

    @include('emails.partials.text', [
        'text' => 'Good news: order '.$order->order_reference.' has shipped. Track progress below.',
    ])

    @if ($tracking->isNotEmpty())
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 18px;">
            @foreach ($tracking as $event)
                <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7; font-size: 13px; color: #18181b;">
                        <strong>{{ $event['status'] }}</strong>
                        @if (! empty($event['description']))
                            <div style="margin-top: 2px; color: #71717a;">{{ $event['description'] }}</div>
                        @endif
                        @if (! empty($event['occurred_at']))
                            <div style="margin-top: 2px; color: #a1a1aa; font-size: 12px;">{{ $event['occurred_at'] }}</div>
                        @endif
                    </td>
                </tr>
            @endforeach
        </table>
    @endif

    @include('emails.partials.button', [
        'url' => config('app.url'),
        'label' => 'Track order',
    ])
@endsection
