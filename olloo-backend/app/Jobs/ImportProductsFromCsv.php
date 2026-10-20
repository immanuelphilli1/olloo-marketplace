<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Product;
use App\Models\ProductImport;
use App\Services\ProductImport\ProductCsvImporter;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Writes a reviewed product CSV.
 *
 * The staff member's update/skip decisions are already recorded: the request
 * refused the run outright if any matched row had no answer, so by the time
 * this job starts every decision is explicit and a missing key here can only
 * mean "skip", never "overwrite because the key was absent".
 *
 * Each row commits on its own. One product that fails must not undo the
 * hundreds that already saved, so the whole job is never wrapped in a single
 * transaction.
 */
final class ImportProductsFromCsv implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 900;

    /** @var list<int> */
    public array $backoff = [30, 120];

    /**
     * @param  list<array<string, mixed>>  $plans  Rows the preview produced.
     * @param  array<string, string>  $choices  Row index => update|skip, as staff answered.
     */
    public function __construct(
        public readonly int $productImportId,
        public readonly array $plans,
        public readonly array $choices = [],
    ) {}

    public function handle(ProductCsvImporter $csv): void
    {
        $import = ProductImport::query()->find($this->productImportId);
        if (! $import instanceof ProductImport || $import->isFinished()) {
            // Already applied or already reported: do not run twice.
            return;
        }

        $import->markRunning();

        $created = 0;
        $updated = 0;
        $skipped = 0;
        $report = [];

        foreach ($this->plans as $plan) {
            try {
                if ($plan['action'] === 'invalid') {
                    $skipped++;
                    $report[] = $this->reportRow($plan, 'skipped', implode(' ', $plan['errors']));

                    continue;
                }

                if ($plan['action'] === 'update') {
                    $choice = $this->choices[(string) $plan['index']] ?? 'skip';

                    if ($choice !== 'update') {
                        $skipped++;
                        $report[] = $this->reportRow($plan, 'skipped', 'You chose to skip this one.');

                        continue;
                    }
                }

                $csv->apply($this->rehydrate($plan));

                if ($plan['action'] === 'create') {
                    $created++;
                    $report[] = $this->reportRow($plan, 'created', null);
                } else {
                    $updated++;
                    $report[] = $this->reportRow($plan, 'applied', null);
                }
            } catch (Throwable $e) {
                report($e);

                $report[] = $this->reportRow($plan, 'failed', $e->getMessage());
            }
        }

        $import->forceFill([
            'created_count' => $created,
            'updated_count' => $updated,
            'skipped_count' => $skipped,
            'failed_count' => count(array_filter($report, fn (array $row): bool => $row['outcome'] === 'failed')),
        ])->save();

        $import->recordOutcome($report);
    }

    /**
     * A failure that stops the run itself, not one row. Recorded as failed so
     * the staff member is never shown a clean finish for a partial import.
     */
    public function failed(Throwable $e): void
    {
        $import = ProductImport::query()->find($this->productImportId);
        if (! $import instanceof ProductImport || $import->isFinished()) {
            return;
        }

        report($e);

        $import->recordOutcome(
            is_array($import->report) ? $import->report : [],
            'The import stopped before it finished. Nothing after this point was saved: '.$e->getMessage(),
        );
    }

    /**
     * @param  array<string, mixed>  $plan
     * @return array<string, mixed>
     */
    private function rehydrate(array $plan): array
    {
        return [
            'values' => $plan['values'],
            'variants' => $plan['variants'],
            'product' => $plan['product_rid'] === null
                ? null
                : Product::query()->where('rid', $plan['product_rid'])->first(),
        ];
    }

    /**
     * @param  array<string, mixed>  $plan
     * @return array<string, mixed>
     */
    private function reportRow(array $plan, string $outcome, ?string $note): array
    {
        return [
            'name' => $plan['name'],
            'line' => $plan['line'],
            'outcome' => $outcome,
            'note' => $note,
            'productRid' => $plan['product_rid'] ?? null,
        ];
    }
}
