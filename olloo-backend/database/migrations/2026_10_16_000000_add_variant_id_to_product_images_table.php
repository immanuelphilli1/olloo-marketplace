<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A gallery image can show one variant (the red one, say), so the storefront
 * slides to it when the shopper picks that variant. The image stays in the
 * product's one gallery list; deleting the variant keeps the image untagged.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Two guarded steps: MySQL DDL is not transactional, so a failed FK
        // must not leave a column that makes a re-run skip the constraint.
        if (! Schema::hasColumn('product_images', 'variant_id')) {
            Schema::table('product_images', function (Blueprint $table): void {
                $table->unsignedBigInteger('variant_id')->nullable()->after('product_id');
            });
        }

        if (! $this->hasVariantForeignKey()) {
            Schema::table('product_images', function (Blueprint $table): void {
                $table->foreign('variant_id')->references('id')->on('product_variants')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('product_images', 'variant_id')) {
            return;
        }

        Schema::table('product_images', function (Blueprint $table): void {
            if ($this->hasVariantForeignKey()) {
                $table->dropForeign(['variant_id']);
            }
            $table->dropColumn('variant_id');
        });
    }

    private function hasVariantForeignKey(): bool
    {
        return collect(Schema::getForeignKeys('product_images'))
            ->contains(fn (array $key): bool => $key['columns'] === ['variant_id']);
    }
};
