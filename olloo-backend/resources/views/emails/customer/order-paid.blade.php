@extends('emails.layouts.brand')

@section('preheader')
Payment confirmed for {{ $order->order_reference }}.
@endsection

@section('content')
    @include('emails.partials.heading', ['text' => 'Payment confirmed'])

    @include('emails.partials.text', [
        'text' => 'Thanks for your order '.$order->order_reference.'. Your payment is confirmed and we are preparing your items.',
    ])

    @include('emails.partials.button', [
        'url' => config('app.url'),
        'label' => 'View order status',
    ])
@endsection
