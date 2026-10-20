<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ContentPage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ContentPageController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('view_cms'), 403);

        $pages = ContentPage::query()
            ->orderBy('slug')
            ->get()
            ->map(fn (ContentPage $page) => [
                'rid' => $page->rid,
                'slug' => $page->slug,
                'title' => $page->title,
                'lastUpdated' => $page->last_updated,
                'blocksCount' => is_array($page->blocks) ? count($page->blocks) : 0,
            ]);

        return Inertia::render('Admin/Cms/Index', [
            'pages' => $pages,
            'canEdit' => (bool) $request->user('staff')?->can('edit_cms'),
        ]);
    }

    public function edit(Request $request, ContentPage $page): Response
    {
        abort_unless($request->user('staff')?->can('edit_cms'), 403);

        return Inertia::render('Admin/Cms/Edit', [
            'page' => [
                'rid' => $page->rid,
                'slug' => $page->slug,
                'title' => $page->title,
                'lastUpdated' => $page->last_updated,
                'intro' => $page->intro,
                'blocks' => $page->blocks,
            ],
        ]);
    }

    public function update(Request $request, ContentPage $page): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('edit_cms'), 403);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', Rule::unique('content_pages', 'slug')->ignore($page->id)],
            'last_updated' => ['nullable', 'string', 'max:255'],
            'intro' => ['nullable', 'array'],
            'intro.*' => ['nullable', 'string', 'max:5000'],
            'blocks' => ['nullable', 'array'],
            'blocks.*.type' => ['required', 'string', Rule::in(['heading', 'paragraph', 'bullets'])],
            'blocks.*.text' => ['nullable', 'string', 'max:10000'],
            'blocks.*.items' => ['nullable', 'array'],
            'blocks.*.items.*' => ['nullable', 'string', 'max:2000'],
        ]);

        $page->update([
            'title' => $validated['title'],
            'slug' => $validated['slug'],
            'last_updated' => $validated['last_updated'] ?? $page->last_updated,
            'intro' => $this->normalizeIntro($validated['intro'] ?? []),
            'blocks' => $this->normalizeBlocks($validated['blocks'] ?? []),
        ]);

        return redirect()->route('admin.cms.index')->with('success', 'Page updated.');
    }

    /**
     * @param  list<mixed>  $intro
     * @return list<string>
     */
    private function normalizeIntro(array $intro): array
    {
        $lines = [];

        foreach ($intro as $line) {
            if (! is_string($line)) {
                continue;
            }

            $trimmed = trim($line);
            if ($trimmed === '') {
                continue;
            }

            $lines[] = $trimmed;
        }

        return $lines;
    }

    /**
     * @param  list<mixed>  $blocks
     * @return list<array{type: string, text?: string, items?: list<string>}>
     */
    private function normalizeBlocks(array $blocks): array
    {
        $normalized = [];

        foreach ($blocks as $block) {
            if (! is_array($block) || ! isset($block['type']) || ! is_string($block['type'])) {
                continue;
            }

            $type = $block['type'];

            if ($type === 'bullets') {
                $items = [];
                foreach ($block['items'] ?? [] as $item) {
                    if (! is_string($item)) {
                        continue;
                    }
                    $trimmed = trim($item);
                    if ($trimmed !== '') {
                        $items[] = $trimmed;
                    }
                }

                if ($items === []) {
                    continue;
                }

                $normalized[] = [
                    'type' => 'bullets',
                    'items' => $items,
                ];

                continue;
            }

            if (! in_array($type, ['heading', 'paragraph'], true)) {
                continue;
            }

            $text = isset($block['text']) && is_string($block['text']) ? trim($block['text']) : '';
            if ($text === '') {
                continue;
            }

            $normalized[] = [
                'type' => $type,
                'text' => $text,
            ];
        }

        return $normalized;
    }
}
