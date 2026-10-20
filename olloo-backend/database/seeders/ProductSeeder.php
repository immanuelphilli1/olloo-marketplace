<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Category;
use App\Models\CategoryAttribute;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductVariant;
use App\Models\ShippingClass;
use App\Models\Tag;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $categories = Category::query()->get()->keyBy('slug');
        $bulky = ShippingClass::query()->firstOrCreate(['name' => 'Bulky']);
        $byLabel = Category::query()->get()->keyBy('label');

        $products = [
            [
                'slug' => 'aerosmart-earbuds',
                'category' => 'electronics',
                'subcategory' => 'Headphones & Audio',
                'name' => 'AeroSmart Wireless Earbuds',
                'tag' => 'Best seller',
                'brand' => 'Sony',
                'color' => 'Black',
                'screen_size' => null,
                'delivery' => 'Free delivery',
                'price_minor' => 17900,
                'original_price_minor' => 21900,
                'rating' => 4.7,
                'review_count' => 128,
                'sold_count' => 940,
                'discount_notice' => 'Get 10% off on your first order',
                'is_featured' => true,
                'is_new_arrival' => false,
                'price_orange' => true,
                'description_lines' => [
                    'Active noise cancellation for focused listening.',
                    'Up to 30 hours of battery with the charging case.',
                    'IPX4 water resistance for everyday use.',
                ],
            ],
            [
                'slug' => 'apple-airpods-pro',
                'category' => 'electronics',
                'subcategory' => 'Headphones & Audio',
                'name' => 'Apple AirPods Pro (2nd Gen)',
                'tag' => 'Premium',
                'brand' => 'Apple',
                'color' => 'White',
                'screen_size' => null,
                'delivery' => 'Delivery in 1 day',
                'price_minor' => 89900,
                'original_price_minor' => 99900,
                'rating' => 4.8,
                'review_count' => 412,
                'sold_count' => 2100,
                'discount_notice' => null,
                'is_featured' => true,
                'is_new_arrival' => false,
                'price_orange' => false,
                'description_lines' => [
                    'Adaptive Audio with Transparency mode.',
                    'USB-C charging case with MagSafe.',
                    'Personalized Spatial Audio.',
                ],
            ],
            [
                'slug' => 'sony-wh1000xm5',
                'category' => 'electronics',
                'subcategory' => 'Headphones & Audio',
                'name' => 'Sony WH-1000XM5 Headphones',
                'tag' => 'Top rated',
                'brand' => 'Sony',
                'color' => 'Silver',
                'screen_size' => null,
                'delivery' => 'Free delivery',
                'price_minor' => 129900,
                'original_price_minor' => 149900,
                'rating' => 4.9,
                'review_count' => 860,
                'sold_count' => 1500,
                'discount_notice' => 'Limited-time savings',
                'is_featured' => true,
                'is_new_arrival' => false,
                'price_orange' => true,
                'description_lines' => [
                    'Industry-leading noise cancellation.',
                    '30-hour battery life with quick charge.',
                    'Multipoint Bluetooth connection.',
                ],
            ],
            [
                'slug' => 'samsung-galaxy-buds3',
                'category' => 'electronics',
                'subcategory' => 'Wearables',
                'name' => 'Samsung Galaxy Buds3',
                'tag' => 'New',
                'brand' => 'Samsung',
                'color' => 'Graphite',
                'screen_size' => null,
                'delivery' => 'Delivery in 3 days',
                'price_minor' => 54900,
                'original_price_minor' => null,
                'rating' => 4.5,
                'review_count' => 64,
                'sold_count' => 210,
                'discount_notice' => null,
                'is_featured' => false,
                'is_new_arrival' => true,
                'price_orange' => false,
                'description_lines' => [
                    'Blade lights with adaptive ANC.',
                    'Galaxy AI voice commands.',
                    'IP57 dust and water resistance.',
                ],
            ],
            [
                'slug' => 'ipad-air-11',
                'category' => 'electronics',
                'subcategory' => 'Phones & Tablets',
                'name' => 'Apple iPad Air 11-inch',
                'tag' => 'Popular',
                'brand' => 'Apple',
                'color' => 'Blue',
                'screen_size' => '11 inch',
                'delivery' => 'Free delivery',
                'price_minor' => 249900,
                'original_price_minor' => 269900,
                'rating' => 4.8,
                'review_count' => 305,
                'sold_count' => 780,
                'discount_notice' => null,
                'is_featured' => true,
                'is_new_arrival' => true,
                'price_orange' => false,
                'description_lines' => [
                    'M2 chip for everyday creative work.',
                    'Liquid Retina display with True Tone.',
                    'All-day battery life.',
                ],
            ],
            [
                'slug' => 'linen-summer-dress',
                'category' => 'fashion',
                'subcategory' => 'Women',
                'name' => 'Linen Summer Midi Dress',
                'tag' => 'Seasonal',
                'brand' => 'H&CO',
                'color' => 'Beige',
                'screen_size' => null,
                'delivery' => 'Free delivery',
                'price_minor' => 18900,
                'original_price_minor' => 24900,
                'rating' => 4.4,
                'review_count' => 52,
                'sold_count' => 340,
                'discount_notice' => 'Summer edit',
                'is_featured' => false,
                'is_new_arrival' => true,
                'price_orange' => true,
                'description_lines' => [
                    'Breathable linen blend fabric.',
                    'Relaxed midi silhouette.',
                    'Machine washable.',
                ],
            ],
            [
                'slug' => 'classic-leather-jacket',
                'category' => 'fashion',
                'subcategory' => 'Men',
                'name' => 'Classic Leather Jacket',
                'tag' => 'Editor pick',
                'brand' => 'H&CO',
                'color' => 'Brown',
                'screen_size' => null,
                'delivery' => 'Delivery in 3 days',
                'price_minor' => 45900,
                'original_price_minor' => 52900,
                'rating' => 4.6,
                'review_count' => 91,
                'sold_count' => 190,
                'discount_notice' => null,
                'is_featured' => true,
                'is_new_arrival' => false,
                'price_orange' => false,
                'description_lines' => [
                    'Full-grain leather shell.',
                    'Quilted lining for cooler evenings.',
                    'Zippered pockets and adjustable cuffs.',
                ],
            ],
            [
                'slug' => 'ceramic-planter-set',
                'category' => 'home-garden',
                'subcategory' => 'Outdoor',
                'name' => 'Ceramic Planter Set (3pcs)',
                'tag' => 'New',
                'brand' => 'GardenForm',
                'color' => 'Terracotta',
                'screen_size' => null,
                'delivery' => 'Free delivery',
                'price_minor' => 12900,
                'original_price_minor' => null,
                'rating' => 4.3,
                'review_count' => 27,
                'sold_count' => 120,
                'discount_notice' => null,
                'is_featured' => false,
                'is_new_arrival' => true,
                'price_orange' => false,
                'description_lines' => [
                    'Frost-resistant ceramic finish.',
                    'Includes drainage holes and saucers.',
                    'Set of three graduated sizes.',
                ],
            ],
            [
                'slug' => 'scandinavian-floor-lamp',
                'category' => 'decor',
                'subcategory' => 'Lighting',
                'name' => 'Scandinavian Floor Lamp',
                'tag' => 'Design',
                'brand' => 'NordicHome',
                'color' => 'Oak',
                'screen_size' => null,
                'delivery' => 'Delivery in 5 days',
                'price_minor' => 32900,
                'original_price_minor' => 37900,
                'rating' => 4.5,
                'review_count' => 44,
                'sold_count' => 88,
                'discount_notice' => null,
                'is_featured' => true,
                'is_new_arrival' => false,
                'price_orange' => false,
                'description_lines' => [
                    'Solid oak stand with linen shade.',
                    'Warm dimmable LED compatible.',
                    'Easy tool-free assembly.',
                ],
            ],
            [
                'slug' => 'oak-dining-chair',
                'category' => 'furniture',
                'subcategory' => 'Dining',
                'name' => 'Solid Oak Dining Chair',
                'tag' => 'Durable',
                'brand' => 'TimberCo',
                'color' => 'Natural',
                'screen_size' => null,
                'delivery' => 'Delivery in 5 days',
                'price_minor' => 39900,
                'original_price_minor' => 44900,
                'rating' => 4.6,
                'review_count' => 73,
                'sold_count' => 210,
                'discount_notice' => null,
                'is_featured' => false,
                'is_new_arrival' => false,
                'price_orange' => false,
                'description_lines' => [
                    'Kiln-dried solid oak frame.',
                    'Comfortable curved backrest.',
                    'Felt pads included for floors.',
                ],
            ],
            [
                'slug' => 'minimal-crossbody-bag',
                'category' => 'accessories',
                'subcategory' => 'Bags',
                'name' => 'Minimal Crossbody Bag',
                'tag' => 'Everyday',
                'brand' => 'H&CO',
                'color' => 'Black',
                'screen_size' => null,
                'delivery' => 'Free delivery',
                'price_minor' => 14900,
                'original_price_minor' => 17900,
                'rating' => 4.4,
                'review_count' => 118,
                'sold_count' => 560,
                'discount_notice' => null,
                'is_featured' => false,
                'is_new_arrival' => true,
                'price_orange' => true,
                'description_lines' => [
                    'Water-resistant nylon shell.',
                    'Adjustable strap and RFID pocket.',
                    'Fits phone, wallet, and keys.',
                ],
            ],
            [
                'slug' => 'cordless-drill-kit',
                'category' => 'construction',
                'subcategory' => 'Power Tools',
                'name' => '18V Cordless Drill Kit',
                'tag' => 'Pro tool',
                'brand' => 'DeWalt',
                'color' => 'Yellow',
                'screen_size' => null,
                'delivery' => 'Free delivery',
                'price_minor' => 49900,
                'original_price_minor' => 57900,
                'rating' => 4.7,
                'review_count' => 201,
                'sold_count' => 430,
                'discount_notice' => 'Bundle includes 2 batteries',
                'is_featured' => true,
                'is_new_arrival' => false,
                'price_orange' => true,
                'description_lines' => [
                    'Brushless motor with 2-speed gearbox.',
                    'Includes charger and carry case.',
                    'LED work light and belt clip.',
                ],
            ],
            [
                'slug' => 'portable-solar-charger',
                'category' => 'energy',
                'subcategory' => 'Solar',
                'name' => 'Portable Foldable Solar Charger',
                'tag' => 'New',
                'brand' => 'EcoCharge',
                'color' => 'Black',
                'screen_size' => null,
                'delivery' => 'Delivery in 3 days',
                'price_minor' => 27900,
                'original_price_minor' => null,
                'rating' => 4.2,
                'review_count' => 39,
                'sold_count' => 95,
                'discount_notice' => null,
                'is_featured' => false,
                'is_new_arrival' => true,
                'price_orange' => false,
                'description_lines' => [
                    '40W dual USB-C output.',
                    'Weather-resistant ETFE panels.',
                    'Folds flat for travel and camping.',
                ],
            ],
            [
                'slug' => 'smart-watch-series-x',
                'category' => 'electronics',
                'subcategory' => 'Wearables',
                'name' => 'Smart Watch Series X',
                'tag' => 'Fitness',
                'brand' => 'Samsung',
                'color' => 'Black',
                'screen_size' => '1.4 inch',
                'delivery' => 'Delivery in 1 day',
                'price_minor' => 69900,
                'original_price_minor' => 79900,
                'rating' => 4.5,
                'review_count' => 220,
                'sold_count' => 670,
                'discount_notice' => null,
                'is_featured' => false,
                'is_new_arrival' => true,
                'price_orange' => false,
                'description_lines' => [
                    'AMOLED always-on display.',
                    'SpO2 and sleep tracking.',
                    '5ATM water resistance.',
                ],
            ],
            [
                'slug' => 'street-runner-sneakers',
                'category' => 'fashion',
                'subcategory' => 'Sneakers',
                'name' => 'Street Runner Sneakers',
                'tag' => 'New',
                'brand' => 'H&CO',
                'color' => 'White',
                'screen_size' => null,
                'delivery' => 'Free delivery',
                'price_minor' => 29900,
                'original_price_minor' => 35900,
                'rating' => 4.6,
                'review_count' => 87,
                'sold_count' => 310,
                'discount_notice' => null,
                'is_featured' => true,
                'is_new_arrival' => true,
                'price_orange' => true,
                'description_lines' => [
                    'Breathable knit upper for all-day comfort.',
                    'Cushioned sole for street and gym wear.',
                    'Available in multiple colorways.',
                ],
            ],
            [
                'slug' => 'essential-casual-tee',
                'category' => 'fashion',
                'subcategory' => 'T-Shirts',
                'name' => 'Essential Casual Tee',
                'tag' => 'Everyday',
                'brand' => 'H&CO',
                'color' => 'Black',
                'screen_size' => null,
                'delivery' => 'Free delivery',
                'price_minor' => 5900,
                'original_price_minor' => 7900,
                'rating' => 4.5,
                'review_count' => 143,
                'sold_count' => 820,
                'discount_notice' => null,
                'is_featured' => false,
                'is_new_arrival' => true,
                'price_orange' => false,
                'description_lines' => [
                    'Soft combed-cotton casual fit.',
                    'Reinforced collar that keeps its shape.',
                    'Machine washable.',
                ],
            ],
            [
                'slug' => 'thunder-gaming-laptop',
                'category' => 'electronics',
                'subcategory' => 'Gaming Laptops',
                'name' => 'Thunder 16 Gaming Laptop',
                'tag' => 'Pro gaming',
                'brand' => 'VoltEdge',
                'color' => 'Black',
                'screen_size' => '16 inch',
                'delivery' => 'Free delivery',
                'price_minor' => 549900,
                'original_price_minor' => 599900,
                'rating' => 4.7,
                'review_count' => 156,
                'sold_count' => 240,
                'discount_notice' => null,
                'is_featured' => true,
                'is_new_arrival' => false,
                'price_orange' => true,
                'description_lines' => [
                    'High-refresh 16-inch display.',
                    'Dedicated graphics for modern titles.',
                    'Advanced cooling with quiet fans.',
                ],
            ],
            [
                'slug' => 'aero-ultrabook-14',
                'category' => 'electronics',
                'subcategory' => 'Ultrabooks',
                'name' => 'Aero Ultrabook 14',
                'tag' => 'Travel',
                'brand' => 'VoltEdge',
                'color' => 'Silver',
                'screen_size' => '14 inch',
                'delivery' => 'Delivery in 3 days',
                'price_minor' => 389900,
                'original_price_minor' => null,
                'rating' => 4.6,
                'review_count' => 89,
                'sold_count' => 175,
                'discount_notice' => null,
                'is_featured' => false,
                'is_new_arrival' => true,
                'price_orange' => false,
                'description_lines' => [
                    '1.2 kg thin-and-light chassis.',
                    '18-hour battery for long trips.',
                    'Fingerprint power button.',
                ],
            ],
            [
                'slug' => 'formal-oxford-shoes',
                'category' => 'fashion',
                'subcategory' => 'Formal Shoes',
                'name' => 'Classic Oxford Formal Shoes',
                'tag' => 'Office',
                'brand' => 'H&CO',
                'color' => 'Black',
                'screen_size' => null,
                'delivery' => 'Free delivery',
                'price_minor' => 24900,
                'original_price_minor' => 29900,
                'rating' => 4.5,
                'review_count' => 66,
                'sold_count' => 280,
                'discount_notice' => null,
                'is_featured' => false,
                'is_new_arrival' => false,
                'price_orange' => false,
                'description_lines' => [
                    'Polished full-grain leather upper.',
                    'Cushioned insole for long days.',
                    'Classic cap-toe silhouette.',
                ],
            ],
            [
                'slug' => 'cork-comfort-sandals',
                'category' => 'fashion',
                'subcategory' => 'Sandals',
                'name' => 'Cork Comfort Sandals',
                'tag' => 'Summer',
                'brand' => 'H&CO',
                'color' => 'Brown',
                'screen_size' => null,
                'delivery' => 'Delivery in 3 days',
                'price_minor' => 12900,
                'original_price_minor' => null,
                'rating' => 4.3,
                'review_count' => 41,
                'sold_count' => 190,
                'discount_notice' => null,
                'is_featured' => false,
                'is_new_arrival' => true,
                'price_orange' => false,
                'description_lines' => [
                    'Molded cork footbed.',
                    'Adjustable straps for the perfect fit.',
                    'Lightweight summer comfort.',
                ],
            ],
            [
                'slug' => 'court-classic-white',
                'category' => 'fashion',
                'subcategory' => 'Court Classics',
                'name' => 'Court Classic White Sneakers',
                'tag' => 'Iconic',
                'brand' => 'H&CO',
                'color' => 'White',
                'screen_size' => null,
                'delivery' => 'Free delivery',
                'price_minor' => 19900,
                'original_price_minor' => 23900,
                'rating' => 4.7,
                'review_count' => 203,
                'sold_count' => 640,
                'discount_notice' => null,
                'is_featured' => true,
                'is_new_arrival' => false,
                'price_orange' => true,
                'description_lines' => [
                    'Clean leather court profile.',
                    'Goes with everything in the wardrobe.',
                    'Padded collar for comfort.',
                ],
            ],
            [
                'slug' => 'relaxed-fleece-hoodie',
                'category' => 'fashion',
                'subcategory' => 'Hoodies',
                'name' => 'Relaxed Fleece Hoodie',
                'tag' => 'Cozy',
                'brand' => 'H&CO',
                'color' => 'Grey',
                'screen_size' => null,
                'delivery' => 'Free delivery',
                'price_minor' => 11900,
                'original_price_minor' => 14900,
                'rating' => 4.6,
                'review_count' => 117,
                'sold_count' => 430,
                'discount_notice' => null,
                'is_featured' => false,
                'is_new_arrival' => true,
                'price_orange' => false,
                'description_lines' => [
                    'Brushed-back fleece interior.',
                    'Kangaroo pocket and drawstring hood.',
                    'Relaxed everyday fit.',
                ],
            ],
            [
                'slug' => 'nonstick-cookware-10pc',
                'category' => 'home-garden',
                'subcategory' => 'Non-Stick',
                'name' => 'Non-Stick Cookware Set (10pc)',
                'tag' => 'Kitchen essential',
                'brand' => 'ChefLine',
                'color' => 'Black',
                'screen_size' => null,
                'delivery' => 'Free delivery',
                'price_minor' => 34900,
                'original_price_minor' => 42900,
                'rating' => 4.5,
                'review_count' => 98,
                'sold_count' => 260,
                'discount_notice' => null,
                'is_featured' => true,
                'is_new_arrival' => false,
                'price_orange' => true,
                'description_lines' => [
                    'PFOA-free non-stick coating.',
                    'Even-heating aluminum bodies.',
                    'Oven safe to 200C.',
                ],
            ],
            [
                'slug' => 'steel-stockpot-set',
                'category' => 'home-garden',
                'subcategory' => 'Stainless Steel',
                'name' => 'Stainless Steel Stockpot Set',
                'tag' => 'Durable',
                'brand' => 'ChefLine',
                'color' => 'Silver',
                'screen_size' => null,
                'delivery' => 'Delivery in 5 days',
                'price_minor' => 27900,
                'original_price_minor' => null,
                'rating' => 4.4,
                'review_count' => 37,
                'sold_count' => 110,
                'discount_notice' => null,
                'is_featured' => false,
                'is_new_arrival' => true,
                'price_orange' => false,
                'description_lines' => [
                    'Tri-ply stainless construction.',
                    'Tight-fitting glass lids.',
                    'Dishwasher safe.',
                ],
            ],
            [
                'slug' => 'chrono-steel-watch',
                'category' => 'accessories',
                'subcategory' => 'Watches',
                'name' => 'Chrono Steel Watch',
                'tag' => 'Premium',
                'brand' => 'H&CO',
                'color' => 'Silver',
                'screen_size' => null,
                'delivery' => 'Delivery in 3 days',
                'price_minor' => 59900,
                'original_price_minor' => 69900,
                'rating' => 4.8,
                'review_count' => 74,
                'sold_count' => 150,
                'discount_notice' => null,
                'is_featured' => true,
                'is_new_arrival' => false,
                'price_orange' => false,
                'description_lines' => [
                    'Sapphire-coated mineral glass.',
                    '5ATM water resistance.',
                    'Brushed steel bracelet.',
                ],
            ],
            [
                'slug' => 'kids-denim-jacket',
                'category' => 'fashion',
                'subcategory' => 'Kids',
                'name' => 'Kids Denim Jacket',
                'tag' => 'Playground proof',
                'brand' => 'H&CO',
                'color' => 'Blue',
                'screen_size' => null,
                'delivery' => 'Free delivery',
                'price_minor' => 9900,
                'original_price_minor' => 12900,
                'rating' => 4.5,
                'review_count' => 58,
                'sold_count' => 320,
                'discount_notice' => null,
                'is_featured' => false,
                'is_new_arrival' => true,
                'price_orange' => false,
                'description_lines' => [
                    'Sturdy stretch denim.',
                    'Snap buttons for easy wear.',
                    'Machine washable.',
                ],
            ],
            [
                'slug' => 'pro-chef-knife-set',
                'category' => 'home-garden',
                'subcategory' => 'Kitchen',
                'name' => 'Pro Chef Knife Set (6pc)',
                'tag' => 'Sharp',
                'brand' => 'ChefLine',
                'color' => 'Black',
                'screen_size' => null,
                'delivery' => 'Free delivery',
                'price_minor' => 18900,
                'original_price_minor' => 22900,
                'rating' => 4.6,
                'review_count' => 83,
                'sold_count' => 210,
                'discount_notice' => null,
                'is_featured' => false,
                'is_new_arrival' => false,
                'price_orange' => false,
                'description_lines' => [
                    'High-carbon stainless blades.',
                    'Ergonomic soft-grip handles.',
                    'Includes wooden storage block.',
                ],
            ],
        ];

        foreach ($products as $data) {
            // Products point at the leaf (most specific) category. Legacy rows
            // carry category + subcategory label; resolve the leaf by label.
            /** @var Category|null $category */
            $category = $categories->get($data['category']);
            if (isset($data['subcategory'])) {
                $category = $byLabel->get($data['subcategory']) ?? $category;
            }
            if ($category === null) {
                continue;
            }

            $image = '/images/products/'.$data['slug'].'.jpg';

            $product = Product::query()->updateOrCreate(
                ['slug' => $data['slug']],
                [
                    'category_id' => $category->id,
                    'shipping_class_id' => in_array($data['category'], ['furniture', 'construction'], true) ? $bulky->id : null,
                    'name' => $data['name'],
                    'image' => $image,
                    'display' => array_filter([
                        'imageObjectPosition' => 'center',
                        'priceOrange' => $data['price_orange'] ? true : null,
                    ]),
                    'price_minor' => $data['price_minor'],
                    'original_price_minor' => $data['original_price_minor'],
                    'currency_code' => 'USD',
                    'rating' => $data['rating'],
                    'review_count' => $data['review_count'],
                    'sold_count' => $data['sold_count'],
                    'discount_notice' => $data['discount_notice'],
                    'description_lines' => $data['description_lines'],
                    'is_featured' => $data['is_featured'],
                    'is_new_arrival' => $data['is_new_arrival'],
                    'is_active' => true,
                ],
            );

            $this->defineAttributes($category, array_keys(array_filter([
                'brand' => $data['brand'],
                'color' => $data['color'],
                'screenSize' => $data['screen_size'],
            ])));
            $product->setRelation('category', $category);
            $product->syncAttributes([
                'brand' => $data['brand'],
                'color' => $data['color'],
                'screenSize' => $data['screen_size'],
            ]);

            // The legacy delivery copy hinted at dispatch speed; keep that as
            // handling time (NULL = store default).
            $handlingDays = match ($data['delivery']) {
                'Delivery in 1 day' => 0,
                'Delivery in 5 days' => 3,
                default => null,
            };

            if (is_string($data['tag'] ?? null) && trim($data['tag']) !== '') {
                $product->tags()->sync([$this->tagIdFor(trim($data['tag']))]);
            }

            ProductImage::query()->where('product_id', $product->id)->delete();
            foreach ([$image, '/images/products/'.$data['slug'].'-2.jpg', '/images/products/'.$data['slug'].'-3.jpg'] as $index => $path) {
                ProductImage::query()->create([
                    'product_id' => $product->id,
                    'path' => $path,
                    'sort_order' => $index,
                ]);
            }

            // Keyed by SKU so reseeding keeps variant rows (and cart lines on them).
            ProductVariant::query()->updateOrCreate(
                ['sku' => Str::upper(Str::slug($data['slug']).'-STD')],
                [
                    'product_id' => $product->id,
                    'name' => 'Standard',
                    'price_minor' => null,
                    'stock_quantity' => 50,
                    'handling_days' => $handlingDays,
                    'is_default' => true,
                ],
            );
            ProductVariant::query()->updateOrCreate(
                ['sku' => Str::upper(Str::slug($data['slug']).'-PRO')],
                [
                    'product_id' => $product->id,
                    'name' => 'Pro',
                    'price_minor' => (int) round($data['price_minor'] * 1.15),
                    'stock_quantity' => 10,
                    // Pro builds are assembled to order.
                    'handling_days' => ($handlingDays ?? (int) config('shipping.default_handling_days')) + 2,
                    'is_default' => false,
                ],
            );
        }

        $this->seedColorSizeDemo($categories->get('fashion-men'));
    }

    /**
     * One product with colour x size variants and a photo per colour, so the
     * storefront can show separate colour and size pickers and the gallery
     * sliding to the picked variant. White / L is sold out on purpose.
     */
    private function seedColorSizeDemo(?Category $category): void
    {
        if ($category === null) {
            return;
        }

        $product = Product::query()->updateOrCreate(
            ['slug' => 'classic-cotton-tee'],
            [
                'category_id' => $category->id,
                'name' => 'Classic Cotton Tee',
                'image' => '/images/products/classic-cotton-tee.jpg',
                'display' => ['imageObjectPosition' => 'center'],
                'price_minor' => 2500,
                'original_price_minor' => null,
                'currency_code' => 'USD',
                'rating' => 4.5,
                'review_count' => 18,
                'sold_count' => 120,
                'discount_notice' => null,
                'description_lines' => [
                    'Soft combed cotton with a regular fit.',
                    'Pick a colour and a size; each colour has its own photo.',
                ],
                'is_featured' => false,
                'is_new_arrival' => true,
                'is_active' => true,
            ],
        );

        $variantIds = [];
        foreach (['Black' => 'BLK', 'White' => 'WHT'] as $color => $colorCode) {
            foreach (['S', 'M', 'L'] as $size) {
                $sku = "TEE-CLASSIC-{$colorCode}-{$size}";
                $variantIds[$sku] = ProductVariant::query()->updateOrCreate(
                    ['sku' => $sku],
                    [
                        'product_id' => $product->id,
                        'name' => "{$color} / {$size}",
                        'color' => $color,
                        'size' => $size,
                        'price_minor' => $size === 'L' ? 2700 : null,
                        'stock_quantity' => $sku === 'TEE-CLASSIC-WHT-L' ? 0 : 25,
                        'is_default' => $sku === 'TEE-CLASSIC-BLK-M',
                    ],
                )->id;
            }
        }

        ProductImage::query()->where('product_id', $product->id)->delete();
        $gallery = [
            '/images/products/classic-cotton-tee.jpg' => null,
            '/images/products/classic-cotton-tee-black.jpg' => $variantIds['TEE-CLASSIC-BLK-M'],
            '/images/products/classic-cotton-tee-white.jpg' => $variantIds['TEE-CLASSIC-WHT-M'],
            '/images/products/classic-cotton-tee-white-large.jpg' => $variantIds['TEE-CLASSIC-WHT-L'],
        ];
        foreach (array_keys($gallery) as $index => $path) {
            ProductImage::query()->create([
                'product_id' => $product->id,
                'variant_id' => $gallery[$path],
                'path' => $path,
                'sort_order' => $index,
            ]);
        }
    }

    /**
     * Attributes live on the top-level category so every subcategory offers them.
     *
     * @param  list<string>  $keys
     */
    private function defineAttributes(Category $category, array $keys): void
    {
        $root = $category;
        while ($root->parent_id !== null) {
            $root = Category::query()->findOrFail($root->parent_id);
        }

        $labels = ['brand' => 'Brand', 'color' => 'Color', 'screenSize' => 'Screen size'];
        foreach ($keys as $key) {
            CategoryAttribute::query()->firstOrCreate(
                ['category_id' => $root->id, 'key' => $key],
                ['label' => $labels[$key] ?? $key],
            );
        }
    }

    private function tagIdFor(string $name): int
    {
        $existing = Tag::query()->where('name', $name)->first();
        if ($existing instanceof Tag) {
            return $existing->id;
        }

        $slug = Str::slug($name) ?: 'tag';
        $candidate = $slug;
        $suffix = 2;
        while (Tag::query()->where('slug', $candidate)->exists()) {
            $candidate = $slug.'-'.$suffix;
            $suffix++;
        }

        return Tag::query()->create([
            'name' => $name,
            'slug' => $candidate,
        ])->id;
    }
}
