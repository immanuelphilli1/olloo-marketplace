<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Permission;

class StaffController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('view_staff'), 403);

        $search = trim((string) $request->query('search', ''));

        $query = User::query()->where('user_type', 'staff');

        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($q) use ($like): void {
                $q->where('name', 'like', $like)
                    ->orWhere('email', 'like', $like)
                    ->orWhere('rid', 'like', $like);
            });
        }

        $staff = $query->latest()->paginate((int) config('admin.per_page'))->withQueryString()->through(fn (User $user) => [
            'rid' => $user->rid,
            'name' => $user->name,
            'email' => $user->email,
            'mustChangePassword' => (bool) $user->must_change_password,
            'twoFactorEnabled' => (bool) $user->two_factor_enabled,
            'permissions' => $user->getAllPermissions()->pluck('name')->values()->all(),
            'createdAt' => $user->created_at?->toIso8601String(),
        ]);

        return Inertia::render('Admin/Staff/Index', [
            'staff' => $staff,
            'filters' => ['search' => $search],
            'canCreate' => (bool) $request->user('staff')?->can('create_staff'),
            'canEdit' => (bool) $request->user('staff')?->can('edit_staff'),
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless($request->user('staff')?->can('create_staff'), 403);

        return Inertia::render('Admin/Staff/Create', [
            'permissions' => $this->permissionOptions(),
            'canEditPermissions' => (bool) $request->user('staff')?->can('edit_staff_permissions'),
            'canForcePasswordChange' => (bool) $request->user('staff')?->can('force_staff_password_change'),
            'canPromoteCustomers' => (bool) $request->user('staff')?->can('view_customers'),
            // Loaded only by the picker's partial reload, never on the first visit.
            'customers' => Inertia::optional(fn () => $this->customerMatches($request)),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('create_staff'), 403);

        // A promoted customer keeps their name, email and shop account, so those
        // fields only apply to a new account.
        $rules = [
            'customer' => $request->user('staff')?->can('view_customers')
                ? ['nullable', 'string', Rule::exists('users', 'rid')->where('user_type', 'customer')->whereNull('deleted_at')]
                : ['prohibited'],
            'name' => ['exclude_with:customer', 'required', 'string', 'max:255'],
            'email' => ['exclude_with:customer', 'required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->withoutTrashed()],
            // One password serves the shop and the admin, so a promoted customer
            // keeps theirs unless staff set a new one.
            'password' => [$request->filled('customer') ? 'nullable' : 'required', 'string', 'min:8', 'confirmed'],
        ];

        if ($request->user('staff')?->can('edit_staff_permissions')) {
            $rules['permissions'] = ['nullable', 'array'];
            $rules['permissions.*'] = ['string', Rule::exists('permissions', 'name')->where('guard_name', 'staff')];
        }

        if ($request->user('staff')?->can('force_staff_password_change')) {
            $rules['force_password_change'] = ['nullable', 'boolean'];
        }

        $validated = $request->validate($rules);

        $user = empty($validated['customer'])
            ? new User(['name' => $validated['name'], 'email' => $validated['email']])
            : User::query()->where('rid', $validated['customer'])->firstOrFail();

        if ($user->password === null && empty($validated['password'])) {
            throw ValidationException::withMessages([
                'password' => 'This customer signs in with Google only. Set a password for the admin.',
            ]);
        }

        if (! empty($validated['password'])) {
            $user->password = $validated['password'];
        }

        $user->fill([
            'user_type' => 'staff',
            'is_guest' => false,
            'must_change_password' => $request->user('staff')?->can('force_staff_password_change')
                ? (bool) ($validated['force_password_change'] ?? false)
                : false,
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();

        if ($request->user('staff')?->can('edit_staff_permissions')) {
            $user->syncPermissions($validated['permissions'] ?? []);
        }

        return redirect()->route('admin.staff.index')->with('success', empty($validated['customer'])
            ? 'Staff member created.'
            : 'Customer promoted to staff.');
    }

    public function edit(Request $request, User $staff): Response
    {
        abort_unless($request->user('staff')?->can('edit_staff'), 403);
        abort_unless($staff->user_type === 'staff', 404);

        return Inertia::render('Admin/Staff/Edit', [
            'member' => [
                'rid' => $staff->rid,
                'name' => $staff->name,
                'email' => $staff->email,
                'mustChangePassword' => (bool) $staff->must_change_password,
                'permissions' => $staff->getAllPermissions()->pluck('name')->values()->all(),
            ],
            'permissions' => $this->permissionOptions(),
            'canEditPermissions' => (bool) $request->user('staff')?->can('edit_staff_permissions'),
            'canEditPasswords' => (bool) $request->user('staff')?->can('edit_staff_passwords'),
            'canForcePasswordChange' => (bool) $request->user('staff')?->can('force_staff_password_change'),
            'canDelete' => (bool) $request->user('staff')?->can('delete_staff')
                && $staff->rid !== $request->user('staff')?->rid,
        ]);
    }

    public function update(Request $request, User $staff): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('edit_staff'), 403);
        abort_unless($staff->user_type === 'staff', 404);

        $rules = [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($staff->id)->withoutTrashed()],
        ];

        if ($request->user('staff')?->can('edit_staff_passwords')) {
            $rules['password'] = ['nullable', 'string', 'min:8', 'confirmed'];
        }

        if ($request->user('staff')?->can('edit_staff_permissions')) {
            $rules['permissions'] = ['nullable', 'array'];
            $rules['permissions.*'] = ['string', Rule::exists('permissions', 'name')->where('guard_name', 'staff')];
        }

        if ($request->user('staff')?->can('force_staff_password_change')) {
            $rules['force_password_change'] = ['nullable', 'boolean'];
        }

        $validated = $request->validate($rules);

        $staff->name = $validated['name'];
        $staff->email = $validated['email'];

        if ($request->user('staff')?->can('edit_staff_passwords') && ! empty($validated['password'])) {
            $staff->password = $validated['password'];
        }

        if ($request->user('staff')?->can('force_staff_password_change') && array_key_exists('force_password_change', $validated)) {
            $staff->must_change_password = (bool) $validated['force_password_change'];
        }

        $staff->save();

        if ($request->user('staff')?->can('edit_staff_permissions')) {
            $staff->syncPermissions($validated['permissions'] ?? []);
        }

        return redirect()->route('admin.staff.index')->with('success', 'Staff member updated.');
    }

    public function destroy(Request $request, User $staff): RedirectResponse
    {
        abort_unless($request->user('staff')?->can('delete_staff'), 403);
        abort_unless($staff->user_type === 'staff', 404);

        if ($staff->rid === $request->user('staff')?->rid) {
            return back()->with('error', 'You cannot delete your own staff account.');
        }

        $staff->syncPermissions([]);
        $staff->delete();

        return redirect()->route('admin.staff.index')->with('success', 'Staff member deleted.');
    }

    /**
     * @return list<array{rid: string, name: string, email: string, isGuest: bool}>
     */
    private function customerMatches(Request $request): array
    {
        $search = trim((string) $request->query('customer_search', ''));

        if ($search === '' || ! $request->user('staff')?->can('view_customers')) {
            return [];
        }

        $like = '%'.$search.'%';

        return User::query()
            ->where('user_type', 'customer')
            ->where(fn ($q) => $q->where('name', 'like', $like)->orWhere('email', 'like', $like))
            ->orderBy('email')
            ->limit(10)
            ->get()
            ->map(fn (User $user) => [
                'rid' => $user->rid,
                'name' => $user->name,
                'email' => $user->email,
                'isGuest' => (bool) $user->is_guest,
            ])
            ->all();
    }

    /**
     * @return list<string>
     */
    private function permissionOptions(): array
    {
        return Permission::query()
            ->where('guard_name', 'staff')
            ->orderBy('name')
            ->pluck('name')
            ->values()
            ->all();
    }
}
