import { Link } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import { Badge } from '@/Components/Form';
import { useRoute } from '@/utils/route';

export type PlacementRow = {
    rid: string;
    slotLabel: string;
    imageUrl: string | null;
    /** Video slots only; imageUrl is then the poster. */
    videoUrl: string | null;
    altText: string | null;
    title: string | null;
    description: string | null;
    buttonText: string | null;
    linkUrl: string | null;
    sortOrder: number;
    isActive: boolean;
};

type Slot = {
    page: string;
    position: string;
    label: string;
    placements: PlacementRow[];
};

type Props = {
    slots: Slot[];
    orphans: PlacementRow[];
    canEdit: boolean;
};

export default function Index({ slots, orphans, canEdit }: Props) {
    const route = useRoute();

    return (
        <AdminLayout title="Banners">
            <p className="mb-4 max-w-3xl text-sm text-slate-600">
                Banners rotate in their place on the store, in the order shown. Only active banners appear. A place with
                no active banner shows the store's built-in images.
            </p>
            <div className="space-y-6">
                {slots.map((slot) => (
                    <section key={`${slot.page}.${slot.position}`} className="rounded-lg border border-slate-200 bg-white">
                        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                            <h2 className="text-base font-semibold text-slate-900">{slot.label}</h2>
                            {canEdit && (
                                <Link
                                    href={route('admin.placements.create', { slot: `${slot.page}.${slot.position}` })}
                                    className="cursor-pointer rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
                                >
                                    Add banner
                                </Link>
                            )}
                        </header>
                        <PlacementList rows={slot.placements} canEdit={canEdit} empty="No banners here yet." />
                    </section>
                ))}
                {orphans.length > 0 && (
                    <section className="rounded-lg border border-amber-300 bg-white">
                        <header className="border-b border-amber-200 px-4 py-3">
                            <h2 className="text-base font-semibold text-slate-900">Not shown anywhere</h2>
                            <p className="mt-1 text-sm text-slate-600">
                                The store no longer has a place for these banners. Move them to another place or delete
                                them.
                            </p>
                        </header>
                        <PlacementList rows={orphans} canEdit={canEdit} empty="" />
                    </section>
                )}
            </div>
        </AdminLayout>
    );
}

function PlacementList({ rows, canEdit, empty }: { rows: PlacementRow[]; canEdit: boolean; empty: string }) {
    const route = useRoute();

    if (rows.length === 0) {
        return <p className="px-4 py-6 text-sm text-slate-500">{empty}</p>;
    }

    return (
        <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
                <li key={row.rid} className="flex flex-wrap items-center gap-4 px-4 py-3 text-sm">
                    <span className="flex h-16 w-40 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-400">
                        {row.imageUrl ? (
                            <img src={row.imageUrl} alt={row.altText ?? ''} className="h-full w-full object-cover" />
                        ) : (
                            'No image'
                        )}
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-900">
                                {row.title || row.altText || 'Untitled banner'}
                            </span>
                            <Badge tone={row.isActive ? 'green' : 'slate'}>{row.isActive ? 'Active' : 'Hidden'}</Badge>
                            {row.videoUrl && <Badge tone="slate">Video</Badge>}
                        </div>
                        <div className="mt-0.5 truncate text-slate-500">
                            Order {row.sortOrder}
                            {row.linkUrl ? ` · Links to ${row.linkUrl}` : ' · No link'}
                        </div>
                    </div>
                    {canEdit && (
                        <Link href={route('admin.placements.edit', row.rid)} className="cursor-pointer underline">
                            Edit
                        </Link>
                    )}
                </li>
            ))}
        </ul>
    );
}
