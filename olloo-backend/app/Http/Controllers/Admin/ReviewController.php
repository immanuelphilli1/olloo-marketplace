<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Review;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReviewController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('view_reviews'), 403);

        $approved = $request->query('approved');

        $query = Review::query()
            ->with(['product:id,rid,name', 'user:id,rid,name,email'])
            ->latest();

        if ($approved === '1') {
            $query->where('is_approved', true);
        } elseif ($approved === '0') {
            $query->where('is_approved', false);
        }

        $reviews = $query->paginate((int) config('admin.per_page'))->withQueryString()->through(fn (Review $review) => [
            'rid' => $review->rid,
            'rating' => $review->rating,
            'title' => $review->title,
            'body' => $review->body,
            'authorDisplay' => $review->author_display,
            'isApproved' => $review->is_approved,
            'createdAt' => $review->created_at?->toIso8601String(),
            'product' => $review->product ? [
                'rid' => $review->product->rid,
                'name' => $review->product->name,
            ] : null,
            'user' => $review->user ? [
                'rid' => $review->user->rid,
                'name' => $review->user->name,
                'email' => $review->user->email,
            ] : null,
        ]);

        return Inertia::render('Admin/Reviews/Index', [
            'reviews' => $reviews,
            'filters' => ['approved' => is_string($approved) ? $approved : ''],
            'canEdit' => (bool) $request->user('staff')?->can('edit_reviews'),
            'canDelete' => (bool) $request->user('staff')?->can('delete_reviews'),
        ]);
    }

    public function updateStatus(Request $request, Review $review): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('edit_reviews'), 403);

        $validated = $request->validate([
            'is_approved' => ['required', 'boolean'],
        ]);

        $review->update(['is_approved' => $validated['is_approved']]);

        return back()->with('success', $validated['is_approved'] ? 'Review approved.' : 'Review unapproved.');
    }

    public function destroy(Request $request, Review $review): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('delete_reviews'), 403);

        $review->delete();

        return back()->with('success', 'Review deleted.');
    }
}
