@extends('emails.layouts.brand')

@section('preheader')
Payment {{ $payment->rid }} settled as completed.
@endsection

@section('content')
    @include('emails.partials.heading', ['text' => 'Payment received'])

    @include('emails.partials.text', [
        'text' => 'A payment of '.$payment->currency_code.' '.number_format($payment->amount_minor / 100, 2).' via '.$payment->provider.' was completed.',
    ])

    @include('emails.partials.button', [
        'url' => route('admin.payments.show', $payment),
        'label' => 'View payment',
    ])
@endsection
