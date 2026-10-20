<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class NotificationController extends Controller
{
    /** @var array<string, array{flag: string, title: string, description: string}> */
    private const SETTINGS = [
        'promotions' => [
            'flag' => 'notify_promotions',
            'title' => 'Promotions',
            'description' => 'Deals, discounts, and special offers.',
        ],
        'orderUpdates' => [
            'flag' => 'notify_order_updates',
            'title' => 'Order updates',
            'description' => 'Shipping, delivery, and order status changes.',
        ],
    ];

    public function settings(Request $request): JsonResponse
    {
        $user = $request->user();

        $settings = [];
        foreach (self::SETTINGS as $id => $meta) {
            $settings[] = [
                'id' => $id,
                'title' => $meta['title'],
                'description' => $meta['description'],
                'enabled' => (bool) $user->{$meta['flag']},
            ];
        }

        return response()->json(['settings' => $settings]);
    }

    public function updateSetting(Request $request, string $id): JsonResponse
    {
        if (! array_key_exists($id, self::SETTINGS)) {
            return api_error('notification_setting_not_found', 'Unknown notification setting.', 404);
        }

        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
        ]);

        $user = $request->user();
        $flag = self::SETTINGS[$id]['flag'];
        $user->{$flag} = (bool) $data['enabled'];
        $user->save();

        $meta = self::SETTINGS[$id];

        return response()->json([
            'id' => $id,
            'title' => $meta['title'],
            'description' => $meta['description'],
            'enabled' => (bool) $user->{$flag},
        ]);
    }
}
