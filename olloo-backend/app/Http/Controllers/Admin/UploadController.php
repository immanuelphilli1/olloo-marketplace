<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Staff image uploads. Files land in storage/app/public (served through the
 * public/storage link) and only the path is stored on products/categories,
 * so the existing imageUrl handling keeps working. External URLs can still
 * be pasted into the same fields.
 */
final class UploadController extends Controller
{
    private const FOLDERS = ['products', 'categories', 'payment-methods', 'placements'];

    public function store(Request $request): JsonResponse
    {
        if (! $this->canUpload($request)) {
            return api_error('forbidden', 'You do not have permission to upload images.', 403);
        }

        $data = $request->validate([
            'image' => ['required', 'image', 'mimes:jpeg,png,webp', 'max:5120'],
            'folder' => ['nullable', 'string', 'in:'.implode(',', self::FOLDERS)],
        ], [
            'image.required' => 'Choose an image file first.',
            'image.image' => 'That file is not an image.',
            'image.mimes' => 'Use a JPEG, PNG, or WebP image.',
            'image.max' => 'Keep images under 5 MB.',
        ]);

        $folder = $data['folder'] ?? 'products';
        $stored = $request->file('image')->store("uploads/{$folder}", 'public');
        if ($stored === false) {
            return api_error('upload_failed', 'The image could not be saved. Try again.', 500);
        }

        $path = '/storage/'.$stored;

        return response()->json([
            'path' => $path,
            'url' => rtrim((string) config('app.url'), '/').$path,
        ], 201);
    }

    /**
     * Banner videos (the storefront's top video strip). MP4 or WebM only, and
     * small: a heavy or high-level H.264 file is what stopped the old strip from
     * autoplaying on some devices.
     */
    public function storeVideo(Request $request): JsonResponse
    {
        if (! $request->user('staff')?->can('edit_placements')) {
            return api_error('forbidden', 'You do not have permission to upload videos.', 403);
        }

        $request->validate([
            'video' => ['required', 'file', 'mimes:mp4,webm', 'max:20480'],
        ], [
            'video.required' => 'Choose a video file first.',
            'video.mimes' => 'Use an MP4 or WebM video.',
            'video.max' => 'Keep videos under 20 MB. A short loop of 2 MB or less loads fastest.',
        ]);

        $stored = $request->file('video')->store('uploads/placements', 'public');
        if ($stored === false) {
            return api_error('upload_failed', 'The video could not be saved. Try again.', 500);
        }

        $path = '/storage/'.$stored;

        return response()->json([
            'path' => $path,
            'url' => rtrim((string) config('app.url'), '/').$path,
        ], 201);
    }

    private function canUpload(Request $request): bool
    {
        $staff = $request->user('staff');

        return (bool) $staff?->canAny([
            'create_products',
            'edit_products',
            'create_categories',
            'edit_categories',
            'edit_placements',
        ]);
    }
}
