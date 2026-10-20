import { Link } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import { useRoute } from '@/utils/route';

type Props = {
    inquiry: {
        rid: string;
        type: string;
        email: string;
        name: string | null;
        payload: Record<string, unknown> | null;
        createdAt: string | null;
    };
};

export default function Show({ inquiry }: Props) {
    const route = useRoute();

    return (
        <AdminLayout title={`Inquiry ${inquiry.type}`}>
            <div className="mb-4">
                <Link href={route('admin.inquiries.index')} className="cursor-pointer text-sm underline">
                    Back to inquiries
                </Link>
            </div>
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 text-sm">
                <div><span className="text-slate-500">Type:</span> {inquiry.type}</div>
                <div><span className="text-slate-500">Name:</span> {inquiry.name ?? '-'}</div>
                <div><span className="text-slate-500">Email:</span> {inquiry.email}</div>
                <div>
                    <span className="text-slate-500">Created:</span>{' '}
                    {inquiry.createdAt ? new Date(inquiry.createdAt).toLocaleString() : '-'}
                </div>
                <pre className="overflow-x-auto rounded-md bg-slate-50 p-3 text-xs">
                    {JSON.stringify(inquiry.payload ?? {}, null, 2)}
                </pre>
            </div>
        </AdminLayout>
    );
}
