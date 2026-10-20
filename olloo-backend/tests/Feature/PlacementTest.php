<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\InhousePlacement;
use App\Models\User;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

final class PlacementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['admin.mfa_forced' => false, 'inertia.testing.ensure_pages_exist' => false]);
    }

    private function url(string $path): string
    {
        return '/'.trim((string) config('admin.path_prefix'), '/').'/'.$path;
    }

    private function staff(array $permissions): User
    {
        $this->seed(AdminPermissionsSeeder::class);

        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'banners@handco.test',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ]);
        $staff->syncPermissions($permissions);

        return $staff;
    }

    private function placement(array $attributes = []): InhousePlacement
    {
        return InhousePlacement::query()->create(array_merge([
            'page' => 'home',
            'position' => 'hero',
            'image' => '/storage/uploads/placements/a.jpg',
            'sort_order' => 0,
            'is_active' => true,
        ], $attributes));
    }

    public function test_storefront_gets_active_banners_for_a_page_in_order(): void
    {
        $second = $this->placement(['sort_order' => 2, 'title' => 'Second']);
        $first = $this->placement(['sort_order' => 1, 'title' => 'First', 'link_url' => '/category/fashion']);
        $promo = $this->placement(['position' => 'promo', 'title' => 'Save more']);
        $this->placement(['is_active' => false, 'title' => 'Hidden']);

        $this->getJson(route('api.v1.placements.index', ['page' => 'home']))
            ->assertOk()
            ->assertJsonCount(3, 'items')
            ->assertJsonPath('items.0.rid', $promo->rid)
            ->assertJsonPath('items.1.rid', $first->rid)
            ->assertJsonPath('items.1.linkUrl', '/category/fashion')
            ->assertJsonPath('items.1.imageUrl', rtrim((string) config('app.url'), '/').'/storage/uploads/placements/a.jpg')
            ->assertJsonPath('items.2.rid', $second->rid)
            ->assertJsonMissingPath('items.0.id');

        $this->getJson(route('api.v1.placements.index', ['page' => 'home', 'position' => 'promo']))
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.title', 'Save more')
            ->assertJsonMissingPath('items.0.badge');
    }

    public function test_unknown_page_and_position_are_refused(): void
    {
        $this->getJson(route('api.v1.placements.index', ['page' => 'nowhere']))
            ->assertNotFound()
            ->assertJsonPath('error.code', 'placement_page_not_found');

        $this->getJson(route('api.v1.placements.index', ['page' => 'home', 'position' => 'sidebar']))
            ->assertUnprocessable();
    }

    public function test_staff_add_a_banner_to_a_listed_slot(): void
    {
        $this->actingAs($this->staff(['view_placements', 'edit_placements']), 'staff')
            ->post($this->url('placements'), [
                'slot' => 'home.promo',
                'image' => '/storage/uploads/placements/b.jpg',
                'title' => 'Style for every season.',
                'link_url' => 'https://hcomall.com/category/fashion',
                'sort_order' => 3,
                'is_active' => true,
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $placement = InhousePlacement::query()->sole();
        $this->assertSame('home', $placement->page);
        $this->assertSame('promo', $placement->position);
        $this->assertSame('Style for every season.', $placement->title);
    }

    public function test_slot_image_and_link_are_validated(): void
    {
        $this->actingAs($this->staff(['edit_placements']), 'staff')
            ->post($this->url('placements'), [
                'slot' => 'home.sidebar',
                'image' => 'banner.jpg',
                'link_url' => 'javascript:alert(1)',
                'sort_order' => 0,
                'is_active' => true,
            ])
            ->assertSessionHasErrors(['slot', 'image', 'link_url']);

        $this->assertSame(0, InhousePlacement::query()->count());
    }

    public function test_staff_edit_and_delete_a_banner(): void
    {
        $placement = $this->placement();
        $staff = $this->staff(['edit_placements']);

        $this->actingAs($staff, 'staff')
            ->put($this->url('placements/'.$placement->rid), [
                'slot' => 'home.promo',
                'image' => $placement->image,
                'sort_order' => 5,
                'is_active' => false,
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $placement->refresh();
        $this->assertSame('promo', $placement->position);
        $this->assertFalse($placement->is_active);

        $this->actingAs($staff, 'staff')->delete($this->url('placements/'.$placement->rid))->assertRedirect();
        $this->assertSame(0, InhousePlacement::query()->count());
    }

    public function test_viewing_and_editing_need_their_permissions(): void
    {
        $viewer = $this->staff(['view_placements']);

        $this->actingAs($viewer, 'staff')->get($this->url('placements'))->assertOk();
        $this->actingAs($viewer, 'staff')
            ->post($this->url('placements'), ['slot' => 'home.hero', 'image' => '/storage/x.jpg', 'sort_order' => 0, 'is_active' => true])
            ->assertForbidden();

        $viewer->syncPermissions([]);
        $this->actingAs($viewer->fresh(), 'staff')->get($this->url('placements'))->assertForbidden();
    }

    public function test_the_top_video_strip_needs_a_video_and_a_poster(): void
    {
        $staff = $this->staff(['view_placements', 'edit_placements']);

        $this->actingAs($staff, 'staff')
            ->post($this->url('placements'), ['slot' => 'site.nav_video', 'sort_order' => 0, 'is_active' => true])
            ->assertSessionHasErrors(['video', 'image']);

        $this->actingAs($staff, 'staff')
            ->post($this->url('placements'), [
                'slot' => 'site.nav_video',
                'video' => '/storage/uploads/placements/strip.mp4',
                'image' => '/storage/uploads/placements/strip-poster.jpg',
                'alt_text' => 'New season preview',
                // The strip shows no text: copy typed for another slot is dropped.
                'title' => 'Ignored',
                'link_url' => '/categories/fashion',
                'sort_order' => 0,
                'is_active' => true,
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $placement = InhousePlacement::query()->sole();
        $this->assertSame(['site', 'nav_video'], [$placement->page, $placement->position]);
        $this->assertNull($placement->title);

        $base = rtrim((string) config('app.url'), '/');
        $this->getJson(route('api.v1.placements.index', ['page' => 'site', 'position' => 'nav_video']))
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.videoUrl', $base.'/storage/uploads/placements/strip.mp4')
            ->assertJsonPath('items.0.imageUrl', $base.'/storage/uploads/placements/strip-poster.jpg')
            ->assertJsonPath('items.0.linkUrl', '/categories/fashion');
    }

    public function test_an_image_banner_never_keeps_a_video(): void
    {
        $this->actingAs($this->staff(['view_placements', 'edit_placements']), 'staff')
            ->post($this->url('placements'), [
                'slot' => 'home.hero',
                'image' => '/storage/uploads/placements/a.jpg',
                'video' => '/storage/uploads/placements/strip.mp4',
                'sort_order' => 0,
                'is_active' => true,
            ])
            ->assertSessionHasNoErrors();

        $this->assertNull(InhousePlacement::query()->sole()->video);
        $this->getJson(route('api.v1.placements.index', ['page' => 'home']))->assertJsonPath('items.0.videoUrl', null);
    }

    public function test_staff_upload_banner_videos_as_mp4_or_webm_only(): void
    {
        Storage::fake('public');
        $staff = $this->staff(['view_placements', 'edit_placements']);
        // Real upload objects, not UploadedFile::fake(): the fake reports a type
        // from the file name, while a real upload is typed by its contents.
        $mp4 = $this->upload('strip.mp4', "\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2".str_repeat("\x00", 64));

        $path = $this->actingAs($staff, 'staff')
            ->postJson($this->url('uploads/video'), ['video' => $mp4])
            ->assertCreated()
            ->json('path');

        $this->assertStringStartsWith('/storage/uploads/placements/', $path);
        Storage::disk('public')->assertExists(substr($path, strlen('/storage/')));

        $this->actingAs($staff, 'staff')
            ->postJson($this->url('uploads/video'), ['video' => $this->upload('notes.mp4', 'just text')])
            ->assertUnprocessable();

        $staff->syncPermissions(['view_placements']);
        $this->actingAs($staff->fresh(), 'staff')
            ->postJson($this->url('uploads/video'), ['video' => $mp4])
            ->assertForbidden();
    }

    private function upload(string $name, string $contents): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'upload');
        file_put_contents($path, $contents);

        return new UploadedFile($path, $name, null, null, true);
    }
}
