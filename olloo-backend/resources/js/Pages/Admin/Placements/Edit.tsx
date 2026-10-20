import { router, useForm } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import { focusFirstError } from '@/Components/Form';
import { useRoute } from '@/utils/route';
import { PLACEMENT_FIELDS, PlacementForm, type PlacementFormData, type SlotOption } from './Create';
import type { PlacementRow } from './Index';

type Props = {
    placement: PlacementRow & { slot: string; image: string; video: string | null };
    slotOptions: SlotOption[];
    videoSlots: string[];
};

export default function Edit({ placement, slotOptions, videoSlots }: Props) {
    const route = useRoute();
    const form = useForm<PlacementFormData>({
        slot: placement.slot,
        image: placement.image,
        video: placement.video ?? '',
        alt_text: placement.altText ?? '',
        title: placement.title ?? '',
        description: placement.description ?? '',
        button_text: placement.buttonText ?? '',
        link_url: placement.linkUrl ?? '',
        sort_order: placement.sortOrder,
        is_active: placement.isActive,
    });

    const destroy = () => {
        if (confirm('Delete this banner? It disappears from the store at once.')) {
            router.delete(route('admin.placements.destroy', placement.rid));
        }
    };

    return (
        <AdminLayout title="Edit banner">
            <PlacementForm
                form={form}
                slotOptions={slotOptions}
                videoSlots={videoSlots}
                onSubmit={() =>
                    form.put(route('admin.placements.update', placement.rid), {
                        onError: (errors) => focusFirstError(PLACEMENT_FIELDS, errors),
                    })
                }
                submitLabel="Save banner"
                footer={
                    <button
                        type="button"
                        onClick={destroy}
                        className="ml-auto cursor-pointer rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                    >
                        Delete banner
                    </button>
                }
            />
        </AdminLayout>
    );
}
