<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Product;
use App\Models\ProductImport;
use App\Services\ProductImport\ProductImageImporter;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Applies a reviewed ZIP of product photos.
 *
 * Unpacking a few hundred images and writing them to storage is well past what
 * a request should hold a worker for, so this runs on the queue. The staff
 * member watches their own run page instead of a spinner.
 *
 * The uploaded archive is owned by this job: it deletes it when finished, so a
 * failed run still cleans up after itself.
 */
final class ImportProductImages implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 1800;

    /** @var list<int> */
    public array $backoff = [30, 120];

    /**
     * @param  string  $archive  Path on the local disk, relative to its root.
     * @param  list<array<string, mixed>>  $files  Entries from the preview.
     * @param  array<string, string>  $choices  File name => main|sub, as staff answered.
     */
    public function __construct(
        public readonly int $productImportId,
        public readonly string $archive,
        public readonly array $files = [],
        public readonly array $choices = [],
    ) {}

    public function handle(ProductImageImporter $images): void
    {
        $import = ProductImport::query()->find($this->productImportId);
        if (! $import instanceof ProductImport || $import->isFinished()) {
            $this->cleanUp();

            return;
        }

        $import->markRunning();

        $path = Storage::disk('local')->path($this->archive);
        if (! is_file($path)) {
            $import->recordOutcome([], 'The uploaded ZIP was no longer on the server, so no photos were applied. Upload it again.');

            return;
        }

        $zip = new UploadedFile($path, 'images.zip', 'application/zip', null, true);

        $applied = 0;
        $skipped = 0;
        $report = [];

        foreach ($this->files as $file) {
            try {
                // A file with no prefix still needed a decision. Anything
                // unanswered is skipped and reported, never applied on a guess.
                $role = $file['role'] === 'undecided'
                    ? ($this->choices[(string) $file['name']] ?? '')
                    : $file['role'];

                if (! in_array($role, ['main', 'sub'], true)) {
                    $skipped++;
                    $report[] = $this->reportRow($file, 'skipped', $this->skipReason($file));

                    continue;
                }

                $result = $images->apply([
                    'entry' => $file['entry'],
                    'role' => $role,
                    // Plans carry the rid, not the numeric id.
                    'product' => $file['productRid'] === null
                        ? null
                        : Product::query()->where('rid', $file['productRid'])->first(),
                ], $zip);

                if ($result === 'Skipped' || $result === 'Could not save the file') {
                    $skipped++;
                    $report[] = $this->reportRow($file, 'skipped', $result);
                } else {
                    $applied++;
                    $report[] = $this->reportRow($file, 'applied', $result);
                }
            } catch (Throwable $e) {
                report($e);

                $skipped++;
                $report[] = $this->reportRow($file, 'failed', $e->getMessage());
            }
        }

        $import->forceFill([
            'created_count' => $applied,
            'updated_count' => $applied,
            'skipped_count' => $skipped,
            'failed_count' => count(array_filter($report, fn (array $row): bool => $row['outcome'] === 'failed')),
        ])->save();

        $import->recordOutcome($report);

        $this->cleanUp();
    }

    /**
     * The run failed outright. Any photos already applied stand, so the report
     * says how far it got rather than claiming nothing happened.
     */
    public function failed(Throwable $e): void
    {
        $import = ProductImport::query()->find($this->productImportId);

        if ($import instanceof ProductImport && ! $import->isFinished()) {
            report($e);

            $import->recordOutcome(
                is_array($import->report) ? $import->report : [],
                'The import stopped before it finished. Photos already applied were saved: '.$e->getMessage(),
            );
        }

        $this->cleanUp();
    }

    /**
     * @param  array<string, mixed>  $file
     */
    private function skipReason(array $file): string
    {
        return $file['productRid'] === null
            ? 'No product matched this file name, so it was skipped.'
            : 'This file had no main- or sub- prefix and you did not choose a role, so it was skipped.';
    }

    /**
     * @param  array<string, mixed>  $file
     * @return array<string, mixed>
     */
    private function reportRow(array $file, string $outcome, ?string $note): array
    {
        return [
            'name' => $file['name'],
            'line' => null,
            'outcome' => $outcome,
            'note' => $note,
            'productRid' => $file['productRid'] ?? null,
        ];
    }

    private function cleanUp(): void
    {
        Storage::disk('local')->delete($this->archive);
    }
}
