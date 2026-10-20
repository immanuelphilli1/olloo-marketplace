import { Link, router } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import Pagination from '@/Components/Pagination';
import { useRoute } from '@/utils/route';

type InquiryRow = {
    rid: string;
    type: string;
    email: string;
    name: string | null;
    createdAt: string | null;
};

type Props = {
    inquiries: {
        data: InquiryRow[];
        links: Array<{ url: string | null; label: string; active: boolean }>;
    };
    filters: { type: string };
    types: string[];
};

export default function Index({ inquiries, filters, types }: Props) {
    const route = useRoute();

    return (
        <AdminLayout title="Inquiries">
            <div className="mb-4">
                <select
                    className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    value={filters.type}
                    onChange={(e) =>
                        router.get(
                            route('admin.inquiries.index'),
                            { type: e.target.value || undefined },
                            { preserveState: true, replace: true },
                        )
                    }
                >
                    <option value="">All types</option>
                    {types.map((type) => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">Type</th>
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium">Email</th>
                            <th className="px-4 py-3 font-medium">Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inquiries.data.map((inquiry) => (
                            <tr key={inquiry.rid} className="border-b border-slate-100">
                                <td className="px-4 py-3">
                                    <Link
                                        href={route('admin.inquiries.show', inquiry.rid)}
                                        className="cursor-pointer underline"
                                    >
                                        {inquiry.type}
                                    </Link>
                                </td>
                                <td className="px-4 py-3">{inquiry.name ?? '-'}</td>
                                <td className="px-4 py-3">{inquiry.email}</td>
                                <td className="px-4 py-3">
                                    {inquiry.createdAt ? new Date(inquiry.createdAt).toLocaleString() : '-'}
                                </td>
                            </tr>
                        ))}
                        {inquiries.data.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                                    No inquiries found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Pagination links={inquiries.links} />
        </AdminLayout>
    );
}
