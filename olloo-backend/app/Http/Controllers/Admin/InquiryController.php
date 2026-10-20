<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Inquiry;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InquiryController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('view_inquiries'), 403);

        $type = trim((string) $request->query('type', ''));

        $query = Inquiry::query()->latest();

        if ($type !== '') {
            $query->where('type', $type);
        }

        $inquiries = $query->paginate((int) config('admin.per_page'))->withQueryString()->through(fn (Inquiry $inquiry) => [
            'rid' => $inquiry->rid,
            'type' => $inquiry->type,
            'email' => $inquiry->email,
            'name' => $inquiry->name,
            'createdAt' => $inquiry->created_at?->toIso8601String(),
        ]);

        return Inertia::render('Admin/Inquiries/Index', [
            'inquiries' => $inquiries,
            'filters' => ['type' => $type],
            'types' => Inquiry::query()->distinct()->orderBy('type')->pluck('type')->values()->all(),
        ]);
    }

    public function show(Request $request, Inquiry $inquiry): Response
    {
        abort_unless($request->user('staff')?->can('view_inquiries'), 403);

        return Inertia::render('Admin/Inquiries/Show', [
            'inquiry' => [
                'rid' => $inquiry->rid,
                'type' => $inquiry->type,
                'email' => $inquiry->email,
                'name' => $inquiry->name,
                'payload' => $inquiry->payload,
                'createdAt' => $inquiry->created_at?->toIso8601String(),
            ],
        ]);
    }
}
