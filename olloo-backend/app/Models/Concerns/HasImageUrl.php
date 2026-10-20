<?php

declare(strict_types=1);

namespace App\Models\Concerns;

trait HasImageUrl
{
    /**
     * Absolute URL for the model's image, built from config app.url.
     * Exposed as `imageUrl` via $appends. Null when no image is set.
     */
    public function getImageUrlAttribute(): ?string
    {
        return $this->absoluteUrlFor($this->getAttribute($this->imageUrlColumn()));
    }

    /**
     * Absolute URL for any stored path: null when blank, untouched when
     * already absolute, otherwise built from config app.url.
     */
    protected function absoluteUrlFor(mixed $path): ?string
    {
        if (! is_string($path) || trim($path) === '') {
            return null;
        }

        $path = trim($path);

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        return rtrim((string) config('app.url'), '/').'/'.ltrim($path, '/');
    }

    protected function imageUrlColumn(): string
    {
        return 'image';
    }
}
