<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ShippingClass;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Shipping classes group products that ship differently (for example
 * "Bulky"). Shipping rules can target a class; products without one ship as
 * standard.
 */
final class ShippingClassController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('manage_shipping_settings'), 403);

        return Inertia::render('Admin/Settings/ShippingClasses/Index', [
            'classes' => ShippingClass::query()
                ->withCount(['products', 'rules'])
                ->orderBy('name')
                ->get()
                ->map(fn (ShippingClass $class) => [
                    'rid' => $class->rid,
                    'name' => $class->name,
                    'productsCount' => $class->products_count,
                    'rulesCount' => $class->rules_count,
                ]),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('manage_shipping_settings'), 403);

        $name = $this->validatedName($request);
        ShippingClass::query()->create(['name' => $name]);

        return back()->with('success', "Shipping class \"{$name}\" added. Add a shipping rule for it, then assign products.");
    }

    public function update(Request $request, ShippingClass $shippingClass): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('manage_shipping_settings'), 403);

        $shippingClass->update(['name' => $this->validatedName($request, $shippingClass)]);

        return back()->with('success', 'Shipping class renamed.');
    }

    public function destroy(Request $request, ShippingClass $shippingClass): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('manage_shipping_settings'), 403);

        $products = $shippingClass->products()->count();
        $rules = $shippingClass->rules()->count();
        if ($products > 0 || $rules > 0) {
            return back()->with('error', "\"{$shippingClass->name}\" is still used by {$products} products and {$rules} rules. Move them to another class first.");
        }

        $shippingClass->delete();

        return back()->with('success', "Shipping class \"{$shippingClass->name}\" deleted.");
    }

    private function validatedName(Request $request, ?ShippingClass $class = null): string
    {
        return trim($request->validate([
            'name' => ['required', 'string', 'max:80', Rule::unique('shipping_classes', 'name')->ignore($class?->id)],
        ], [
            'name.required' => 'Name the shipping class, for example "Bulky".',
            'name.unique' => 'Another shipping class already has this name.',
        ])['name']);
    }
}
