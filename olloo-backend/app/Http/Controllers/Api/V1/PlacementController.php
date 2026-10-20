<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\InhousePlacement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class PlacementController extends Controller
{
    /**
     * Active banners for one storefront page, in display order. One call per
     * page; the client groups them by `position`.
     */
    public function index(Request $request, string $page): JsonResponse
    {
        if (! isset(InhousePlacement::SLOTS[$page])) {
            return api_error('placement_page_not_found', 'There are no placements for this page.', 404);
        }

        $data = $request->validate([
            'position' => ['nullable', 'string', Rule::in(array_keys(InhousePlacement::SLOTS[$page]['positions']))],
        ]);

        $placements = InhousePlacement::query()
            ->where('page', $page)
            ->where('is_active', true)
            ->when($data['position'] ?? null, fn ($query, string $position) => $query->where('position', $position))
            ->ordered()
            ->get();

        return response()->json([
            'items' => $placements->map(fn (InhousePlacement $placement) => [
                'rid' => $placement->rid,
                'position' => $placement->position,
                'imageUrl' => $placement->image_url,
                // Video slots only (site.nav_video); imageUrl is then the poster.
                'videoUrl' => $placement->videoUrl(),
                'altText' => $placement->alt_text,
                'title' => $placement->title,
                'description' => $placement->description,
                'buttonText' => $placement->button_text,
                'linkUrl' => $placement->link_url,
            ])->values()->all(),
        ]);
    }
}
