<?php

declare(strict_types=1);

namespace App\Support;

use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Streams a CSV download row by row, so a large catalog never sits in memory.
 * UTF-8 with a BOM so Excel opens accented names correctly, the same as the
 * import template.
 */
final class CsvExport
{
    /**
     * @param  list<string>  $columns
     * @param  iterable<array<string, string|int|null>>  $rows  keyed by column
     */
    public static function download(string $filename, array $columns, iterable $rows): StreamedResponse
    {
        return response()->streamDownload(static function () use ($columns, $rows): void {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, $columns);
            foreach ($rows as $row) {
                fputcsv($handle, array_map(static fn (string $column): string => self::cell($row[$column] ?? ''), $columns));
            }
            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * A cell starting with = + - or @ runs as a formula when the file is opened
     * in a spreadsheet, so a product named "=HYPERLINK(...)" would execute on a
     * colleague's machine. Prefix it with an apostrophe, which spreadsheets show
     * as text; ProductCsvImporter strips it again on the way back in.
     */
    public static function cell(string|int|null $value): string
    {
        $value = (string) $value;

        return preg_match('/^[=+\-@]/', $value) === 1 ? "'".$value : $value;
    }
}
