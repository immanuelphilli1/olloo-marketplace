<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $tree = [
            [
                'slug' => 'electronics',
                'label' => 'Electronics & Tech',
                'sort_order' => 10,
                'children' => [
                    ['slug' => 'electronics-headphones-audio', 'label' => 'Headphones & Audio', 'image' => '/images/categories/electronics-headphones-audio.jpg'],
                    ['slug' => 'electronics-phones-tablets', 'label' => 'Phones & Tablets', 'image' => '/images/categories/electronics-phones-tablets.jpg'],
                    ['slug' => 'electronics-wearables', 'label' => 'Wearables', 'image' => '/images/categories/electronics-wearables.jpg'],
                    [
                        'slug' => 'electronics-computers',
                        'label' => 'Computers',
                        'image' => '/images/categories/electronics-computers.jpg',
                        'children' => [
                            [
                                'slug' => 'electronics-computers-laptops',
                                'label' => 'Laptops',
                                'image' => '/images/categories/electronics-computers-laptops.jpg',
                                'children' => [
                                    ['slug' => 'electronics-laptops-gaming', 'label' => 'Gaming Laptops', 'image' => '/images/categories/electronics-laptops-gaming.jpg'],
                                    ['slug' => 'electronics-laptops-ultrabooks', 'label' => 'Ultrabooks', 'image' => '/images/categories/electronics-laptops-ultrabooks.jpg'],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
            [
                'slug' => 'fashion',
                'label' => 'Fashion',
                'sort_order' => 20,
                'children' => [
                    ['slug' => 'fashion-men', 'label' => 'Men', 'image' => '/images/categories/fashion-men.jpg'],
                    ['slug' => 'fashion-women', 'label' => 'Women', 'image' => '/images/categories/fashion-women.jpg'],
                    ['slug' => 'fashion-kids', 'label' => 'Kids', 'image' => '/images/categories/fashion-kids.jpg'],
                    [
                        'slug' => 'fashion-shoes',
                        'label' => 'Shoes',
                        'image' => '/images/categories/fashion-shoes.jpg',
                        'children' => [
                            [
                                'slug' => 'fashion-shoes-sneakers',
                                'label' => 'Sneakers',
                                'image' => '/images/categories/fashion-shoes-sneakers.jpg',
                                'children' => [
                                    ['slug' => 'fashion-sneakers-running', 'label' => 'Running', 'image' => '/images/categories/fashion-sneakers-running.jpg'],
                                    ['slug' => 'fashion-sneakers-court', 'label' => 'Court Classics', 'image' => '/images/categories/fashion-sneakers-court.jpg'],
                                ],
                            ],
                            ['slug' => 'fashion-shoes-formal', 'label' => 'Formal Shoes', 'image' => '/images/categories/fashion-shoes-formal.jpg'],
                            ['slug' => 'fashion-shoes-sandals', 'label' => 'Sandals', 'image' => '/images/categories/fashion-shoes-sandals.jpg'],
                        ],
                    ],
                    [
                        'slug' => 'fashion-casual-wear',
                        'label' => 'Casual Wear',
                        'image' => '/images/categories/fashion-casual-wear.jpg',
                        'children' => [
                            ['slug' => 'fashion-casual-tshirts', 'label' => 'T-Shirts', 'image' => '/images/categories/fashion-casual-tshirts.jpg'],
                            ['slug' => 'fashion-casual-jeans', 'label' => 'Jeans', 'image' => '/images/categories/fashion-casual-jeans.jpg'],
                            ['slug' => 'fashion-casual-hoodies', 'label' => 'Hoodies', 'image' => '/images/categories/fashion-casual-hoodies.jpg'],
                        ],
                    ],
                ],
            ],
            [
                'slug' => 'home-garden',
                'label' => 'Home & Garden',
                'sort_order' => 30,
                'children' => [
                    [
                        'slug' => 'home-garden-kitchen',
                        'label' => 'Kitchen',
                        'image' => '/images/categories/home-garden-kitchen.jpg',
                        'children' => [
                            [
                                'slug' => 'home-garden-kitchen-cookware',
                                'label' => 'Cookware',
                                'image' => '/images/categories/home-garden-kitchen-cookware.jpg',
                                'children' => [
                                    ['slug' => 'home-garden-cookware-nonstick', 'label' => 'Non-Stick', 'image' => '/images/categories/home-garden-cookware-nonstick.jpg'],
                                    ['slug' => 'home-garden-cookware-steel', 'label' => 'Stainless Steel', 'image' => '/images/categories/home-garden-cookware-steel.jpg'],
                                ],
                            ],
                        ],
                    ],
                    ['slug' => 'home-garden-outdoor', 'label' => 'Outdoor', 'image' => '/images/categories/home-garden-outdoor.jpg'],
                    ['slug' => 'home-garden-storage', 'label' => 'Storage', 'image' => '/images/categories/home-garden-storage.jpg'],
                ],
            ],
            [
                'slug' => 'decor',
                'label' => 'Decor',
                'sort_order' => 40,
                'children' => [
                    ['slug' => 'decor-lighting', 'label' => 'Lighting', 'image' => '/images/categories/decor-lighting.jpg'],
                    ['slug' => 'decor-wall-art', 'label' => 'Wall Art', 'image' => '/images/categories/decor-wall-art.jpg'],
                    ['slug' => 'decor-textiles', 'label' => 'Textiles', 'image' => '/images/categories/decor-textiles.jpg'],
                ],
            ],
            [
                'slug' => 'furniture',
                'label' => 'Furniture',
                'sort_order' => 50,
                'children' => [
                    ['slug' => 'furniture-living-room', 'label' => 'Living Room', 'image' => '/images/categories/furniture-living-room.jpg'],
                    ['slug' => 'furniture-dining', 'label' => 'Dining', 'image' => '/images/categories/furniture-dining.jpg'],
                    ['slug' => 'furniture-bedroom', 'label' => 'Bedroom', 'image' => '/images/categories/furniture-bedroom.jpg'],
                ],
            ],
            [
                'slug' => 'accessories',
                'label' => 'Accessories',
                'sort_order' => 60,
                'children' => [
                    ['slug' => 'accessories-bags', 'label' => 'Bags', 'image' => '/images/categories/accessories-bags.jpg'],
                    ['slug' => 'accessories-watches', 'label' => 'Watches', 'image' => '/images/categories/accessories-watches.jpg'],
                    ['slug' => 'accessories-jewelry', 'label' => 'Jewelry', 'image' => '/images/categories/accessories-jewelry.jpg'],
                ],
            ],
            [
                'slug' => 'construction',
                'label' => 'Construction',
                'sort_order' => 70,
                'children' => [
                    ['slug' => 'construction-power-tools', 'label' => 'Power Tools', 'image' => '/images/categories/construction-power-tools.jpg'],
                    ['slug' => 'construction-hand-tools', 'label' => 'Hand Tools', 'image' => '/images/categories/construction-hand-tools.jpg'],
                    ['slug' => 'construction-safety-gear', 'label' => 'Safety Gear', 'image' => '/images/categories/construction-safety-gear.jpg'],
                ],
            ],
            [
                'slug' => 'energy',
                'label' => 'Energy',
                'sort_order' => 80,
                'children' => [
                    ['slug' => 'energy-solar', 'label' => 'Solar', 'image' => '/images/categories/energy-solar.jpg'],
                    ['slug' => 'energy-batteries', 'label' => 'Batteries', 'image' => '/images/categories/energy-batteries.jpg'],
                    ['slug' => 'energy-chargers', 'label' => 'Chargers', 'image' => '/images/categories/energy-chargers.jpg'],
                ],
            ],
        ];

        foreach ($tree as $index => $node) {
            $this->upsertNode($node, null, ($index + 1) * 10);
        }
    }

    /**
     * @param  array{slug: string, label: string, image?: string|null, sort_order?: int, children?: list<array<string, mixed>>}  $node
     */
    private function upsertNode(array $node, ?Category $parent, int $sortOrder): void
    {
        $children = $node['children'] ?? [];

        $category = Category::query()->updateOrCreate(
            ['slug' => $node['slug']],
            [
                'label' => $node['label'],
                'image' => $node['image'] ?? null,
                'parent_id' => $parent?->id,
                'sort_order' => $node['sort_order'] ?? $sortOrder,
                'is_active' => true,
            ],
        );

        // Keep parent link correct when the slug already existed at top level.
        if ($category->parent_id !== $parent?->id) {
            $category->update(['parent_id' => $parent?->id]);
        }

        foreach (array_values($children) as $childIndex => $child) {
            $this->upsertNode($child, $category, ($childIndex + 1) * 10);
        }
    }
}
