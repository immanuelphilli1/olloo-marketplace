<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\ImportProductImages;
use App\Jobs\ImportProductsFromCsv;
use App\Models\ProductImport;
use App\Services\ProductImport\ProductCsvImporter;
use App\Services\ProductImport\ProductImageImporter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

/**
 * Bulk product loading: a CSV for the product details, a zip of images for the
 * photos.
 *
 * Both work the same way. Staff upload a file, see exactly what will happen,
 * answer the questions only they can answer, then press one button to apply.
 * Nothing is written during the preview, and a failure part-way through leaves
 * the products that were already saved untouched rather than half changed.
 */
final class ProductImportController extends Controller
{
    /**
     * Previews hold parsed data and, for images, the uploaded archive itself.
     * A short life keeps a forgotten tab from becoming stale storage.
     */
    private const PREVIEW_TTL_MINUTES = 60;

    private const CSV_PREVIEW_KEY = 'admin.product-import.csv.';

    private const IMAGE_PREVIEW_KEY = 'admin.product-import.images.';

    private const IMAGE_TEMP_DIR = 'imports/product-images';

    public function __construct(
        private readonly ProductCsvImporter $csv,
        private readonly ProductImageImporter $images,
    ) {}

    public function csvIndex(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('create_products'), 403);

        return Inertia::render('Admin/Products/ImportCsv', [
            'columns' => collect(ProductCsvImporter::COLUMNS)
                ->map(fn (string $label, string $key): array => ['key' => $key, 'label' => $label])
                ->values()
                ->all(),
            'maxRows' => ProductCsvImporter::MAX_ROWS,
        ]);
    }

    public function csvTemplate(Request $request): mixed
    {
        abort_unless($request->user('staff')?->can('create_products'), 403);

        return response($this->csv->template(), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="product-import-template.csv"',
        ]);
    }

    /**
     * Read the CSV and show the plan. Deliberately does not save anything.
     */
    public function csvPreview(Request $request): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('create_products'), 403);

        $request->validate([
            'csv' => ['required', 'file', 'mimes:csv,txt', 'max:4096'],
        ], [
            'csv.required' => 'Choose a CSV file first.',
            'csv.mimes' => 'That is not a CSV file. Use the template we provide.',
            'csv.max' => 'That file is larger than 4 MB. Split it into smaller files.',
        ]);

        $contents = (string) file_get_contents((string) $request->file('csv')->getRealPath());
        $token = $this->storePreview(self::CSV_PREVIEW_KEY, ['filename' => $request->file('csv')->getClientOriginalName(), 'plans' => $this->serializePlans($this->csv->plan($contents))]);

        return redirect()->route('admin.products.import.csv.show', ['token' => $token]);
    }

    public function csvShow(Request $request, string $token): Response
    {
        abort_unless($request->user('staff')?->can('create_products'), 403);

        $preview = $this->preview(self::CSV_PREVIEW_KEY, $token);
        $plans = $preview['plans'] ?? [];
        $matched = ProductCsvImporter::matched($plans);
        $problems = ProductCsvImporter::problems($plans);

        return Inertia::render('Admin/Products/ImportCsvPreview', [
            'token' => $token,
            'filename' => $preview['filename'] ?? 'products.csv',
            'rows' => array_map(fn (array $plan): array => $this->planForUi($plan), $plans),
            'summary' => [
                'total' => count($plans),
                'create' => count(array_filter($plans, fn (array $plan): bool => $plan['action'] === 'create')),
                'update' => count($matched),
                'invalid' => count($problems),
            ],
            'matched' => array_map(fn (array $plan): array => [
                'index' => $plan['index'],
                'name' => $plan['name'],
                'matchedBy' => $plan['matched_by_label'],
            ], $matched),
        ]);
    }

    /**
     * Hand the plan to the queue.
     *
     * The decisions staff made are validated here, in the request, so a
     * refusal is immediate and specific. The writing itself happens in
     * ImportProductsFromCsv: a large file takes far longer than a request
     * should hold a worker for, and the staff member watches its own run rather
     * than staring at a spinner.
     */
    public function csvApply(Request $request, string $token): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('create_products'), 403);

        $preview = $this->preview(self::CSV_PREVIEW_KEY, $token);
        $choices = $request->input('choices', []);
        $choices = is_array($choices) ? $choices : [];

        foreach ($this->preview(self::CSV_PREVIEW_KEY, $token)['plans'] ?? [] as $plan) {
            if ($plan['action'] !== 'update') {
                continue;
            }

            $choice = (string) ($choices[(string) $plan['index']] ?? '');

            if ($choice === 'skip') {
                continue;
            }

            if ($choice !== 'update') {
                return back()->withErrors([
                    'choices' => 'Choose Update or Skip for every product that already exists, then press Import again.',
                ])->withInput();
            }

            if (! $request->user('staff')?->can('edit_products')) {
                return back()->withErrors([
                    'choices' => 'You need the edit products permission to change products that already exist.',
                ])->withInput();
            }
        }

        $import = ProductImport::query()->create([
            'user_id' => $request->user('staff')?->id,
            'kind' => ProductImport::KIND_CSV,
            'filename' => $preview['filename'] ?? 'products.csv',
            'status' => ProductImport::QUEUED,
        ]);

        $this->forgetPreview(self::CSV_PREVIEW_KEY, $token);

        ImportProductsFromCsv::dispatch(
            $import->id,
            $preview['plans'] ?? [],
            $this->normalizeChoices($choices),
        );

        return redirect()->route('admin.products.import.show', ['import' => $import->rid])
            ->with('success', 'Your import is queued. This page will update as it runs.');
    }

    /**
     * Choices arrive keyed by row index, which arrives as a string from the
     * form. Normalise so the job compares like with like.
     *
     * @param  array<mixed>  $choices
     * @return array<string, string>
     */
    private function normalizeChoices(array $choices): array
    {
        $normalized = [];
        foreach ($choices as $index => $choice) {
            $normalized[(string) $index] = (string) $choice;
        }

        return $normalized;
    }

    /** Recent runs, so a staff member can find a report they closed the tab over. */
    public function index(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('view_products'), 403);

        $imports = ProductImport::query()
            ->latest('id')
            ->limit(25)
            ->get()
            ->map(fn (ProductImport $import) => $this->serializeImport($import))
            ->all();

        return Inertia::render('Admin/Products/ImportIndex', ['imports' => $imports]);
    }

    /** One run, polled while it is in flight and readable afterwards. */
    public function show(Request $request, ProductImport $import): Response
    {
        abort_unless($request->user('staff')?->can('view_products'), 403);

        return Inertia::render('Admin/Products/ImportShow', [
            'import' => $this->serializeImport($import),
            'canCreate' => (bool) $request->user('staff')?->can('create_products'),
            // A queued run with no worker never starts. Say so plainly instead
            // of leaving a person watching a progress bar that will not move.
            'workerRunning' => (string) config('queue.default') !== 'sync',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeImport(ProductImport $import): array
    {
        return [
            'rid' => $import->rid,
            'kind' => $import->kind,
            'filename' => $import->filename,
            'status' => $import->status,
            'summary' => $import->summaryLabel(),
            'error' => $import->error,
            'duration' => $import->durationLabel(),
            'isFinished' => $import->isFinished(),
            'report' => array_slice($import->report ?? [], 0, ProductImport::MAX_REPORT_ROWS),
            'createdAt' => $import->created_at?->toIso8601String(),
            'finishedAt' => $import->finished_at?->toIso8601String(),
        ];
    }

    public function imagesIndex(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('edit_products'), 403);

        return Inertia::render('Admin/Products/ImportImages', [
            'examples' => $this->images->examples(),
            'maxFiles' => ProductImageImporter::MAX_FILES,
        ]);
    }

    public function imagesPreview(Request $request): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('edit_products'), 403);

        $validated = $request->validate([
            'images' => ['required', 'file', 'mimes:zip', 'max:20480'],
        ], [
            'images.required' => 'Choose a ZIP file first.',
            'images.mimes' => 'Upload a ZIP file containing your images.',
            'images.max' => 'That ZIP is larger than 20 MB. Upload it in smaller batches.',
        ]);

        $zip = $request->file('images');

        try {
            $this->images->assertArchiveIsSafe($zip);
        } catch (RuntimeException $e) {
            return back()->withErrors(['images' => $e->getMessage()])->withInput();
        }

        // Keep the archive so the confirm step reads the same bytes staff
        // previewed, rather than asking them to upload it twice.
        $stored = $zip->storeAs(self::IMAGE_TEMP_DIR, Str::random(32).'.zip', 'local');
        if ($stored === false) {
            return back()->withErrors(['images' => 'The file could not be saved. Try again.'])->withInput();
        }

        $plan = $this->images->plan($zip);

        if ($plan['files'] === []) {
            Storage::disk('local')->delete($stored);

            return back()->withErrors([
                'images' => 'That ZIP has no JPEG, PNG or WebP images in it.',
            ])->withInput();
        }

        $token = $this->storePreview(self::IMAGE_PREVIEW_KEY, [
            'archive' => $stored,
            'files' => $this->serializeImagePlan($plan['files']),
        ]);

        return redirect()->route('admin.products.import.images.show', ['token' => $token]);
    }

    public function imagesShow(Request $request, string $token): Response
    {
        abort_unless($request->user('staff')?->can('edit_products'), 403);

        $preview = $this->preview(self::IMAGE_PREVIEW_KEY, $token);
        $files = $preview['files'] ?? [];

        return Inertia::render('Admin/Products/ImportImagesPreview', [
            'token' => $token,
            'files' => array_map(fn (array $file): array => [
                'name' => $file['name'],
                'identifier' => $file['identifier'],
                'productName' => $file['productName'],
                'matchedBy' => $file['matched_by'],
                'role' => $file['role'],
                'suggestedRole' => $file['suggested_role'],
                'note' => $file['note'],
            ], $files),
            'summary' => [
                'total' => count($files),
                'matched' => count(array_filter($files, fn (array $file): bool => $file['productRid'] !== null)),
                'unmatched' => count(array_filter($files, fn (array $file): bool => $file['productRid'] === null)),
                'undecided' => count(array_filter($files, fn (array $file): bool => $file['role'] === 'undecided')),
            ],
        ]);
    }

    /**
     * Hand the ZIP to the queue. Unpacking and writing a few hundred images is
     * slow enough to time a request out, so it runs as ImportProductImages and
     * * the archive stays on disk until that job is done with it.
     */
    public function imagesApply(Request $request, string $token): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('edit_products'), 403);

        $preview = $this->preview(self::IMAGE_PREVIEW_KEY, $token);
        $choices = $request->input('choices', []);
        $choices = is_array($choices) ? $choices : [];

        // The job reads the archive from disk, so confirm it is still there
        // before promising the staff member it will run.
        if (! is_file(Storage::disk('local')->path($preview['archive']))) {
            $this->forgetPreview(self::IMAGE_PREVIEW_KEY, $token);

            return back()->withErrors(['images' => 'That upload has expired. Upload the ZIP again.']);
        }

        $import = ProductImport::query()->create([
            'user_id' => $request->user('staff')?->id,
            'kind' => ProductImport::KIND_IMAGES,
            'filename' => 'images.zip',
            'status' => ProductImport::QUEUED,
        ]);

        // The archive path moves with the job rather than being left in the
        // cache: the job may start long after the preview has expired.
        ImportProductImages::dispatch(
            $import->id,
            $preview['archive'],
            $preview['files'] ?? [],
            $this->normalizeChoices($choices),
        );

        $this->forgetPreview(self::IMAGE_PREVIEW_KEY, $token, forgetArchive: false);

        return redirect()->route('admin.products.import.show', ['import' => $import->rid])
            ->with('success', 'Your photos are queued. This page will update as they are applied.');
    }

    /**
     * Model instances are not cacheable, so the plan is stored as plain arrays
     * and the models are looked up again on apply.
     *
     * @param  list<array<string, mixed>>  $plans
     * @return list<array<string, mixed>>
     */
    private function serializePlans(array $plans): array
    {
        $serialized = [];

        foreach ($plans as $index => $plan) {
            $serialized[] = [
                'index' => $index,
                'line' => $plan['line'],
                'name' => $plan['name'],
                'slug' => $plan['slug'],
                'action' => $plan['action'],
                'matched_by' => $plan['matched_by'],
                'matched_by_label' => $this->matchedByLabel($plan['matched_by']),
                'product_rid' => $plan['product']?->rid,
                'product_name' => $plan['product']?->name,
                'variants' => $plan['variants'],
                'errors' => $plan['errors'],
                'warnings' => $plan['warnings'],
                'changes' => $plan['changes'],
                'values' => $plan['values'],
            ];
        }

        return $serialized;
    }

    /**
     * @param  list<array<string, mixed>>  $files
     * @return list<array<string, mixed>>
     */
    private function serializeImagePlan(array $files): array
    {
        return array_map(fn (array $file): array => [
            'name' => $file['name'],
            'entry' => $file['entry'],
            'identifier' => $file['identifier'],
            'role' => $file['role'],
            'suggested_role' => $file['suggested_role'],
            'note' => $file['note'],
            'productRid' => $file['product']?->rid,
            'productName' => $file['productName'],
            'matched_by' => $file['matched_by'],
        ], $files);
    }

    /**
     * @param  array<string, mixed>  $plan
     * @return array<string, mixed>
     */
    private function planForUi(array $plan): array
    {
        return [
            'index' => $plan['index'],
            'line' => $plan['line'],
            'name' => $plan['name'],
            'slug' => $plan['slug'],
            'action' => $plan['action'],
            'matchedBy' => $plan['matched_by_label'],
            'existingName' => $plan['product_name'],
            'variants' => array_map(fn (array $variant): array => [
                'name' => $variant['name'],
                'sku' => $variant['sku'],
                'price' => $variant['price_minor'] === null
                    ? null
                    : number_format($variant['price_minor'] / 100, 2),
                'stock' => $variant['stock_quantity'],
            ], $plan['variants']),
            'errors' => $plan['errors'],
            'warnings' => $plan['warnings'],
            'changes' => $plan['changes'],
        ];
    }

    /**
     * Which of the three ways a row found its product, in words. Staff who
     * matched on SKU should be able to see that, because it explains why the
     * row updated a product whose store link looks unrelated.
     */
    private function matchedByLabel(?string $matchedBy): ?string
    {
        return match ($matchedBy) {
            'product reference' => 'Matches an existing product reference',
            'SKU' => 'Matches the SKU of an existing option',
            'store link' => 'Matches an existing store link',
            default => null,
        };
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function storePreview(string $prefix, array $payload): string
    {
        $token = Str::random(40);
        Cache::put($prefix.$token, $payload, now()->addMinutes(self::PREVIEW_TTL_MINUTES));

        return $token;
    }

    /**
     * @return array<string, mixed>
     */
    private function preview(string $prefix, string $token): array
    {
        $payload = Cache::get($prefix.$token);

        abort_if(! is_array($payload), 404, 'That upload has expired. Upload the file again.');

        return $payload;
    }

    /**
     * Drop the cached preview. The ZIP is only deleted when nothing is waiting
     * on it: once a job has been handed the archive path, it owns the file and
     * removes it when it finishes.
     */
    private function forgetPreview(string $prefix, string $token, bool $forgetArchive = true): void
    {
        $payload = Cache::get($prefix.$token);
        Cache::forget($prefix.$token);

        if ($forgetArchive && is_array($payload) && isset($payload['archive'])) {
            Storage::disk('local')->delete($payload['archive']);
        }
    }
}
