<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\InhousePlacement;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Storefront banners. Staff pick a slot (page + position) from a fixed list;
 * the storefront asks for a page and gets that page's active banners.
 */
class InhousePlacementController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('view_placements'), 403);

        $placements = InhousePlacement::query()->ordered()->get();

        return Inertia::render('Admin/Placements/Index', [
            'slots' => collect(InhousePlacement::slotKeys())->map(function (string $key) use ($placements) {
                [$page, $position] = explode('.', $key);

                return [
                    'page' => $page,
                    'position' => $position,
                    'label' => (new InhousePlacement(['page' => $page, 'position' => $position]))->slotLabel(),
                    'placements' => $placements
                        ->where('page', $page)
                        ->where('position', $position)
                        ->map(fn (InhousePlacement $placement) => $this->row($placement))
                        ->values()
                        ->all(),
                ];
            })->values()->all(),
            // Rows whose slot no longer exists in SLOTS, so they can still be deleted.
            'orphans' => $placements
                ->reject(fn (InhousePlacement $placement) => in_array($placement->page.'.'.$placement->position, InhousePlacement::slotKeys(), true))
                ->map(fn (InhousePlacement $placement) => $this->row($placement))
                ->values()
                ->all(),
            'canEdit' => (bool) $request->user('staff')?->can('edit_placements'),
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('edit_placements'), 403);

        $slot = (string) $request->query('slot', '');

        return Inertia::render('Admin/Placements/Create', [
            'slotOptions' => $this->slotOptions(),
            // Preselect only a real slot; anything else leaves the choice empty.
            'slot' => in_array($slot, InhousePlacement::slotKeys(), true) ? $slot : '',
            'videoSlots' => InhousePlacement::VIDEO_SLOTS,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('edit_placements'), 403);

        InhousePlacement::query()->create($this->validated($request));

        return redirect()->route('admin.placements.index')->with('success', 'Banner added.');
    }

    public function edit(Request $request, InhousePlacement $placement): Response
    {
        abort_unless($request->user('staff')?->can('edit_placements'), 403);

        return Inertia::render('Admin/Placements/Edit', [
            'placement' => [
                ...$this->row($placement),
                'slot' => $placement->page.'.'.$placement->position,
                'image' => $placement->image,
                'video' => $placement->video,
            ],
            'slotOptions' => $this->slotOptions(),
            'videoSlots' => InhousePlacement::VIDEO_SLOTS,
        ]);
    }

    public function update(Request $request, InhousePlacement $placement): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('edit_placements'), 403);

        $placement->update($this->validated($request));

        return redirect()->route('admin.placements.index')->with('success', 'Banner updated.');
    }

    public function destroy(Request $request, InhousePlacement $placement): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('edit_placements'), 403);

        $placement->delete();

        return redirect()->route('admin.placements.index')->with('success', 'Banner deleted.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        // An absolute URL or a storefront path such as /category/fashion.
        $urlOrPath = 'regex:#^(https?://|/)\S*$#';

        $isVideo = InhousePlacement::isVideoSlot((string) $request->input('slot'));

        $data = $request->validate([
            'slot' => ['required', 'string', Rule::in(InhousePlacement::slotKeys())],
            'image' => ['required', 'string', 'max:500', $urlOrPath],
            'video' => [Rule::requiredIf($isVideo), 'nullable', 'string', 'max:500', $urlOrPath],
            'alt_text' => ['nullable', 'string', 'max:160'],
            'title' => ['nullable', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'button_text' => ['nullable', 'string', 'max:40'],
            'link_url' => ['nullable', 'string', 'max:500', $urlOrPath],
            'sort_order' => ['required', 'integer', 'min:0', 'max:9999'],
            'is_active' => ['required', 'boolean'],
        ], [
            'slot.required' => 'Choose where the banner shows.',
            'slot.in' => 'Choose one of the listed places.',
            'image.required' => $isVideo
                ? 'Upload a poster image. Shoppers see it before the video plays and when their browser blocks autoplay.'
                : 'Upload an image or paste its URL.',
            'video.required' => 'Upload the video or paste its URL.',
            'video.regex' => 'Use an uploaded video or a full URL that starts with https://.',
            'image.regex' => 'Use an uploaded image or a full URL that starts with https://.',
            'link_url.regex' => 'Use a full URL (https://...) or a store path that starts with /, for example /category/fashion.',
        ]);

        [$data['page'], $data['position']] = explode('.', $data['slot']);
        unset($data['slot']);

        if ($isVideo) {
            // The strip shows no text; keep stale copy from an earlier slot out.
            $data['title'] = $data['description'] = $data['button_text'] = null;
        } else {
            $data['video'] = null;
        }

        return $data;
    }

    /**
     * @return array<string, mixed>
     */
    private function row(InhousePlacement $placement): array
    {
        return [
            'rid' => $placement->rid,
            'slotLabel' => $placement->slotLabel(),
            'imageUrl' => $placement->image_url,
            'videoUrl' => $placement->videoUrl(),
            'altText' => $placement->alt_text,
            'title' => $placement->title,
            'description' => $placement->description,
            'buttonText' => $placement->button_text,
            'linkUrl' => $placement->link_url,
            'sortOrder' => $placement->sort_order,
            'isActive' => $placement->is_active,
        ];
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function slotOptions(): array
    {
        return array_map(function (string $key): array {
            [$page, $position] = explode('.', $key);

            return ['value' => $key, 'label' => (new InhousePlacement(['page' => $page, 'position' => $position]))->slotLabel()];
        }, InhousePlacement::slotKeys());
    }
}
