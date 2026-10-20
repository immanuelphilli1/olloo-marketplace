<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\EmailLog\EmailLogRecorder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Serves the brand logo while recording an email open via path-token rid.
 */
final class MailBrandAssetController extends Controller
{
    public function __invoke(Request $request, string $rid, EmailLogRecorder $recorder): BinaryFileResponse|Response
    {
        // Staff admin sessions (preview iframe, Open raw, etc.) must not count as recipient opens.
        if (! Auth::guard('staff')->check()) {
            $recorder->markOpenedByRid($rid, $request);
        }

        $relative = (string) config('brand.logo.path', 'images/brand/handco-logo.png');
        $path = public_path($relative);

        if (! is_file($path)) {
            return response('', 404);
        }

        return response()->file($path, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'private, no-cache, no-store, must-revalidate, max-age=0',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }
}
