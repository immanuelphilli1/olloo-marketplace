<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Category;
use App\Services\ProductQueryService;
use App\Support\StorefrontSeo;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

/**
 * The storefront pages crawlers and link previews read, served from the
 * published SPA build with their meta tags already in <head>. The gateway sends
 * only /, /categories, /categories/* and /products/* here and falls back to the
 * plain index.html when PHP errors, so a broken page costs meta tags, never the
 * shop. Every visitor gets the same HTML: no user-agent sniffing.
 *
 * Not in the web middleware group (routes/storefront.php): no session, cookie
 * or CSRF, so the home page renders even with the database down.
 */
final class StorefrontPageController extends Controller
{
    public function page(Request $request, StorefrontSeo $seo): Response
    {
        $path = (string) config('services.storefront.index_path');
        $html = is_file($path) ? file_get_contents($path) : false;
        if ($html === false) {
            Log::error('Storefront index.html is not readable from the app container; SEO pages cannot render.', ['path' => $path]);
            abort(503);
        }

        $meta = $seo->forPath('/'.$request->path());
        if ($meta === null) {
            abort(404);
        }

        return response(self::inject($html, $meta), $meta['status'], [
            'Content-Type' => 'text/html; charset=UTF-8',
            // Matches the gateway's index.html: a cached shell pins old chunks.
            'Cache-Control' => 'no-store',
        ]);
    }

    public function sitemap(StorefrontSeo $seo, ProductQueryService $products): Response
    {
        $urls = [
            ['loc' => $seo->canonical('/'), 'lastmod' => null],
            ['loc' => $seo->canonical('/categories'), 'lastmod' => null],
        ];

        foreach (Category::query()->where('is_active', true)->orderBy('sort_order')->get(['slug', 'updated_at']) as $category) {
            $urls[] = ['loc' => $seo->canonical('/categories/'.$category->slug), 'lastmod' => $category->updated_at];
        }

        // ponytail: one file, fine to the 50,000-URL sitemap limit; split into a sitemap index past that.
        foreach ($products->activeQuery()->orderBy('id')->get(['rid', 'updated_at']) as $product) {
            $urls[] = ['loc' => $seo->canonical('/products/'.$product->rid), 'lastmod' => $product->updated_at];
        }

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n".'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n";
        foreach ($urls as $url) {
            $xml .= '  <url><loc>'.e($url['loc']).'</loc>'
                .($url['lastmod'] ? '<lastmod>'.$url['lastmod']->toDateString().'</lastmod>' : '')
                ."</url>\n";
        }

        return response($xml."</urlset>\n", 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
    }

    /**
     * Never name the admin prefix here: robots.txt is public and the prefix is
     * the obscurity the staff portal relies on.
     */
    public function robots(StorefrontSeo $seo): Response
    {
        $lines = [
            'User-agent: *',
            'Disallow: /account',
            'Disallow: /cart',
            'Disallow: /checkout',
            'Disallow: /order-complete',
            'Disallow: /wishlist',
            'Disallow: /oauth/',
            'Disallow: /api/',
            '',
            'Sitemap: '.$seo->canonical('/sitemap.xml'),
        ];

        return response(implode("\n", $lines)."\n", 200, ['Content-Type' => 'text/plain; charset=UTF-8']);
    }

    /**
     * Swap the build's title, description, canonical and social tags for this
     * page's. Tags we write carry data-seo so the SPA can drop them once it
     * manages <head> itself.
     */
    public static function inject(string $html, array $meta): string
    {
        if (stripos($html, '</head>') === false) {
            Log::warning('Storefront index.html has no </head>; meta tags were not injected.');

            return $html;
        }

        $html = (string) preg_replace([
            '#<title\b[^>]*>.*?</title>\s*#is',
            '#<meta\s[^>]*(?:name|property)\s*=\s*["\'](?:description|robots|og:[^"\']*|twitter:[^"\']*)["\'][^>]*>\s*#i',
            '#<link\s[^>]*rel\s*=\s*["\']canonical["\'][^>]*>\s*#i',
            '#<script\s[^>]*type\s*=\s*["\']application/ld\+json["\'][^>]*>.*?</script>\s*#is',
        ], '', $html);

        $tag = fn (string $attr, string $key, ?string $value) => $value === null || $value === ''
            ? ''
            : '<meta '.$attr.'="'.e($key).'" content="'.e($value).'" data-seo>'."\n";

        $head = '<title data-seo>'.e($meta['title']).'</title>'."\n"
            .$tag('name', 'description', $meta['description'])
            .$tag('name', 'robots', $meta['robots'])
            .'<link rel="canonical" href="'.e($meta['canonical']).'" data-seo>'."\n"
            .$tag('property', 'og:site_name', (string) config('services.storefront.site_name'))
            .$tag('property', 'og:type', $meta['type'])
            .$tag('property', 'og:title', $meta['title'])
            .$tag('property', 'og:description', $meta['description'])
            .$tag('property', 'og:url', $meta['canonical'])
            .$tag('property', 'og:image', $meta['image'])
            .$tag('name', 'twitter:card', $meta['image'] ? 'summary_large_image' : 'summary')
            .$tag('name', 'twitter:title', $meta['title'])
            .$tag('name', 'twitter:description', $meta['description'])
            .$tag('name', 'twitter:image', $meta['image']);

        foreach ($meta['jsonLd'] as $data) {
            // HEX_TAG turns < and > into </>, so a product name cannot close the script.
            $head .= '<script type="application/ld+json" data-seo>'
                .json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
                .'</script>'."\n";
        }

        // substr_replace, not preg_replace: a "$1" in a product name is not a backreference.
        return substr_replace($html, $head, (int) stripos($html, '</head>'), 0);
    }
}
