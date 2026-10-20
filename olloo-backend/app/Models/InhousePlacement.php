<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\HasImageUrl;
use App\Models\Concerns\HasRid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class InhousePlacement extends Model
{
    use HasImageUrl, HasRid;

    /**
     * The slots a banner can go in, keyed page => position. Each one is a
     * storefront component, so a slot is added here together with the
     * component that renders it, never typed in by staff.
     */
    public const SLOTS = [
        'home' => [
            'label' => 'Home page',
            'positions' => [
                'hero' => 'Hero banner (top of the page)',
                'promo' => 'Promo banner (near the bottom)',
            ],
        ],
        'site' => [
            'label' => 'Every page',
            'positions' => [
                'nav_video' => 'Top video strip (desktop header)',
            ],
        ],
    ];

    /**
     * Slots that show a video instead of an image. `image` is then the poster:
     * required, because it is what shoppers see before the video plays and
     * whenever the browser blocks autoplay (iOS Low Power Mode, data saver).
     */
    public const VIDEO_SLOTS = ['site.nav_video'];

    protected $fillable = [
        'rid',
        'page',
        'position',
        'image',
        'video',
        'alt_text',
        'title',
        'description',
        'button_text',
        'link_url',
        'sort_order',
        'is_active',
    ];

    protected $hidden = [
        'id',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * @return list<string> "page.position" keys, for `in:` validation.
     */
    public static function slotKeys(): array
    {
        $keys = [];
        foreach (self::SLOTS as $page => $slot) {
            foreach (array_keys($slot['positions']) as $position) {
                $keys[] = $page.'.'.$position;
            }
        }

        return $keys;
    }

    public static function isVideoSlot(string $slot): bool
    {
        return in_array($slot, self::VIDEO_SLOTS, true);
    }

    /** Absolute URL of the video, or null for an image slot. */
    public function videoUrl(): ?string
    {
        return $this->absoluteUrlFor($this->video);
    }

    public function slotLabel(): string
    {
        $slot = self::SLOTS[$this->page] ?? null;

        // A row whose slot was removed from SLOTS still shows, under its raw key,
        // so staff can find and delete it.
        return $slot === null || ! isset($slot['positions'][$this->position])
            ? $this->page.' / '.$this->position
            : $slot['label'].': '.$slot['positions'][$this->position];
    }

    /**
     * @param  Builder<self>  $query
     */
    public function scopeOrdered(Builder $query): void
    {
        $query->orderBy('sort_order')->orderBy('id');
    }
}
