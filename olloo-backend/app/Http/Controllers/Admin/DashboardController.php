<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Inquiry;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Review;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        return Inertia::render('Admin/Dashboard', [
            'stats' => [
                'products' => Product::query()->count(),
                'activeProducts' => Product::query()->where('is_active', true)->count(),
                'orders' => Order::query()->count(),
                'processingOrders' => Order::query()->where('status', 'processing')->count(),
                'payments' => Payment::query()->count(),
                'pendingReviews' => Review::query()->where('is_approved', false)->count(),
                'inquiries' => Inquiry::query()->count(),
            ],
        ]);
    }
}
