<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ContentBlock;
use App\Models\ContentPage;
use Illuminate\Http\JsonResponse;
use stdClass;

final class ContentController extends Controller
{
    public function page(string $slug): JsonResponse
    {
        $page = ContentPage::query()->where('slug', $slug)->first();

        if (! $page) {
            return api_error('content_page_not_found', 'Content page not found.', 404);
        }

        return response()->json([
            'rid' => $page->rid,
            'slug' => $page->slug,
            'title' => $page->title,
            'lastUpdated' => $page->last_updated,
            'intro' => $page->intro ?? [],
            'blocks' => $page->blocks ?? [],
        ]);
    }

    public function home(): JsonResponse
    {
        return response()->json($this->blockBody('home'));
    }

    public function footer(): JsonResponse
    {
        return response()->json($this->blockBody('footer'));
    }

    /**
     * @return array<string, mixed>|stdClass
     */
    private function blockBody(string $key): array|stdClass
    {
        $block = ContentBlock::query()->where('key', $key)->first();
        $payload = $block?->payload;

        if (! is_array($payload)) {
            return new stdClass;
        }

        return $payload;
    }
}
