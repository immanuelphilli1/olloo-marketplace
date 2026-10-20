import { Link } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import { useRoute } from '@/utils/route';

type PageRow = {
    rid: string;
    slug: string;
    title: string;
    lastUpdated: string | null;
    blocksCount: number;
};

type Props = {
    pages: PageRow[];
    canEdit: boolean;
};

export default function Index({ pages, canEdit }: Props) {
    const route = useRoute();

    return (
        <AdminLayout title="CMS Pages">
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">Title</th>
                            <th className="px-4 py-3 font-medium">Slug</th>
                            <th className="px-4 py-3 font-medium">Blocks</th>
                            <th className="px-4 py-3 font-medium">Updated</th>
                            <th className="px-4 py-3 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pages.map((page) => (
                            <tr key={page.rid} className="border-b border-slate-100">
                                <td className="px-4 py-3 font-medium">{page.title}</td>
                                <td className="px-4 py-3 font-mono text-xs">{page.slug}</td>
                                <td className="px-4 py-3">{page.blocksCount}</td>
                                <td className="px-4 py-3">{page.lastUpdated ?? '-'}</td>
                                <td className="px-4 py-3">
                                    {canEdit && (
                                        <Link
                                            href={route('admin.cms.edit', page.rid)}
                                            className="cursor-pointer underline"
                                        >
                                            Edit
                                        </Link>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {pages.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                    No CMS pages yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </AdminLayout>
    );
}
