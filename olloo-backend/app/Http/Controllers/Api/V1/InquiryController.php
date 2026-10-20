<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\NotifyInquirySubmitted;
use App\Models\Inquiry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class InquiryController extends Controller
{
    public function partnership(Request $request): JsonResponse
    {
        return $this->storeInquiry($request, 'partnership', [
            'email' => ['required', 'email', 'max:255'],
            'name' => ['required', 'string', 'max:120'],
            'company' => ['nullable', 'string', 'max:160'],
            'message' => ['nullable', 'string', 'max:5000'],
            'website' => ['nullable', 'string', 'max:255'],
        ]);
    }

    public function quotation(Request $request): JsonResponse
    {
        return $this->storeInquiry($request, 'quotation', [
            'email' => ['required', 'email', 'max:255'],
            'name' => ['required', 'string', 'max:120'],
            'company' => ['nullable', 'string', 'max:160'],
            'phone' => ['nullable', 'string', 'max:40'],
            'message' => ['nullable', 'string', 'max:5000'],
            'productIds' => ['nullable', 'array'],
            'productIds.*' => ['string'],
        ]);
    }

    public function agent(Request $request): JsonResponse
    {
        return $this->storeInquiry($request, 'agent', [
            'email' => ['required', 'email', 'max:255'],
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'message' => ['nullable', 'string', 'max:5000'],
            'orderId' => ['nullable', 'string', 'max:80'],
        ]);
    }

    /**
     * @param  array<string, list<string>>  $rules
     */
    private function storeInquiry(Request $request, string $type, array $rules): JsonResponse
    {
        $data = $request->validate($rules);

        $inquiry = Inquiry::query()->create([
            'type' => $type,
            'email' => $data['email'],
            'name' => $data['name'],
            'payload' => collect($data)->except(['email', 'name'])->all(),
        ]);

        NotifyInquirySubmitted::dispatch($inquiry->id);

        return response()->json([
            'success' => true,
            'rid' => $inquiry->rid,
            'type' => $inquiry->type,
        ], 201);
    }
}
