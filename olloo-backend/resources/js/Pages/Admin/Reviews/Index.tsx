import { router } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import Pagination from '@/Components/Pagination';
import { useRoute } from '@/utils/route';

type ReviewRow = {
    rid: string;
    rating: number;
    title: string | null;
    body: string | null;
    authorDisplay: string | null;
    isApproved: boolean;
    createdAt: string | null;
    product: { rid: string; name: string } | null;
    user: { rid: string; name: string; email: string } | null;
};

type Props = {
    reviews: {
        data: ReviewRow[];
        links: Array<{ url: string | null; label: string; active: boolean }>;
    };
    filters: { approved: string };
    canEdit: boolean;
    canDelete: boolean;
};

export default function Index({ reviews, filters, canEdit, canDelete }: Props) {
    const route = useRoute();

    return (
        <AdminLayout title="Reviews">
            <div className="mb-4">
                <select
                    className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    value={filters.approved}
                    onChange={(e) =>
                        router.get(
                            route('admin.reviews.index'),
                            { approved: e.target.value || undefined },
                            { preserveState: true, replace: true },
                        )
                    }
                >
                    <option value="">All</option>
                    <option value="1">Approved</option>
                    <option value="0">Pending</option>
                </select>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">Product</th>
                            <th className="px-4 py-3 font-medium">Rating</th>
                            <th className="px-4 py-3 font-medium">Review</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reviews.data.map((review) => (
                            <tr key={review.rid} className="border-b border-slate-100">
                                <td className="px-4 py-3">{review.product?.name ?? '-'}</td>
                                <td className="px-4 py-3">{review.rating}/5</td>
                                <td className="px-4 py-3">
                                    <div className="font-medium">{review.title ?? '(no title)'}</div>
                                    <div className="text-xs text-slate-500 line-clamp-2">{review.body}</div>
                                </td>
                                <td className="px-4 py-3">{review.isApproved ? 'approved' : 'pending'}</td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-2">
                                        {canEdit && (
                                            <button
                                                type="button"
                                                className="cursor-pointer underline"
                                                onClick={() =>
                                                    router.put(route('admin.reviews.updateStatus', review.rid), {
                                                        is_approved: !review.isApproved,
                                                    })
                                                }
                                            >
                                                {review.isApproved ? 'Unapprove' : 'Approve'}
                                            </button>
                                        )}
                                        {canDelete && (
                                            <button
                                                type="button"
                                                className="cursor-pointer text-red-600 underline"
                                                onClick={() => {
                                                    if (confirm('Delete this review?')) {
                                                        router.delete(route('admin.reviews.destroy', review.rid));
                                                    }
                                                }}
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {reviews.data.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                    No reviews found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Pagination links={reviews.links} />
        </AdminLayout>
    );
}
