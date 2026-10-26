<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\ContentBlock;
use App\Models\ContentPage;
use Illuminate\Database\Seeder;

class ContentSeeder extends Seeder
{
    public function run(): void
    {
        $pages = [
            [
                'slug' => 'about',
                'title' => 'About olloo',
                'last_updated' => 'January 1, 2026',
                'intro' => [
                    'olloo is a curated marketplace for electronics, home, fashion, and energy products across the UAE and Ghana.',
                ],
                'blocks' => [
                    ['type' => 'heading', 'text' => 'Our mission'],
                    ['type' => 'paragraph', 'text' => 'We make quality products easier to discover, compare, and buy, with transparent pricing and reliable delivery.'],
                    ['type' => 'heading', 'text' => 'What we offer'],
                    ['type' => 'bullets', 'items' => [
                        'Curated catalog across everyday and specialist categories',
                        'Secure checkout with regional payment providers',
                        'Order tracking, returns, and post-purchase reviews',
                    ]],
                ],
            ],
            [
                'slug' => 'privacy-policy',
                'title' => 'olloo Privacy Policy',
                'last_updated' => 'January 1, 2026',
                'intro' => [
                    'This Privacy Policy explains how olloo collects, uses, and protects your personal information.',
                ],
                'blocks' => [
                    ['type' => 'heading', 'text' => '1. Introduction'],
                    ['type' => 'paragraph', 'text' => 'We process account, order, and device data to operate the storefront, fulfill orders, and improve our services.'],
                    ['type' => 'heading', 'text' => '2. Information we collect'],
                    ['type' => 'bullets', 'items' => [
                        'Account details such as name, email, and phone number',
                        'Delivery addresses and order history',
                        'Payment status metadata from payment providers (we do not store full card numbers)',
                        'Usage data such as browsing history when signed in or via a guest token',
                    ]],
                    ['type' => 'heading', 'text' => '3. How we use information'],
                    ['type' => 'paragraph', 'text' => 'We use your information to process orders, provide support, send transactional updates, and (with your preference) promotional messages.'],
                    ['type' => 'heading', 'text' => '4. Contact'],
                    ['type' => 'paragraph', 'text' => 'For privacy requests, contact our support team.'],
                ],
            ],
            [
                'slug' => 'warranty',
                'title' => 'Warranty Policy',
                'last_updated' => 'January 1, 2026',
                'intro' => [
                    'Most products sold on olloo include a manufacturer or seller warranty. Coverage varies by brand and category.',
                ],
                'blocks' => [
                    ['type' => 'heading', 'text' => 'Coverage'],
                    ['type' => 'paragraph', 'text' => 'Warranty typically covers manufacturing defects under normal use for the period stated on the product page or packing slip.'],
                    ['type' => 'heading', 'text' => 'How to claim'],
                    ['type' => 'bullets', 'items' => [
                        'Keep your order reference and proof of purchase',
                        'Contact support with photos of the issue',
                        'Follow the brand or seller instructions for inspection or replacement',
                    ]],
                ],
            ],
            [
                'slug' => 'shipping-delivery',
                'title' => 'Delivery',
                'last_updated' => 'January 1, 2026',
                'intro' => [
                    'We deliver across the UAE and selected destinations in Ghana. Estimates shown at checkout are business days.',
                ],
                'blocks' => [
                    ['type' => 'heading', 'text' => 'Delivery windows'],
                    ['type' => 'paragraph', 'text' => 'Standard delivery is typically 2 to 5 business days within major cities. Express options may appear when available for your address.'],
                    ['type' => 'heading', 'text' => 'Fees'],
                    ['type' => 'paragraph', 'text' => 'Delivery fees are calculated from cart contents and destination. Many items qualify for free delivery thresholds shown on the product card.'],
                ],
            ],
            [
                'slug' => 'return-refund',
                'title' => 'Return & Refund Policy',
                'last_updated' => 'January 1, 2026',
                'intro' => [
                    'You can request a return for eligible delivered orders within the return window shown on your order details.',
                ],
                'blocks' => [
                    ['type' => 'heading', 'text' => 'Eligibility'],
                    ['type' => 'bullets', 'items' => [
                        'Item is unused and in original packaging where required',
                        'Request is submitted from a delivered order',
                        'Product category is not marked as final sale',
                    ]],
                    ['type' => 'heading', 'text' => 'Refunds'],
                    ['type' => 'paragraph', 'text' => 'Approved refunds are issued to the original payment method after the return is received and inspected.'],
                ],
            ],
            [
                'slug' => 'secure-payments',
                'title' => 'Secure Payments',
                'last_updated' => 'January 1, 2026',
                'intro' => [
                    'olloo uses trusted payment providers. Card details are handled by the provider, not stored on our servers.',
                ],
                'blocks' => [
                    ['type' => 'heading', 'text' => 'Providers'],
                    ['type' => 'paragraph', 'text' => 'UAE Dirham checkout uses the configured Stripe or local test provider. Ghana Cedi checkout uses Paystack.'],
                    ['type' => 'heading', 'text' => 'Safety tips'],
                    ['type' => 'bullets', 'items' => [
                        'Only pay through official olloo checkout pages',
                        'Enable two-factor authentication on your account when available',
                        'Contact support immediately if a charge looks unfamiliar',
                    ]],
                ],
            ],
            [
                'slug' => 'intellectual-property',
                'title' => 'Intellectual Property',
                'last_updated' => 'January 1, 2026',
                'intro' => [
                    'All olloo trademarks, logos, product photography, and site content are protected by applicable intellectual property laws.',
                ],
                'blocks' => [
                    ['type' => 'heading', 'text' => 'Use of content'],
                    ['type' => 'paragraph', 'text' => 'You may not copy, scrape, or redistribute catalog content, images, or branding without prior written permission from olloo.'],
                    ['type' => 'heading', 'text' => 'Brand partners'],
                    ['type' => 'paragraph', 'text' => 'Third-party brand names and logos remain the property of their respective owners and are used for identification only.'],
                ],
            ],
            [
                'slug' => 'terms-of-use',
                'title' => 'Terms of Use',
                'last_updated' => 'January 1, 2026',
                'intro' => [
                    'By using olloo websites and apps, you agree to these Terms of Use and our related policies.',
                ],
                'blocks' => [
                    ['type' => 'heading', 'text' => 'Accounts'],
                    ['type' => 'paragraph', 'text' => 'You are responsible for keeping login credentials confidential and for activity under your account.'],
                    ['type' => 'heading', 'text' => 'Orders'],
                    ['type' => 'paragraph', 'text' => 'Placing an order constitutes an offer to buy. We may cancel or refuse orders for stock, pricing, or fraud reasons.'],
                    ['type' => 'heading', 'text' => 'Acceptable use'],
                    ['type' => 'bullets', 'items' => [
                        'Do not attempt unauthorized access to systems or other accounts',
                        'Do not misuse promotions, reviews, or support channels',
                        'Do not upload unlawful or infringing content',
                    ]],
                ],
            ],
        ];

        foreach ($pages as $page) {
            ContentPage::query()->updateOrCreate(
                ['slug' => $page['slug']],
                [
                    'title' => $page['title'],
                    'last_updated' => $page['last_updated'],
                    'intro' => $page['intro'],
                    'blocks' => $page['blocks'],
                ],
            );
        }

        ContentBlock::query()->updateOrCreate(
            ['key' => 'home'],
            [
                'payload' => [
                    'hero' => [
                        'eyebrow' => 'olloo marketplace',
                        'title' => 'Shop electronics, home, and more',
                        'subtitle' => 'Curated products with clear pricing and reliable delivery across the UAE and Ghana.',
                        'ctaLabel' => 'Shop featured',
                        'ctaHref' => '/categories/featured',
                        'image' => '/images/home/hero.jpg',
                    ],
                    'promoBanner' => [
                        'title' => 'New arrivals this week',
                        'subtitle' => 'Fresh picks across audio, fashion, and energy.',
                        'ctaLabel' => 'Browse new releases',
                        'ctaHref' => '/categories/new-releases',
                    ],
                    'features' => [
                        [
                            'title' => 'Secure checkout',
                            'text' => 'Payments handled by trusted regional providers.',
                        ],
                        [
                            'title' => 'Tracked delivery',
                            'text' => 'Follow your order from processing to delivered.',
                        ],
                        [
                            'title' => 'Easy returns',
                            'text' => 'Request returns from eligible delivered orders.',
                        ],
                    ],
                ],
            ],
        );

        ContentBlock::query()->updateOrCreate(
            ['key' => 'footer'],
            [
                'payload' => [
                    'columns' => [
                        [
                            'title' => 'Shop',
                            'links' => [
                                ['label' => 'Electronics', 'href' => '/categories/electronics'],
                                ['label' => 'Fashion', 'href' => '/categories/fashion'],
                                ['label' => 'Home & Garden', 'href' => '/categories/home-garden'],
                                ['label' => 'Energy', 'href' => '/categories/energy'],
                            ],
                        ],
                        [
                            'title' => 'Help',
                            'links' => [
                                ['label' => 'Delivery', 'href' => '/shipping-delivery'],
                                ['label' => 'Return & Refund', 'href' => '/return-refund'],
                                ['label' => 'Warranty', 'href' => '/warranty'],
                                ['label' => 'Secure Payments', 'href' => '/secure-payments'],
                            ],
                        ],
                        [
                            'title' => 'Company',
                            'links' => [
                                ['label' => 'About', 'href' => '/about'],
                                ['label' => 'Privacy Policy', 'href' => '/privacy-policy'],
                                ['label' => 'Terms of Use', 'href' => '/terms-of-use'],
                                ['label' => 'Intellectual Property', 'href' => '/intellectual-property'],
                            ],
                        ],
                    ],
                    'newsletter' => [
                        'title' => 'Stay in the loop',
                        'subtitle' => 'Product drops and order tips in your inbox.',
                    ],
                    'copyright' => '© 2026 olloo. All rights reserved.',
                ],
            ],
        );
    }
}
