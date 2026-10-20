@extends('emails.layouts.brand')

@section('preheader')
Thanks {{ $inquiry->name }}, we received your message.
@endsection

@section('content')
    @include('emails.partials.heading', ['text' => 'We got your inquiry'])

    @include('emails.partials.text', [
        'text' => 'Hi '.$inquiry->name.', thanks for contacting HandCO. Our team will review your '.$inquiry->type.' request and get back to you soon.',
    ])

    @include('emails.partials.button', [
        'url' => config('app.url'),
        'label' => 'Visit HandCO',
    ])
@endsection
