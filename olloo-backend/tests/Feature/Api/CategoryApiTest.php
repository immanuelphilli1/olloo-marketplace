<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\Category;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class CategoryApiTest extends TestCase
{
    use RefreshDatabase;

    private function seedTree(): void
    {
        $fashion = Category::query()->create([
            'slug' => 'fashion',
            'label' => 'Fashion',
            'sort_order' => 10,
            'is_active' => true,
        ]);

        $shoes = Category::query()->create([
            'slug' => 'fashion-shoes',
            'label' => 'Shoes',
            'parent_id' => $fashion->id,
            'sort_order' => 10,
            'is_active' => true,
        ]);

        Category::query()->create([
            'slug' => 'fashion-shoes-sneakers',
            'label' => 'Sneakers',
            'parent_id' => $shoes->id,
            'sort_order' => 10,
            'is_active' => true,
        ]);
    }

    public function test_index_returns_children_without_subcategories_alias(): void
    {
        $this->seedTree();

        $response = $this->getJson('/api/v1/categories')->assertOk();
        $fashion = collect($response->json('categories'))->firstWhere('slug', 'fashion');

        $this->assertSame('Shoes', $fashion['children'][0]['label']);
        $this->assertSame('Sneakers', $fashion['children'][0]['children'][0]['label']);
        $this->assertArrayNotHasKey('subcategories', $fashion);
        $this->assertArrayNotHasKey('subcategories', $fashion['children'][0]);
    }

    public function test_index_depth_limits_levels(): void
    {
        $this->seedTree();

        $response = $this->getJson('/api/v1/categories?depth=1')->assertOk();
        $fashion = collect($response->json('categories'))->firstWhere('slug', 'fashion');

        $this->assertSame('Shoes', $fashion['children'][0]['label']);
        $this->assertSame([], $fashion['children'][0]['children']);
    }

    public function test_index_depth_zero_omits_children(): void
    {
        $this->seedTree();

        $response = $this->getJson('/api/v1/categories?depth=0')->assertOk();
        $fashion = collect($response->json('categories'))->firstWhere('slug', 'fashion');

        $this->assertSame([], $fashion['children']);
    }

    public function test_show_returns_single_category_with_children(): void
    {
        $this->seedTree();
        $shoes = Category::query()->where('slug', 'fashion-shoes')->firstOrFail();

        $response = $this->getJson("/api/v1/categories/{$shoes->rid}")->assertOk();

        $this->assertSame('fashion-shoes', $response->json('slug'));
        $this->assertSame('Sneakers', $response->json('children.0.label'));

        $this->getJson('/api/v1/categories/fashion-shoes?depth=0')->assertOk()->assertJsonPath('children', []);
    }

    public function test_panel_has_no_subcategories_alias(): void
    {
        $this->seedTree();
        $shoes = Category::query()->where('slug', 'fashion-shoes')->firstOrFail();

        $response = $this->getJson("/api/v1/categories/{$shoes->rid}/panel")->assertOk();

        $this->assertSame('fashion', $response->json('parent.slug'));
        $this->assertSame('Sneakers', $response->json('children.0.label'));
        $this->assertArrayNotHasKey('subcategories', $response->json());
    }

    public function test_panel_depth_zero_omits_children(): void
    {
        $this->seedTree();
        $shoes = Category::query()->where('slug', 'fashion-shoes')->firstOrFail();

        $response = $this->getJson("/api/v1/categories/{$shoes->rid}/panel?depth=0")->assertOk();

        $this->assertSame([], $response->json('children'));
        $this->assertSame([], $response->json('sections.0.children'));
    }

    public function test_image_url_is_absolute_and_null_safe(): void
    {
        $this->seedTree();
        $host = rtrim((string) config('app.url'), '/');

        Category::query()->where('slug', 'fashion-shoes')->update(['image' => '/images/categories/fashion-shoes.jpg']);

        $response = $this->getJson('/api/v1/categories/fashion-shoes')->assertOk();
        $this->assertSame($host.'/images/categories/fashion-shoes.jpg', $response->json('imageUrl'));

        $response = $this->getJson('/api/v1/categories/fashion')->assertOk();
        $this->assertNull($response->json('imageUrl'));
    }
}
