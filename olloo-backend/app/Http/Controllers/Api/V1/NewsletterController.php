<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\NewsletterSubscriber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class NewsletterController extends Controller
{
    public function subscribe(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255'],
        ]);

        $email = Str::lower($data['email']);

        $subscriber = NewsletterSubscriber::query()->where('email', $email)->first();

        if ($subscriber) {
            $subscriber->forceFill([
                'subscribed_at' => now(),
                'unsubscribed_at' => null,
            ])->save();
        } else {
            $subscriber = NewsletterSubscriber::query()->create([
                'email' => $email,
                'unsubscribe_token' => Str::random(48),
                'subscribed_at' => now(),
            ]);
        }

        return response()->json([
            'success' => true,
            'email' => $subscriber->email,
        ], 201);
    }

    public function unsubscribe(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
        ]);

        $subscriber = NewsletterSubscriber::query()
            ->where('unsubscribe_token', $data['token'])
            ->first();

        if (! $subscriber) {
            return api_error('newsletter_token_invalid', 'Invalid unsubscribe token.', 404);
        }

        if ($subscriber->unsubscribed_at === null) {
            $subscriber->unsubscribed_at = now();
            $subscriber->save();
        }

        return response()->json([
            'success' => true,
            'email' => $subscriber->email,
        ]);
    }
}
