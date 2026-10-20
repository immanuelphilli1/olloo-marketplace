<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\StorefrontSeo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The meta tags the server injects on first load, for the SPA to apply after a
 * client-side navigation. Same StorefrontSeo answer, so the two never differ.
 */
final class SeoController extends Controller
{
    public function show(Request $request, StorefrontSeo $seo): JsonResponse
    {
        $data = $request->validate(['path' => ['required', 'string', 'max:500']]);

        $meta = $seo->forPath($data['path']);
        if ($meta === null) {
            return api_error('seo_path_unknown', 'This path has no server-side meta tags.', 404);
        }

        return response()->json($meta);
    }
}
