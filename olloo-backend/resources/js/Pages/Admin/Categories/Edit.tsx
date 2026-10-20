import { router, useForm } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import { CATEGORY_FIELDS, CategoryForm, type AttributeDefinition, type CategoryFormData } from './Create';
import { CategoryPickerNode } from '@/Components/CategoryTreePicker';
import { focusFirstError } from '@/Components/Form';
import { useRoute } from '@/utils/route';

type Props = {
    category: {
        rid: string;
        label: string;
        slug: string;
        image: string | null;
        parentRid: string | null;
        sortOrder: number;
        isActive: boolean;
        isReturnable: boolean;
        returnWindowDays: number | null;
        childrenCount: number;
        productsCount: number;
        attributes: Array<{ rid: string; key: string; label: string; options: string[]; productsCount: number }>;
    };
    definitions: AttributeDefinition[];
    parentTree: CategoryPickerNode[];
    canDelete: boolean;
};

export default function Edit({ category, parentTree, definitions, canDelete }: Props) {
    const route = useRoute();
    const form = useForm<CategoryFormData>({
        label: category.label,
        slug: category.slug,
        image: category.image ?? '',
        parent_rid: category.parentRid ?? '',
        sort_order: category.sortOrder,
        is_active: category.isActive,
        is_returnable: category.isReturnable,
        return_window_days: category.returnWindowDays ?? '',
        attributes: category.attributes.map((attribute) => ({
            rid: attribute.rid,
            label: attribute.label,
            options: attribute.options,
            productsCount: attribute.productsCount,
        })),
    });

    const deleteBlockedReason =
        category.childrenCount > 0
            ? `It still has ${category.childrenCount} ${category.childrenCount === 1 ? 'subcategory' : 'subcategories'}. Move or delete them first.`
            : category.productsCount > 0
              ? `It still has ${category.productsCount} ${category.productsCount === 1 ? 'product' : 'products'}. Move them to another category first.`
              : null;

    const destroy = () => {
        if (confirm(`Delete "${category.label}"? This cannot be undone.`)) {
            router.delete(route('admin.categories.destroy', category.rid));
        }
    };

    return (
        <AdminLayout title={`Edit ${category.label}`}>
            <CategoryForm
                form={form}
                parentTree={parentTree}
                definitions={definitions}
                ownRid={category.rid}
                onSubmit={() =>
                    form.put(route('admin.categories.update', category.rid), {
                        onError: (errors) => focusFirstError(CATEGORY_FIELDS, errors),
                    })
                }
                submitLabel="Save changes"
                cancelHref={route('admin.categories.show', category.rid)}
            />

            {canDelete && (
                <section className="mt-10 max-w-2xl rounded-lg border border-red-200 bg-white p-5">
                    <h2 className="text-base font-semibold text-red-800">Delete category</h2>
                    <p className="mt-1 text-sm text-slate-600">
                        {deleteBlockedReason ??
                            'To take it off the store for now, turn off "Visible in store" instead. Deleting cannot be undone.'}
                    </p>
                    <button
                        type="button"
                        onClick={destroy}
                        disabled={deleteBlockedReason !== null}
                        className="mt-3 cursor-pointer rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white"
                    >
                        Delete category
                    </button>
                </section>
            )}
        </AdminLayout>
    );
}
