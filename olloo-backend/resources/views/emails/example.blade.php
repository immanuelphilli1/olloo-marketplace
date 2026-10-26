@extends('emails.layouts.brand')

@section('preheader')
Example olloo email using the Graphite Minimal shell.
@endsection

@section('content')
    @include('emails.partials.heading', ['text' => 'Your order is on the way'])

    @include('emails.partials.text', ['text' => 'Hi there, this is a sample body. Replace this view with a real mailable template that extends emails.layouts.brand.'])

    @include('emails.partials.button', [
        'url' => config('app.url'),
        'label' => 'Open olloo',
    ])
@endsection
