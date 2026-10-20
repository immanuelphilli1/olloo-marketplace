<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CustomerController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('view_customers'), 403);

        $search = trim((string) $request->query('search', ''));

        // Staff accounts shop with the same login, so a staff member with orders
        // is listed here too.
        $query = User::query()->where(fn ($q) => $q->where('user_type', 'customer')->orWhereHas('orders'));

        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($q) use ($like): void {
                $q->where('name', 'like', $like)
                    ->orWhere('email', 'like', $like)
                    ->orWhere('rid', 'like', $like);
            });
        }

        $customers = $query->withCount('orders')->latest()->paginate((int) config('admin.per_page'))->withQueryString()->through(fn (User $user) => [
            'rid' => $user->rid,
            'name' => $user->name,
            'email' => $user->email,
            'isGuest' => (bool) $user->is_guest,
            'ordersCount' => $user->orders_count,
            'createdAt' => $user->created_at?->toIso8601String(),
        ]);

        return Inertia::render('Admin/Customers/Index', [
            'customers' => $customers,
            'filters' => ['search' => $search],
        ]);
    }

    public function show(Request $request, User $customer): Response
    {
        abort_unless($request->user('staff')?->can('view_customers'), 403);

        $orders = Order::query()
            ->where('user_id', $customer->id)
            ->latest()
            ->limit(20)
            ->get(['rid', 'status', 'currency_code', 'total_minor', 'created_at'])
            ->map(fn (Order $order) => [
                'rid' => $order->rid,
                'status' => $order->status,
                'currencyCode' => $order->currency_code,
                'total' => $order->total_minor / 100,
                'createdAt' => $order->created_at?->toIso8601String(),
            ]);

        return Inertia::render('Admin/Customers/Show', [
            'customer' => [
                'rid' => $customer->rid,
                'name' => $customer->name,
                'email' => $customer->email,
                'phone' => $customer->phone,
                'isGuest' => (bool) $customer->is_guest,
                'createdAt' => $customer->created_at?->toIso8601String(),
            ],
            'orders' => $orders,
            'canViewOrders' => (bool) $request->user('staff')?->can('view_orders'),
        ]);
    }
}
