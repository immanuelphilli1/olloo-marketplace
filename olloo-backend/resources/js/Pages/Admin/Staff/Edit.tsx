import { FormEvent } from 'react';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import { PermissionChecklist } from './Create';
import { useRoute } from '@/utils/route';

type Props = {
    member: {
        rid: string;
        name: string;
        email: string;
        mustChangePassword: boolean;
        permissions: string[];
    };
    permissions: string[];
    canEditPermissions: boolean;
    canEditPasswords: boolean;
    canForcePasswordChange: boolean;
    canDelete: boolean;
};

type SharedProps = {
    errors: Record<string, string>;
};

export default function Edit({
    member,
    permissions,
    canEditPermissions,
    canEditPasswords,
    canForcePasswordChange,
    canDelete,
}: Props) {
    const route = useRoute();
    const { errors } = usePage<SharedProps>().props;
    const { data, setData, put, processing } = useForm({
        name: member.name,
        email: member.email,
        password: '',
        password_confirmation: '',
        force_password_change: member.mustChangePassword,
        permissions: member.permissions,
    });

    const togglePermission = (name: string) => {
        setData(
            'permissions',
            data.permissions.includes(name)
                ? data.permissions.filter((p) => p !== name)
                : [...data.permissions, name],
        );
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        put(route('admin.staff.update', member.rid));
    };

    return (
        <AdminLayout title={`Edit ${member.name}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
                <Link href={route('admin.staff.index')} className="cursor-pointer text-sm underline">
                    Back to staff
                </Link>
                {canDelete && (
                    <button
                        type="button"
                        className="cursor-pointer text-sm text-red-600 underline"
                        onClick={() => {
                            if (confirm(`Delete staff "${member.name}"?`)) {
                                router.delete(route('admin.staff.destroy', member.rid));
                            }
                        }}
                    >
                        Delete
                    </button>
                )}
            </div>
            <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-lg border border-slate-200 bg-white p-5">
                <label className="block text-sm">
                    <span className="mb-1 block text-slate-700">Name</span>
                    <input
                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        required
                    />
                    {errors.name && <span className="mt-1 block text-sm text-red-600">{errors.name}</span>}
                </label>
                <label className="block text-sm">
                    <span className="mb-1 block text-slate-700">Email</span>
                    <input
                        type="email"
                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        required
                    />
                    {errors.email && <span className="mt-1 block text-sm text-red-600">{errors.email}</span>}
                </label>
                {canEditPasswords && (
                    <>
                        <label className="block text-sm">
                            <span className="mb-1 block text-slate-700">New password (optional)</span>
                            <input
                                type="password"
                                className="w-full rounded-md border border-slate-300 px-3 py-2"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                            />
                            {errors.password && (
                                <span className="mt-1 block text-sm text-red-600">{errors.password}</span>
                            )}
                        </label>
                        <label className="block text-sm">
                            <span className="mb-1 block text-slate-700">Confirm password</span>
                            <input
                                type="password"
                                className="w-full rounded-md border border-slate-300 px-3 py-2"
                                value={data.password_confirmation}
                                onChange={(e) => setData('password_confirmation', e.target.value)}
                            />
                        </label>
                    </>
                )}
                {canForcePasswordChange && (
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            className="cursor-pointer"
                            checked={data.force_password_change}
                            onChange={(e) => setData('force_password_change', e.target.checked)}
                        />
                        Force password change on next login
                    </label>
                )}
                {canEditPermissions && (
                    <PermissionChecklist
                        permissions={permissions}
                        selected={data.permissions}
                        onToggle={togglePermission}
                        onChangeAll={(next) => setData('permissions', next)}
                        error={errors.permissions}
                    />
                )}
                <button
                    type="submit"
                    disabled={processing}
                    className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                    Save changes
                </button>
            </form>
        </AdminLayout>
    );
}
