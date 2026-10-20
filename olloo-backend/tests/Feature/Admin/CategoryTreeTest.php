<?php

declare(strict_types=1);

namespace Tests\Feature\Admin;

use App\Models\Category;
use App\Models\User;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

final class CategoryTreeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['admin.mfa_forced' => false]);
        // Pages are .tsx (client-built); assert props without requiring
        // server-resolvable view files.
        config(['inertia.testing.ensure_pages_exist' => false]);
    }

    public function test_show_renders_full_subtree(): void
    {
        $staff = $this->makeStaff();
        $prefix = trim((string) config('admin.path_prefix'), '/');
        [$fashion] = $this->seedTree();

        $this->actingAs($staff, 'staff')
            ->get('/'.$prefix.'/categories/'.$fashion->rid)
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Categories/Show')
                ->where('category.rid', $fashion->rid)
                ->where('category.children.0.label', 'Shoes')
                ->where('category.children.0.children.0.label', 'Sneakers')
                ->where('category.children.0.childrenCount', 1)
                ->has('category.children.0.imageUrl')
            );
    }

    public function test_create_prefills_parent_from_query(): void
    {
        $staff = $this->makeStaff();
        $prefix = trim((string) config('admin.path_prefix'), '/');
        [$fashion] = $this->seedTree();

        $this->actingAs($staff, 'staff')
            ->get('/'.$prefix.'/categories/create?parent='.$fashion->rid)
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Categories/Create')
                ->where('defaultParentRid', $fashion->rid)
            );
    }

    public function test_delete_from_tree_stays_on_details_page(): void
    {
        $staff = $this->makeStaff();
        $prefix = trim((string) config('admin.path_prefix'), '/');
        [$fashion, $shoes] = $this->seedTree();
        $sneakers = Category::query()->where('slug', 'fashion-shoes-sneakers')->firstOrFail();

        $this->actingAs($staff, 'staff')
            ->delete('/'.$prefix.'/categories/'.$sneakers->rid.'?from='.$fashion->rid)
            ->assertRedirect('/'.$prefix.'/categories/'.$fashion->rid);

        $this->assertModelMissing($sneakers);
        $this->assertModelExists($shoes);
    }

    public function test_delete_blocked_while_children_exist(): void
    {
        $staff = $this->makeStaff();
        $prefix = trim((string) config('admin.path_prefix'), '/');
        [$fashion, $shoes] = $this->seedTree();

        $this->actingAs($staff, 'staff')
            ->delete('/'.$prefix.'/categories/'.$shoes->rid.'?from='.$fashion->rid)
            ->assertRedirect();

        $this->assertModelExists($shoes);
    }

    public function test_index_renders_whole_tree(): void
    {
        $staff = $this->makeStaff();
        $prefix = trim((string) config('admin.path_prefix'), '/');
        [$fashion] = $this->seedTree();

        $this->actingAs($staff, 'staff')
            ->get('/'.$prefix.'/categories')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Categories/Index')
                ->where('tree.0.rid', $fashion->rid)
                ->where('tree.0.children.0.children.0.label', 'Sneakers')
                ->where('tree.0.isActive', true)
            );
    }

    public function test_edit_parent_tree_excludes_own_subtree(): void
    {
        $staff = $this->makeStaff();
        $prefix = trim((string) config('admin.path_prefix'), '/');
        [$fashion, $shoes] = $this->seedTree();

        $this->actingAs($staff, 'staff')
            ->get('/'.$prefix.'/categories/'.$shoes->rid.'/edit')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Categories/Edit')
                ->where('parentTree.0.rid', $fashion->rid)
                ->has('parentTree.0.children', 0)
            );
    }

    public function test_update_rejects_moving_under_own_descendant_as_field_error(): void
    {
        $staff = $this->makeStaff();
        $prefix = trim((string) config('admin.path_prefix'), '/');
        [$fashion] = $this->seedTree();
        $sneakers = Category::query()->where('slug', 'fashion-shoes-sneakers')->firstOrFail();

        $this->actingAs($staff, 'staff')
            ->put('/'.$prefix.'/categories/'.$fashion->rid, [
                'label' => 'Fashion',
                'slug' => 'fashion',
                'parent_rid' => $sneakers->rid,
                'sort_order' => 10,
                'is_active' => true,
            ])
            ->assertSessionHasErrors('parent_rid');

        $this->assertNull($fashion->refresh()->parent_id);
    }

    public function test_store_child_redirects_to_parent_tree(): void
    {
        $staff = $this->makeStaff();
        $prefix = trim((string) config('admin.path_prefix'), '/');
        [$fashion] = $this->seedTree();

        $this->actingAs($staff, 'staff')
            ->post('/'.$prefix.'/categories', [
                'label' => 'Bags',
                'slug' => 'fashion-bags',
                'parent_rid' => $fashion->rid,
                'sort_order' => 0,
                'is_active' => true,
            ])
            ->assertRedirect('/'.$prefix.'/categories/'.$fashion->rid);
    }

    /**
     * @return array{0: Category, 1: Category}
     */
    private function seedTree(): array
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

        return [$fashion, $shoes];
    }

    private function makeStaff(): User
    {
        $this->seed(AdminPermissionsSeeder::class);

        $staff = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-tree@handco.test',
            'password' => 'password',
            'user_type' => 'staff',
            'email_verified_at' => now(),
            'must_change_password' => false,
            'two_factor_enabled' => false,
        ]);

        $staff->syncPermissions(AdminPermissionsSeeder::PERMISSIONS);

        return $staff;
    }
}
