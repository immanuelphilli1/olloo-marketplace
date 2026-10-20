<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\Concerns\BuildsCheckout;
use Tests\TestCase;

/**
 * Every API route must point at a controller method that exists. Renames on
 * either side used to drift apart silently (the route only explodes at
 * runtime, e.g. CartController@moveToWishlist in production logs).
 */
final class RouteIntegrityTest extends TestCase
{
    use BuildsCheckout;
    use RefreshDatabase;

    public function test_every_api_route_maps_to_an_existing_controller_method(): void
    {
        $missing = [];

        foreach (Route::getRoutes() as $route) {
            $action = $route->getAction();
            if (! isset($action['controller']) || ! str_contains($action['controller'], '@')) {
                continue;
            }

            [$controller, $method] = explode('@', $action['controller']);
            if (str_starts_with($controller, 'App\\') && ! method_exists($controller, $method)) {
                $missing[] = implode('|', $route->methods()).' '.$route->uri().' -> '.$action['controller'];
            }
        }

        $this->assertSame([], $missing);
    }

    public function test_move_to_wishlist_moves_selected_lines(): void
    {
        $product = $this->seedCatalog();
        [, $token] = $this->customer();

        $this->addToCart($token, $product)->assertOk();

        $this->withToken($token)->postJson('/api/v1/cart/items/move-to-wishlist')
            ->assertOk()
            ->assertJsonCount(0, 'items');

        $this->withToken($token)->getJson('/api/v1/wishlist')
            ->assertOk()
            ->assertJsonPath('items.0.rid', $product->rid);
    }
}
