<?php

declare(strict_types=1);

namespace App\Services\ProductImport;

use App\Models\Product;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use ZipArchive;

/**
 * Matches image files to products by the name they were given.
 *
 * A file called `cotton-crew-t-shirt.jpg` belongs to the product whose store
 * link, product reference or any of its option SKUs is `cotton-crew-t-shirt`.
 * Staff do not need to know which of those three it matched.
 *
 * Two filename prefixes decide the role, because "which photo is the main
 * one" is the only judgement here that a human should make:
 *   main-cotton-crew-t-shirt.jpg  becomes the product's main photo
 *   sub-cotton-crew-t-shirt.jpg   is added to the gallery
 *   sub-cotton-crew-t-shirt-2.jpg also goes to the gallery: a trailing -2,
 *                                 _2 or (2) numbers several photos of one product
 * A file with neither prefix, where the product has more than one image, is
 * left for staff to decide rather than guessed.
 */
final class ProductImageImporter
{
    public const MAIN_PREFIX = 'main-';

    public const SUB_PREFIX = 'sub-';

    /** Mirrors the product form: main photo plus up to ten gallery images. */
    public const MAX_GALLERY = 10;

    /** One staff action should stay well inside a single request. */
    public const MAX_FILES = 500;

    private const MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;

    /**
     * @return list<string> The column headers, as they appear in the file names.
     */
    public function roles(): array
    {
        return [self::MAIN_PREFIX, self::SUB_PREFIX];
    }

    /**
     * Read the archive and work out, per file, which product it belongs to and
     * what would happen to it. Nothing is written here.
     *
     * @return array{files: list<array<string, mixed>>, products: int}
     */
    public function plan(UploadedFile $zip): array
    {
        $entries = $this->readArchive($zip);

        $files = [];
        $products = [];

        foreach ($entries as $entry) {
            $file = $this->inspect($entry);
            if ($file === null) {
                continue;
            }

            $files[] = $file;

            if ($file['product'] instanceof Product) {
                $products[(int) $file['product']->id] = true;
            }
        }

        return ['files' => $files, 'products' => count($products)];
    }

    /**
     * @param  array<string, mixed>  $plan  One entry from plan().
     * @return string What happened, in words staff can read in the report.
     */
    public function apply(array $plan, UploadedFile $zip): string
    {
        if ($plan['product'] === null || $plan['role'] === 'skip' || $plan['role'] === 'unmatched') {
            return 'Skipped';
        }

        /** @var Product $product */
        $product = $plan['product'];
        $stored = $this->storeFile($zip, $plan['entry']);

        if ($stored === null) {
            return 'Could not save the file';
        }

        $path = '/storage/'.$stored;

        DB::transaction(function () use ($product, $path, $plan): void {
            /** @var Product $fresh */
            $fresh = Product::query()->lockForUpdate()->find($product->id);

            if ($plan['role'] === 'main') {
                $fresh->update(['image' => $path]);
            }

            $this->addToGallery($fresh, $path);
        });

        return $plan['role'] === 'main' ? 'Set as the main photo' : 'Added to the gallery';
    }

    /**
     * Gallery images in order, capped the same way the product form caps them.
     * A file already in the gallery is moved to the end rather than duplicated.
     */
    private function addToGallery(Product $product, string $path): void
    {
        $existing = $product->images()->orderBy('sort_order')->orderBy('id')->get();
        $match = $existing->firstWhere('path', $path);

        if ($match) {
            $match->delete();
        }

        $kept = $existing->reject(fn ($image) => $image->path === $path)->values();
        $next = $kept->push($product->images()->create(['path' => $path, 'sort_order' => $kept->count()]));

        foreach ($next->take(self::MAX_GALLERY) as $position => $image) {
            if ((int) $image->sort_order !== $position) {
                $image->update(['sort_order' => $position]);
            }
        }

        $product->images()->whereNotIn('id', $next->take(self::MAX_GALLERY)->pluck('id'))->delete();
    }

    /**
     * @return array<string, mixed>|null
     */
    private function inspect(array $entry): ?array
    {
        $name = $entry['name'];
        $path = $entry['path'];
        $identifier = $entry['identifier'];
        $product = $this->matchProduct($identifier);

        $role = $entry['prefix'] === self::MAIN_PREFIX
            ? 'main'
            : ($entry['prefix'] === self::SUB_PREFIX ? 'sub' : 'undecided');

        if ($product === null) {
            return [
                'name' => $name,
                'entry' => $path,
                'identifier' => $identifier,
                'prefix' => $entry['prefix'],
                'product' => null,
                'productName' => null,
                'productRid' => null,
                'matched_by' => null,
                'role' => 'unmatched',
                'suggested_role' => null,
                'note' => $identifier === ''
                    ? 'This file name does not say which product it belongs to. Rename it to match a product.'
                    : "No product matches \"{$identifier}\". Rename the file to match a store link, product reference or SKU.",
            ];
        }

        if ($role === 'undecided') {
            return [
                'name' => $name,
                'entry' => $path,
                'identifier' => $identifier,
                'prefix' => '',
                'product' => $product,
                'productName' => $product->name,
                'productRid' => $product->rid,
                'matched_by' => $this->matchedBy($identifier, $product),
                'role' => 'undecided',
                'suggested_role' => $product->image === null ? 'main' : 'sub',
                'note' => 'Rename this file to start with main- or sub-, or choose what to do here.',
            ];
        }

        return [
            'name' => $name,
            'entry' => $path,
            'identifier' => $identifier,
            'prefix' => $entry['prefix'],
            'product' => $product,
            'productName' => $product->name,
            'productRid' => $product->rid,
            'matched_by' => $this->matchedBy($identifier, $product),
            'role' => $role,
            'suggested_role' => $role,
            'note' => $role === 'main' ? 'Replaces the current main photo.' : 'Added to the gallery.',
        ];
    }

    /**
     * Store link first, then the product reference, then any option SKU. A
     * staff member may know any one of the three and it should just work.
     */
    private function matchProduct(string $identifier): ?Product
    {
        // Several gallery photos of one product cannot share a file name, so
        // they are numbered. The exact name wins, so a SKU that ends in a
        // number still matches itself first.
        return $this->findProduct($identifier)
            ?? $this->findProduct($this->withoutNumber($identifier));
    }

    private function withoutNumber(string $identifier): string
    {
        return (string) preg_replace('/(?:[-_ ]\d{1,2}| ?\(\d{1,2}\))$/', '', $identifier);
    }

    private function findProduct(string $identifier): ?Product
    {
        if ($identifier === '') {
            return null;
        }

        $bySlug = Product::query()->where('slug', $identifier)->first();
        if ($bySlug instanceof Product) {
            return $bySlug;
        }

        $byRid = Product::query()->where('rid', $identifier)->first();
        if ($byRid instanceof Product) {
            return $byRid;
        }

        return Product::query()
            ->whereHas('variants', fn (Builder $query) => $query->where('sku', Str::upper($identifier)))
            ->first();
    }

    private function matchedBy(string $identifier, Product $product): string
    {
        if (in_array($product->slug, [$identifier, $this->withoutNumber($identifier)], true)) {
            return 'store link';
        }

        if (in_array($product->rid, [$identifier, $this->withoutNumber($identifier)], true)) {
            return 'product reference';
        }

        return 'SKU';
    }

    /**
     * @return list<array{name: string, identifier: string, prefix: string, path: string}>
     */
    private function readArchive(UploadedFile $zip): array
    {
        $path = $zip->getRealPath();
        if ($path === false) {
            return [];
        }

        $archive = new ZipArchive;
        if ($archive->open($path) !== true) {
            return [];
        }

        $entries = [];
        for ($index = 0; $index < $archive->numFiles && count($entries) < self::MAX_FILES; $index++) {
            $stat = $archive->statIndex($index);
            if ($stat === false) {
                continue;
            }

            $name = (string) $stat['name'];

            // ZipArchive::statIndex has no is_dir flag; directory entries are
            // the ones whose name ends in a separator.
            if (str_ends_with($name, '/')) {
                continue;
            }

            // Ignore resource forks and other zip noise rather than reporting
            // every one of them as a file staff have to classify.
            if (str_starts_with($name, '__MACOSX/') || str_contains($name, '/.')) {
                continue;
            }

            if (! $this->isAllowedImage($name)) {
                continue;
            }

            if ((int) $stat['size'] > 5120 * 1024) {
                continue;
            }

            // Zipping a folder puts every file under that folder's name, so the
            // product is read from the file name but extracted by its full path.
            $entries[] = $this->splitName(basename($name)) + ['path' => $name];
        }

        $archive->close();

        return $entries;
    }

    /**
     * @return array{name: string, identifier: string, prefix: string}
     */
    private function splitName(string $filename): array
    {
        $name = pathinfo($filename, PATHINFO_FILENAME);
        $prefix = '';

        foreach ([self::MAIN_PREFIX, self::SUB_PREFIX] as $candidate) {
            if (Str::startsWith(Str::lower($name), $candidate)) {
                $prefix = $candidate;
                $name = substr($name, strlen($candidate));

                break;
            }
        }

        return ['name' => $filename, 'identifier' => $name, 'prefix' => $prefix];
    }

    private function isAllowedImage(string $name): bool
    {
        return in_array(
            strtolower(pathinfo($name, PATHINFO_EXTENSION)),
            ['jpg', 'jpeg', 'png', 'webp'],
            true,
        );
    }

    /**
     * Copy the entry out of the archive into the public uploads folder using
     * the same disk and layout the single-image upload uses.
     */
    private function storeFile(UploadedFile $zip, string $entry): ?string
    {
        $path = $zip->getRealPath();
        if ($path === false) {
            return null;
        }

        $archive = new ZipArchive;
        if ($archive->open($path) !== true) {
            return null;
        }

        $contents = $archive->getFromName($entry);
        $archive->close();

        if ($contents === false) {
            return null;
        }

        $extension = strtolower(pathinfo($entry, PATHINFO_EXTENSION));
        $name = Str::random(40).'.'.$extension;

        $stored = Storage::disk('public')->put('uploads/products/'.$name, $contents);

        return $stored === false ? null : 'uploads/products/'.$name;
    }

    /**
     * Reject an archive before unzipping anything, so a staff upload cannot
     * fill the disk with a zip bomb.
     */
    public function assertArchiveIsSafe(UploadedFile $zip): void
    {
        $path = $zip->getRealPath();
        if ($path === false) {
            return;
        }

        $archive = new ZipArchive;
        if ($archive->open($path) !== true) {
            return;
        }

        $total = 0;
        for ($index = 0; $index < $archive->numFiles; $index++) {
            $stat = $archive->statIndex($index);
            $total += $stat === false ? 0 : (int) $stat['size'];
        }
        $archive->close();

        if ($total > self::MAX_UNCOMPRESSED_BYTES) {
            throw new \RuntimeException('This archive expands to more than 512 MB once unpacked. Upload fewer or smaller images.');
        }
    }

    /**
     * A worked example of the naming rules, for the upload screen.
     *
     * @return list<array{file: string, maps: string, effect: string}>
     */
    public function examples(): array
    {
        return [
            [
                'file' => 'cotton-crew-t-shirt.jpg',
                'maps' => 'the product whose store link is cotton-crew-t-shirt',
                'effect' => 'Asks you whether this is the main photo or a gallery photo.',
            ],
            [
                'file' => 'main-cotton-crew-t-shirt.jpg',
                'maps' => 'the same product',
                'effect' => 'Becomes the main photo.',
            ],
            [
                'file' => 'sub-cotton-crew-t-shirt.jpg',
                'maps' => 'the same product',
                'effect' => 'Added to the gallery.',
            ],
            [
                'file' => 'sub-cotton-crew-t-shirt-2.jpg',
                'maps' => 'the same product',
                'effect' => 'Also added to the gallery. Number the photos to send more than one.',
            ],
            [
                'file' => 'main-TEE-CREW-STD.jpg',
                'maps' => 'the product with option SKU TEE-CREW-STD',
                'effect' => 'Becomes that product\'s main photo.',
            ],
        ];
    }
}
