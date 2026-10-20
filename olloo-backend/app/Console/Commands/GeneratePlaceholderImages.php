<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Console\Command;

class GeneratePlaceholderImages extends Command
{
    protected $signature = 'images:placeholders';

    protected $description = 'Generate branded placeholder JPEGs for any missing public product/category image files referenced by the database.';

    public function handle(): int
    {
        $paths = collect()
            ->merge(Category::query()->pluck('image'))
            ->merge(Product::query()->pluck('image'))
            ->merge(ProductImage::query()->pluck('path'))
            ->filter(fn ($path): bool => is_string($path) && str_starts_with($path, '/images/'))
            ->unique()
            ->values();

        $made = 0;
        foreach ($paths as $path) {
            $file = public_path(ltrim($path, '/'));
            if (file_exists($file)) {
                continue;
            }

            $dir = dirname($file);
            if (! is_dir($dir)) {
                mkdir($dir, 0755, true);
            }

            $this->renderPlaceholder($file, (string) pathinfo($file, PATHINFO_FILENAME));
            $made++;
        }

        $this->info("Placeholder images generated: {$made} (".count($paths).' referenced).');

        return self::SUCCESS;
    }

    private function renderPlaceholder(string $file, string $label): void
    {
        $img = imagecreatetruecolor(800, 800);
        $bg = imagecolorallocate($img, 240, 238, 235);
        $fg = imagecolorallocate($img, 90, 90, 100);
        $accent = imagecolorallocate($img, 30, 30, 34);
        imagefill($img, 0, 0, $bg);
        imagerectangle($img, 40, 40, 760, 760, $accent);

        $font = 5;
        $brand = 'H&CO';
        imagestring($img, $font, (int) ((800 - imagefontwidth($font) * strlen($brand)) / 2), 330, $brand, $accent);

        $y = 380;
        foreach (array_chunk(explode('-', $label), 3) as $line) {
            $text = implode(' ', $line);
            imagestring($img, $font, (int) max(0, (800 - imagefontwidth($font) * strlen($text)) / 2), $y, $text, $fg);
            $y += 30;
        }

        imagejpeg($img, $file, 82);
        imagedestroy($img);
    }
}
