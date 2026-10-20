<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsCheckout;
use Tests\TestCase;

final class StorefrontSeoTest extends TestCase
{
    use BuildsCheckout;
    use RefreshDatabase;

    private string $index;

    protected function setUp(): void
    {
        parent::setUp();

        $this->index = tempnam(sys_get_temp_dir(), 'spa');
        file_put_contents($this->index, '<!doctype html><html><head><meta charset="UTF-8"><meta name="description" content="DEFAULT"><title>H&CO.</title></head><body><div id="root">SPA</div></body></html>');
        config([
            'services.storefront.index_path' => $this->index,
            'services.storefront.url' => 'https://shop.test',
            'services.storefront.site_name' => 'H&CO.',
        ]);
    }

    protected function tearDown(): void
    {
        @unlink($this->index);
        parent::tearDown();
    }

    public function test_product_page_carries_its_meta_tags_without_javascript(): void
    {
        $product = $this->seedCatalog();
        $product->update(['name' => 'Earbuds </script><b>$1', 'description_lines' => ['Active noise cancellation.', 'Thirty hours of battery.']]);

        $html = $this->get('/products/'.$product->rid)->assertOk()->assertHeader('Cache-Control', 'no-store, private')->getContent();

        $this->assertStringContainsString('<title data-seo>Earbuds &lt;/script&gt;&lt;b&gt;$1 | H&amp;CO.</title>', $html);
        $this->assertStringContainsString('<meta name="description" content="Active noise cancellation. Thirty hours of battery." data-seo>', $html);
        $this->assertStringContainsString('<link rel="canonical" href="https://shop.test/products/'.$product->rid.'" data-seo>', $html);
        $this->assertStringContainsString('<meta property="og:image" content="'.$product->image_url.'" data-seo>', $html);
        $this->assertStringContainsString('"@type":"Product"', $html);
        // The build's own title and description are replaced, not duplicated.
        $this->assertSame(1, substr_count($html, '<title'));
        $this->assertStringNotContainsString('DEFAULT', $html);
        // A product name cannot close the JSON-LD script early.
        $this->assertSame(substr_count($html, '<script'), substr_count($html, '</script>'));
        $this->assertStringContainsString('<div id="root">SPA</div>', $html);
    }

    public function test_unknown_or_inactive_pages_are_real_404s_with_the_spa_body(): void
    {
        $product = $this->seedCatalog();
        $product->update(['is_active' => false]);

        $this->get('/products/'.$product->rid)->assertNotFound()->assertSee('noindex', false)->assertSee('<div id="root">SPA</div>', false);
        $this->get('/categories/nope')->assertNotFound();
    }

    public function test_category_page_canonicalises_a_rid_to_the_slug(): void
    {
        $category = $this->seedCatalog()->category;

        $this->get('/categories/'.$category->rid)
            ->assertOk()
            ->assertSee('<title data-seo>Electronics | H&amp;CO.</title>', false)
            ->assertSee('<link rel="canonical" href="https://shop.test/categories/electronics" data-seo>', false);
    }

    public function test_api_returns_the_same_meta_for_client_side_navigation(): void
    {
        $product = $this->seedCatalog();

        $this->getJson('/api/v1/seo?path=/products/'.$product->rid.'?from=home')
            ->assertOk()
            ->assertJsonPath('title', 'AeroSmart Wireless Earbuds | H&CO.')
            ->assertJsonPath('canonical', 'https://shop.test/products/'.$product->rid)
            ->assertJsonPath('type', 'product');

        $this->getJson('/api/v1/seo?path=/cart')->assertNotFound()->assertJsonPath('error.code', 'seo_path_unknown');
    }

    public function test_sitemap_lists_active_products_and_robots_points_to_it(): void
    {
        $product = $this->seedCatalog();
        $hidden = $this->seedCatalog();
        $hidden->update(['is_active' => false]);

        $this->get('/sitemap.xml')
            ->assertOk()
            ->assertSee('<loc>https://shop.test/products/'.$product->rid.'</loc>', false)
            ->assertSee('<loc>https://shop.test/categories/electronics</loc>', false)
            ->assertDontSee($hidden->rid);

        $this->get('/robots.txt')->assertOk()->assertSee('Sitemap: https://shop.test/sitemap.xml')
            ->assertDontSee((string) config('admin.path_prefix'));
    }
}
