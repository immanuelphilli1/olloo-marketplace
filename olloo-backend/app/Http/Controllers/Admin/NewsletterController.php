<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\NewsletterSubscriber;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NewsletterController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('view_newsletter'), 403);

        $search = trim((string) $request->query('search', ''));

        $query = NewsletterSubscriber::query()->latest('subscribed_at');

        if ($search !== '') {
            $query->where('email', 'like', '%'.$search.'%');
        }

        $subscribers = $query->paginate((int) config('admin.per_page'))->withQueryString()->through(fn (NewsletterSubscriber $subscriber) => [
            'rid' => $subscriber->rid,
            'email' => $subscriber->email,
            'subscribedAt' => $subscriber->subscribed_at?->toIso8601String(),
            'unsubscribedAt' => $subscriber->unsubscribed_at?->toIso8601String(),
        ]);

        return Inertia::render('Admin/Newsletter/Index', [
            'subscribers' => $subscribers,
            'filters' => ['search' => $search],
            'canDelete' => (bool) $request->user('staff')?->can('delete_newsletter'),
        ]);
    }

    public function destroy(Request $request, NewsletterSubscriber $subscriber): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('delete_newsletter'), 403);

        $subscriber->delete();

        return back()->with('success', 'Subscriber removed.');
    }
}
