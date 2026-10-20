@extends('emails.layouts.brand')

@section('preheader')
New {{ $inquiry->type }} inquiry from {{ $inquiry->name }}.
@endsection

@section('content')
    @include('emails.partials.heading', ['text' => 'New inquiry'])

    @include('emails.partials.text', [
        'text' => ucfirst($inquiry->type).' inquiry from '.$inquiry->name.' ('.$inquiry->email.').',
    ])

    @include('emails.partials.button', [
        'url' => route('admin.inquiries.show', $inquiry),
        'label' => 'View inquiry',
    ])
@endsection
