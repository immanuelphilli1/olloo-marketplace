import { router, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '../Layouts/AdminLayout';
import {
    PRODUCT_FIELDS,
    ProductForm,
    newVariant,
    productPayload,
    type ProductAttributeDefinition,
    type ProductAttributeRow,
    type ProductFormData,
    type ShippingClassOption,
} from './Create';
import { CategoryPickerNode } from '@/Components/CategoryTreePicker';
import { focusFirstError } from '@/Components/Form';
import { useRoute } from '@/utils/route';

type Product = {
    rid: string;
    name: string;
    slug: string;
    categoryRid: string | null;
    tags: string[];
    shippingClassRid: string | null;
    attributes: ProductAttributeRow[];
    variants: Array<{
        rid: string;
        name: string;
        size: string | null;
        color: string | null;
        sku: string;
        price: number | null;
        trackStock: boolean;
        stockQuantity: number | null;
        handlingDays: number | null;
        isDefault: boolean;
    }>;
    currencyCode: string;
    price: number;
    originalPrice: number | null;
    discountNotice: string | null;
    descriptionLines: string[];
    image: string | null;
    gallery: { path: string; variantSku: string | null }[];
    isActive: boolean;
    isFeatured: boolean;
    isNewArrival: boolean;
};

type Props = {
    product: Product;
    categoryTree: CategoryPickerNode[];
    allTags: string[];
    shippingClasses: ShippingClassOption[];
    defaultHandlingDays: number;
    attributeDefinitions: ProductAttributeDefinition[];
};

type SharedProps = {
    auth: { staff: { permissions: string[] } | null };
};

export default function Edit({ product, categoryTree, allTags, shippingClasses, defaultHandlingDays, attributeDefinitions }: Props) {
    const route = useRoute();
    const canDelete = usePage<SharedProps>().props.auth.staff?.permissions.includes('delete_products') ?? false;
    const form = useForm<ProductFormData>({
        name: product.name,
        slug: product.slug,
        category_rid: product.categoryRid ?? '',
        tags: product.tags ?? [],
        shipping_class_rid: product.shippingClassRid ?? '',
        price: product.price,
        original_price: product.originalPrice ?? '',
        discount_notice: product.discountNotice ?? '',
        description_lines: product.descriptionLines ?? [],
        image: product.image ?? '',
        gallery: (product.gallery ?? []).map((image) => {
            const variant = product.variants.findIndex((v) => image.variantSku !== null && v.sku === image.variantSku);
            return { path: image.path, variant: variant === -1 ? null : variant };
        }),
        is_active: product.isActive,
        is_featured: product.isFeatured,
        is_new_arrival: product.isNewArrival,
        attributes: product.attributes,
        variants:
            product.variants.length > 0
                ? product.variants.map((variant) => ({
                      rid: variant.rid,
                      name: variant.name,
                      size: variant.size ?? '',
                      color: variant.color ?? '',
                      sku: variant.sku,
                      price: variant.price ?? '',
                      track_stock: variant.trackStock,
                      stock_quantity: variant.stockQuantity ?? '',
                      handling_days: variant.handlingDays ?? '',
                      is_default: variant.isDefault,
                  }))
                : [newVariant(true)],
    });

    const submit = () => {
        form.transform(productPayload);
        form.put(route('admin.products.update', product.rid), {
            onError: (errors) => focusFirstError(PRODUCT_FIELDS, errors),
        });
    };

    const destroy = () => {
        if (confirm(`Delete "${product.name}"? Shoppers lose access to it right away. This cannot be undone.`)) {
            router.delete(route('admin.products.destroy', product.rid));
        }
    };

    return (
        <AdminLayout title={`Edit ${product.name}`}>
            <ProductForm
                form={form}
                categoryTree={categoryTree}
                allTags={allTags}
                shippingClasses={shippingClasses}
                defaultHandlingDays={defaultHandlingDays}
                attributeDefinitions={attributeDefinitions}
                currencyCode={product.currencyCode}
                onSubmit={submit}
                submitLabel="Save changes"
                cancelHref={route('admin.products.index')}
            />

            {canDelete && (
                <section className="mt-10 max-w-2xl rounded-lg border border-red-200 bg-white p-5">
                    <h2 className="text-base font-semibold text-red-800">Delete product</h2>
                    <p className="mt-1 text-sm text-slate-600">
                        To take it off the store for now, turn off "Visible in store" instead. Deleting cannot be undone.
                    </p>
                    <button
                        type="button"
                        onClick={destroy}
                        className="mt-3 cursor-pointer rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                    >
                        Delete product
                    </button>
                </section>
            )}
        </AdminLayout>
    );
}
