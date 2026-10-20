<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\ProductQueryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SearchController extends Controller
{
    public function __construct(
        private readonly ProductQueryService $products,
    ) {}

    public function suggestions(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => ['required', 'string', 'min:1'],
        ]);

        $q = trim($data['q']);
        $like = '%'.$q.'%';
        $limit = min(20, max(1, (int) $request->query('limit', 8)));

        $suggestions = $this->products->activeQuery()
            ->where(function ($query) use ($like): void {
                $query->where('name', 'like', $like)
                    ->orWhereHas('attributeValues', fn ($attributes) => $attributes->where('name', 'brand')->where('value', 'like', $like));
            })
            ->orderByDesc('sold_count')
            ->orderBy('name')
            ->limit($limit)
            ->get(['rid', 'name', 'image'])
            ->map(fn ($product) => [
                'rid' => $product->rid,
                'name' => $product->name,
                'image' => $product->image,
                'imageUrl' => $product->image_url,
            ])
            ->values()
            ->all();

        return response()->json([
            'suggestions' => $suggestions,
        ]);
    }
}
