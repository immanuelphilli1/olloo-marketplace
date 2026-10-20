<?php

declare(strict_types=1);

namespace App\Models\Concerns;

trait HasRid
{
    protected static function bootHasRid(): void
    {
        static::creating(function ($model): void {
            if (empty($model->rid)) {
                $model->rid = generate_rid();
            }
        });
    }

    public function getRouteKeyName(): string
    {
        return 'rid';
    }
}
