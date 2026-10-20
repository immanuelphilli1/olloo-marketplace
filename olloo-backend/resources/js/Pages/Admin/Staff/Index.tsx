import { Link, router } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import Pagination from '@/Components/Pagination';
import { useRoute } from '@/utils/route';

type StaffRow = {
    rid: string;
    name: string;
    email: string;
    mustChangePassword: boolean;
    twoFactorEnabled: boolean;
    permissions: string[];
    createdAt: string | null;
};

type Props = {
    staff: {
        data: StaffRow[];
        links: Array<{ url: string | null; label: string; active: boolean }>;
    };
    filters: { search: string };
    canCreate: boolean;
    canEdit: boolean;
};

export default function Index({ staff, filters, canCreate, canEdit }: Props) {
    const route = useRoute();

    return (
        <AdminLayout title="Staff">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        const data = new FormData(e.currentTarget);
                        router.get(route('admin.staff.index'), {
                            search: String(data.get('search') || '') || undefined,
                        }, { preserveState: true, replace: true });
                    }}
                >
                    <input
                        name="search"
                        defaultValue={filters.search}
                        placeholder="Search name, email, rid"
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                    <button type="submit" className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm">
                        Search
                    </button>
                </form>
                {canCreate && (
                    <Link
                        href={route('admin.staff.create')}
                        className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
                    >
                        New staff
                    </Link>
                )}
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium">Email</th>
                            <th className="px-4 py-3 font-medium">Permissions</th>
                            <th className="px-4 py-3 font-medium">Flags</th>
                            <th className="px-4 py-3 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {staff.data.map((member) => (
                            <tr key={member.rid} className="border-b border-slate-100">
                                <td className="px-4 py-3 font-medium">{member.name}</td>
                                <td className="px-4 py-3">{member.email}</td>
                                <td className="px-4 py-3 text-xs text-slate-600">{member.permissions.length}</td>
                                <td className="px-4 py-3 text-xs text-slate-600">
                                    {[
                                        member.mustChangePassword ? 'force password' : null,
                                        member.twoFactorEnabled ? 'MFA' : null,
                                    ]
                                        .filter(Boolean)
                                        .join(', ') || '-'}
                                </td>
                                <td className="px-4 py-3">
                                    {canEdit && (
                                        <Link
                                            href={route('admin.staff.edit', member.rid)}
                                            className="cursor-pointer underline"
                                        >
                                            Edit
                                        </Link>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {staff.data.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                    No staff found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Pagination links={staff.links} />
        </AdminLayout>
    );
}
