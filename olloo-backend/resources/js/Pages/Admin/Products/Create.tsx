import { FormEvent, useState } from 'react';
import { Link, useForm } from '@inertiajs/react';
import AdminLayout from '../Layouts/AdminLayout';
import CategoryTreePicker, { CategoryPickerNode, ancestorRids, findPath } from '@/Components/CategoryTreePicker';
import TagMultiSelect from '@/Components/TagMultiSelect';
import ImageUploadField, { uploadImages } from '@/Components/ImageUploader';
import {
    Badge,
    ErrorSummary,
    Field,
    FormSection,
    ImagePreview,
    Switch,
    fieldError,
    focusFirstError,
    inputClass,
    slugify,
    useUnsavedChangesWarning,
    type FormFieldMeta,
} from '@/Components/Form';
import { useRoute } from '@/utils/route';

type Props = {
    categoryTree: CategoryPickerNode[];
    allTags: string[];
    shippingClasses: ShippingClassOption[];
    defaultHandlingDays: number;
    attributeDefinitions: ProductAttributeDefinition[];
    currencyCode: string;
    defaultCategoryRid: string | null;
};

export default function Create({
    categoryTree,
    allTags,
    shippingClasses,
    defaultHandlingDays,
    attributeDefinitions,
    currencyCode,
    defaultCategoryRid,
}: Props) {
    const route = useRoute();
    const form = useForm<ProductFormData>({
        name: '',
        slug: '',
        category_rid: defaultCategoryRid ?? '',
        tags: [],
        shipping_class_rid: '',
        price: '',
        original_price: '',
        discount_notice: '',
        description_lines: [],
        image: '',
        gallery: [],
        is_active: true,
        is_featured: false,
        is_new_arrival: false,
        attributes: [],
        variants: [newVariant(true)],
    });

    const submit = (intent: 'save' | 'add_another') => {
        form.transform((data) => ({ ...productPayload(data), intent }));
        form.post(route('admin.products.store'), {
            onError: (errors) => focusFirstError(PRODUCT_FIELDS, errors),
        });
    };

    return (
        <AdminLayout title="New product">
            <ProductForm
                form={form}
                categoryTree={categoryTree}
                allTags={allTags}
                shippingClasses={shippingClasses}
                defaultHandlingDays={defaultHandlingDays}
                attributeDefinitions={attributeDefinitions}
                currencyCode={currencyCode}
                autoSlug
                onSubmit={() => submit('save')}
                submitLabel="Create product"
                secondaryAction={{ label: 'Create and add another', onClick: () => submit('add_another') }}
                cancelHref={route('admin.products.index')}
            />
        </AdminLayout>
    );
}

export type ProductFormData = {
    name: string;
    slug: string;
    category_rid: string;
    tags: string[];
    shipping_class_rid: string;
    price: string | number;
    original_price: string | number;
    discount_notice: string;
    description_lines: string[];
    image: string;
    gallery: GalleryRow[];
    is_active: boolean;
    is_featured: boolean;
    is_new_arrival: boolean;
    attributes: ProductAttributeRow[];
    variants: VariantFormData[];
};

export type ProductAttributeRow = { attribute_rid: string; value: string };

/**
 * `variant` is an index into the form's variants, not a SKU, so a SKU typed
 * or renamed in the same edit keeps the link. productPayload turns it into the
 * SKU the server expects.
 */
export type GalleryRow = { path: string; variant: number | null };

export function productPayload(data: ProductFormData) {
    return {
        ...data,
        gallery: data.gallery.map((row) => ({
            path: row.path,
            variant_sku: row.variant === null ? null : (data.variants[row.variant]?.sku ?? null),
        })),
    };
}

/** A category attribute, with the values products already use (for suggestions). */
export type ProductAttributeDefinition = {
    rid: string;
    key: string;
    label: string;
    options: string[];
    categoryRid: string;
    categoryLabel: string;
    usedValues: string[];
};

export type ShippingClassOption = { rid: string; name: string };

export type VariantFormData = {
    rid: string | null;
    name: string;
    size: string;
    color: string;
    sku: string;
    price: string | number;
    track_stock: boolean;
    stock_quantity: string | number;
    /** Days before dispatch; empty uses the store default. */
    handling_days: string | number;
    is_default: boolean;
};

export function newVariant(isDefault: boolean): VariantFormData {
    return { rid: null, name: isDefault ? 'Standard' : '', size: '', color: '', sku: '', price: '', track_stock: true, stock_quantity: '', handling_days: '', is_default: isDefault };
}

type Section = 'basics' | 'organization' | 'pricing' | 'inventory' | 'attributes' | 'media' | 'visibility';

// Display order; also decides which error gets focus first.
export const PRODUCT_FIELDS: FormFieldMeta<Section>[] = [
    { key: 'name', label: 'Name', section: 'basics' },
    { key: 'slug', label: 'Slug', section: 'basics' },
    { key: 'description_lines', label: 'Description', section: 'basics' },
    { key: 'category_rid', label: 'Category', section: 'organization' },
    { key: 'tags', label: 'Tags', section: 'organization' },
    { key: 'price', label: 'Price', section: 'pricing' },
    { key: 'original_price', label: 'Original price', section: 'pricing' },
    { key: 'discount_notice', label: 'Discount notice', section: 'pricing' },
    { key: 'shipping_class_rid', label: 'Shipping class', section: 'inventory' },
    { key: 'variants', label: 'Variants', section: 'inventory' },
    { key: 'attributes', label: 'Attributes', section: 'attributes' },
    { key: 'image', label: 'Image', section: 'media' },
    { key: 'gallery', label: 'Gallery', section: 'media' },
    { key: 'is_active', label: 'Visible in store', section: 'visibility' },
    { key: 'is_featured', label: 'Featured', section: 'visibility' },
    { key: 'is_new_arrival', label: 'New arrival', section: 'visibility' },
];

type ProductFormHelper = ReturnType<typeof useForm<ProductFormData>>;

export function ProductForm({
    form,
    categoryTree,
    allTags,
    shippingClasses,
    defaultHandlingDays,
    attributeDefinitions,
    currencyCode,
    autoSlug = false,
    onSubmit,
    submitLabel,
    secondaryAction,
    cancelHref,
}: {
    form: ProductFormHelper;
    categoryTree: CategoryPickerNode[];
    allTags: string[];
    shippingClasses: ShippingClassOption[];
    defaultHandlingDays: number;
    attributeDefinitions: ProductAttributeDefinition[];
    currencyCode: string;
    /** Keep the slug in step with the name until staff edit it by hand (new products only). */
    autoSlug?: boolean;
    onSubmit: () => void;
    submitLabel: string;
    secondaryAction?: { label: string; onClick: () => void };
    cancelHref: string;
}) {
    const { data, setData, errors, processing, isDirty } = form;
    const [slugLinked, setSlugLinked] = useState(autoSlug);
    useUnsavedChangesWarning(isDirty && !processing);
    const route = useRoute();
    const uploadUrl = route('admin.uploads.store');

    const sectionHasError = (section: Section) =>
        PRODUCT_FIELDS.some((field) => field.section === section && fieldError(errors, field.key));

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        onSubmit();
    };

    const discount = discountPercent(data.price, data.original_price);

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,42rem)_minmax(0,20rem)] lg:items-start">
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
                <ErrorSummary fields={PRODUCT_FIELDS} errors={errors} noun="product" />

                <FormSection title="Basics" hasError={sectionHasError('basics')}>
                    <Field id="name" label="Name" error={errors.name}>
                        <input
                            id="field-name"
                            type="text"
                            value={data.name}
                            onChange={(e) => {
                                setData((prev) => ({
                                    ...prev,
                                    name: e.target.value,
                                    slug: slugLinked ? slugify(e.target.value) : prev.slug,
                                }));
                            }}
                            aria-invalid={Boolean(errors.name)}
                            className={inputClass(errors.name)}
                            placeholder="Leather tote bag"
                            autoFocus={autoSlug}
                        />
                    </Field>

                    <Field
                        id="slug"
                        label="Slug"
                        error={errors.slug}
                        helper={
                            slugLinked ? (
                                'Used in the storefront link. Filled in from the name.'
                            ) : (
                                <>
                                    Used in the storefront link. Changing it breaks links already shared.{' '}
                                    {data.name && data.slug !== slugify(data.name) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSlugLinked(true);
                                                setData('slug', slugify(data.name));
                                            }}
                                            className="cursor-pointer text-slate-700 underline underline-offset-2 hover:text-slate-900"
                                        >
                                            Match the name
                                        </button>
                                    )}
                                </>
                            )
                        }
                    >
                        <input
                            id="field-slug"
                            type="text"
                            value={data.slug}
                            onChange={(e) => {
                                setSlugLinked(false);
                                setData('slug', e.target.value);
                            }}
                            onBlur={(e) => setData('slug', slugify(e.target.value))}
                            aria-invalid={Boolean(errors.slug)}
                            className={inputClass(errors.slug, 'w-full font-mono')}
                            placeholder="leather-tote-bag"
                        />
                    </Field>
                </FormSection>

                <FormSection title="Description" description="Shown on the product page, one paragraph per line." hasError={sectionHasError('basics')}>
                    <DescriptionEditor
                        lines={data.description_lines}
                        onChange={(description_lines) => setData('description_lines', description_lines)}
                        error={fieldError(errors, 'description_lines')}
                    />
                </FormSection>

                <FormSection
                    title="Organization"
                    description="Where shoppers find the product and how it is grouped."
                    hasError={sectionHasError('organization')}
                >
                    <Field
                        id="category_rid"
                        label="Category"
                        asLabel={false}
                        helper="Pick the most specific category. It also shows under every parent."
                        error={errors.category_rid}
                    >
                        <CategoryTreePicker
                            id="field-category_rid"
                            nodes={categoryTree}
                            value={data.category_rid}
                            onChange={(rid) => setData('category_rid', rid)}
                            invalid={Boolean(errors.category_rid)}
                            required
                        />
                    </Field>

                    <Field
                        id="tags"
                        label="Tags (optional)"
                        asLabel={false}
                        helper="The first tag is shown as the product badge in the store."
                        error={fieldError(errors, 'tags')}
                    >
                        <TagMultiSelect
                            id="field-tags"
                            value={data.tags}
                            onChange={(tags) => setData('tags', tags)}
                            suggestions={allTags}
                            invalid={Boolean(fieldError(errors, 'tags'))}
                        />
                    </Field>

                </FormSection>

                <FormSection title="Pricing" hasError={sectionHasError('pricing')}>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field id="price" label="Price" error={errors.price}>
                            <MoneyInput
                                id="price"
                                currency={currencyCode}
                                value={data.price}
                                onChange={(value) => setData('price', value)}
                                error={errors.price}
                                placeholder="149.00"
                            />
                        </Field>
                        <Field
                            id="original_price"
                            label="Original price (optional)"
                            helper={
                                discount !== null
                                    ? `Shown struck through. Shoppers see ${discount}% off.`
                                    : 'Set it only when on sale. Shown struck through.'
                            }
                            error={errors.original_price}
                        >
                            <MoneyInput
                                id="original_price"
                                currency={currencyCode}
                                value={data.original_price}
                                onChange={(value) => setData('original_price', value)}
                                error={errors.original_price}
                                placeholder="199.00"
                            />
                        </Field>
                    </div>
                    <Field
                        id="discount_notice"
                        label="Discount notice (optional)"
                        helper="Shown under the price, for example “Ramadan sale ends Friday”."
                        error={errors.discount_notice}
                    >
                        <input
                            id="field-discount_notice"
                            type="text"
                            value={data.discount_notice}
                            onChange={(e) => setData('discount_notice', e.target.value)}
                            aria-invalid={Boolean(errors.discount_notice)}
                            className={inputClass(errors.discount_notice)}
                            placeholder="Sale ends Friday"
                            maxLength={255}
                        />
                    </Field>
                </FormSection>

                <FormSection
                    title="Inventory and shipping"
                    description="What shoppers actually buy. Each variant has its own SKU, stock and handling time; leave its price empty to use the product price. Delivery time and fee shown to shoppers are worked out from this and the shipping rules."
                    hasError={sectionHasError('inventory')}
                >
                    <Field
                        id="shipping_class_rid"
                        label="Shipping class"
                        helper="Standard unless the product ships differently, for example bulky items with their own shipping rules."
                        error={errors.shipping_class_rid}
                    >
                        <select
                            id="field-shipping_class_rid"
                            value={data.shipping_class_rid}
                            onChange={(e) => setData('shipping_class_rid', e.target.value)}
                            aria-invalid={Boolean(errors.shipping_class_rid)}
                            className={inputClass(errors.shipping_class_rid, 'w-full cursor-pointer sm:w-72')}
                        >
                            <option value="">Standard</option>
                            {shippingClasses.map((shippingClass) => (
                                <option key={shippingClass.rid} value={shippingClass.rid}>
                                    {shippingClass.name}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <VariantsEditor
                        variants={data.variants}
                        onChange={(variants, removedIndex) =>
                            setData((current) => ({
                                ...current,
                                variants,
                                gallery:
                                    removedIndex === undefined
                                        ? current.gallery
                                        : current.gallery.map((row) => ({
                                              ...row,
                                              variant:
                                                  row.variant === null || row.variant === removedIndex
                                                      ? null
                                                      : row.variant > removedIndex
                                                        ? row.variant - 1
                                                        : row.variant,
                                          })),
                            }))
                        }
                        errors={errors}
                        currencyCode={currencyCode}
                        productSlug={data.slug}
                        defaultHandlingDays={defaultHandlingDays}
                    />
                </FormSection>

                <FormSection
                    title="Attributes"
                    description="Facts shoppers filter by. The category decides which attributes are available."
                    hasError={sectionHasError('attributes')}
                >
                    <AttributesEditor
                        rows={data.attributes}
                        onChange={(attributes) => setData('attributes', attributes)}
                        errors={errors}
                        definitions={attributeDefinitions}
                        categoryRid={data.category_rid}
                        categoryTree={categoryTree}
                    />
                </FormSection>

                <FormSection title="Images" hasError={sectionHasError('media')}>
                    <Field
                        id="image"
                        label="Cover image"
                        helper="Upload a file, or paste a full URL or a path such as /images/products/tote.jpg."
                        error={errors.image}
                    >
                        <ImageUploadField
                            id="image"
                            value={data.image}
                            onChange={(value) => setData('image', value)}
                            folder="products"
                            uploadUrl={uploadUrl}
                            error={errors.image}
                            placeholder="https://cdn.example.com/tote.jpg"
                        />
                    </Field>
                    <GalleryEditor
                        rows={data.gallery}
                        variants={data.variants}
                        onChange={(gallery) => setData('gallery', gallery)}
                        error={fieldError(errors, 'gallery')}
                        uploadUrl={uploadUrl}
                    />
                </FormSection>

                <FormSection title="Visibility" hasError={sectionHasError('visibility')}>
                    <div className="divide-y divide-slate-100">
                        <Switch
                            id="field-is_active"
                            checked={data.is_active}
                            onChange={(value) => setData('is_active', value)}
                            label="Visible in store"
                            description="Turn off to hide the product without deleting it."
                        />
                        <Switch
                            id="field-is_featured"
                            checked={data.is_featured}
                            onChange={(value) => setData('is_featured', value)}
                            label="Featured"
                            description="Show it in featured sections on the storefront."
                        />
                        <Switch
                            id="field-is_new_arrival"
                            checked={data.is_new_arrival}
                            onChange={(value) => setData('is_new_arrival', value)}
                            label="New arrival"
                            description="List it under new arrivals."
                        />
                    </div>
                </FormSection>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="submit"
                        disabled={processing}
                        className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {processing ? 'Saving…' : submitLabel}
                    </button>
                    {secondaryAction && (
                        <button
                            type="button"
                            disabled={processing}
                            onClick={secondaryAction.onClick}
                            className="cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {secondaryAction.label}
                        </button>
                    )}
                    <Link href={cancelHref} className="cursor-pointer rounded-md px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                        Cancel
                    </Link>
                </div>
            </form>

            <ProductPreview data={data} categoryTree={categoryTree} currencyCode={currencyCode} discount={discount} />
        </div>
    );
}

function ProductPreview({
    data,
    categoryTree,
    currencyCode,
    discount,
}: {
    data: ProductFormData;
    categoryTree: CategoryPickerNode[];
    currencyCode: string;
    discount: number | null;
}) {
    const categoryPath = data.category_rid ? findPath(categoryTree, data.category_rid)?.join(' / ') : null;
    const price = formatAmount(data.price);
    const original = discount !== null ? formatAmount(data.original_price) : null;

    return (
        <aside className="rounded-lg border border-slate-200 bg-white p-5 text-sm lg:sticky lg:top-20">
            <h2 className="font-semibold text-slate-900">Storefront preview</h2>
            <div className="mt-3 overflow-hidden rounded-md border border-slate-100">
                <ImagePreview src={data.image} className="aspect-square w-full" />
                <div className="space-y-1 p-3">
                    {data.tags[0] && <Badge tone="violet">{data.tags[0]}</Badge>}
                    <p className="font-medium text-slate-900">{data.name || 'Product name'}</p>
                    <p>
                        <span className="font-semibold text-slate-900">
                            {currencyCode} {price ?? '0.00'}
                        </span>
                        {original && (
                            <>
                                <span className="ml-2 text-slate-400 line-through">
                                    {currencyCode} {original}
                                </span>
                                <span className="ml-2 text-emerald-700">-{discount}%</span>
                            </>
                        )}
                    </p>
                </div>
            </div>
            <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-slate-600">
                <div>
                    <dt className="text-xs text-slate-500">Category</dt>
                    <dd className="text-slate-800">{categoryPath ?? 'Not chosen yet'}</dd>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {data.is_active ? <Badge tone="green">Visible</Badge> : <Badge tone="amber">Hidden</Badge>}
                    {data.is_featured && <Badge tone="sky">Featured</Badge>}
                    {data.is_new_arrival && <Badge tone="violet">New arrival</Badge>}
                </div>
            </dl>
            {!data.is_active && (
                <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-amber-800">Hidden, so shoppers cannot find or buy it.</p>
            )}
        </aside>
    );
}

function MoneyInput({
    id,
    currency,
    value,
    onChange,
    error,
    placeholder,
}: {
    id: string;
    currency: string;
    value: string | number;
    onChange: (value: string) => void;
    error?: string;
    placeholder?: string;
}) {
    return (
        <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-slate-500">
                {currency}
            </span>
            <input
                id={`field-${id}`}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-invalid={Boolean(error)}
                className={inputClass(error, 'w-full pl-14')}
                placeholder={placeholder}
            />
        </div>
    );
}

function formatAmount(value: string | number): string | null {
    if (value === '' || Number.isNaN(Number(value))) {
        return null;
    }
    return Number(value).toFixed(2);
}

function discountPercent(price: string | number, original: string | number): number | null {
    const p = Number(price);
    const o = Number(original);
    if (price === '' || original === '' || !(o > p) || p < 0) {
        return null;
    }
    return Math.round(((o - p) / o) * 100);
}

function VariantsEditor({
    variants,
    onChange,
    errors,
    currencyCode,
    productSlug,
    defaultHandlingDays,
}: {
    variants: VariantFormData[];
    /** `removedIndex` is set when a row was removed, so gallery links can follow. */
    onChange: (variants: VariantFormData[], removedIndex?: number) => void;
    errors: Record<string, string>;
    currencyCode: string;
    productSlug: string;
    defaultHandlingDays: number;
}) {
    const update = (index: number, patch: Partial<VariantFormData>) =>
        onChange(variants.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)));
    const makeDefault = (index: number) => onChange(variants.map((variant, i) => ({ ...variant, is_default: i === index })));
    const remove = (index: number) => {
        const next = variants.filter((_, i) => i !== index);
        if (next.length > 0 && !next.some((variant) => variant.is_default)) next[0] = { ...next[0], is_default: true };
        onChange(next, index);
    };
    const suggestSku = (variant: VariantFormData) =>
        [productSlug, variant.name].map((part) => slugify(part)).filter(Boolean).join('-').toUpperCase();

    return (
        <div className="space-y-3">
            {errors.variants && <p className="text-sm text-red-600">{errors.variants}</p>}
            {variants.map((variant, index) => {
                const err = (field: string) => errors[`variants.${index}.${field}`];
                return (
                    <div
                        key={variant.rid ?? `new-${index}`}
                        id={index === 0 ? 'field-variants' : undefined}
                        tabIndex={index === 0 ? -1 : undefined}
                        className="rounded-md border border-slate-200 p-4"
                    >
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem]">
                            <Field id={`variants-${index}-name`} label="Name" error={err('name')}>
                                <input
                                    id={`field-variants-${index}-name`}
                                    type="text"
                                    value={variant.name}
                                    onChange={(e) => update(index, { name: e.target.value })}
                                    aria-invalid={Boolean(err('name'))}
                                    className={inputClass(err('name'))}
                                    placeholder="Standard"
                                />
                            </Field>
                            <Field id={`variants-${index}-size`} label="Size (optional)" error={err('size')}>
                                <input
                                    id={`field-variants-${index}-size`}
                                    type="text"
                                    value={variant.size}
                                    onChange={(e) => update(index, { size: e.target.value })}
                                    aria-invalid={Boolean(err('size'))}
                                    className={inputClass(err('size'))}
                                    placeholder="M"
                                    maxLength={60}
                                />
                            </Field>
                            <Field id={`variants-${index}-color`} label="Color (optional)" error={err('color')}>
                                <input
                                    id={`field-variants-${index}-color`}
                                    type="text"
                                    value={variant.color}
                                    onChange={(e) => update(index, { color: e.target.value })}
                                    aria-invalid={Boolean(err('color'))}
                                    className={inputClass(err('color'))}
                                    placeholder="Navy"
                                    maxLength={60}
                                />
                            </Field>
                            <Field id={`variants-${index}-sku`} label="SKU" error={err('sku')}>
                                <input
                                    id={`field-variants-${index}-sku`}
                                    type="text"
                                    value={variant.sku}
                                    onChange={(e) => update(index, { sku: e.target.value.toUpperCase() })}
                                    onFocus={() => {
                                        if (!variant.sku && suggestSku(variant)) update(index, { sku: suggestSku(variant) });
                                    }}
                                    aria-invalid={Boolean(err('sku'))}
                                    className={inputClass(err('sku'), 'w-full font-mono')}
                                    placeholder="TOTE-STD"
                                />
                            </Field>
                            <Field id={`variants-${index}-price`} label="Price (optional)" error={err('price')}>
                                <MoneyInput
                                    id={`variants-${index}-price`}
                                    currency={currencyCode}
                                    value={variant.price}
                                    onChange={(value) => update(index, { price: value })}
                                    error={err('price')}
                                    placeholder="Product price"
                                />
                            </Field>
                        </div>
                        <div className="mt-3 flex flex-wrap items-end gap-4">
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={variant.track_stock}
                                    onChange={(e) => update(index, { track_stock: e.target.checked })}
                                    className="cursor-pointer accent-slate-900"
                                />
                                Track stock
                            </label>
                            {variant.track_stock ? (
                                <Field id={`variants-${index}-stock_quantity`} label="In stock" error={err('stock_quantity')}>
                                    <input
                                        id={`field-variants-${index}-stock_quantity`}
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={variant.stock_quantity}
                                        onChange={(e) => update(index, { stock_quantity: e.target.value })}
                                        aria-invalid={Boolean(err('stock_quantity'))}
                                        className={inputClass(err('stock_quantity'), 'w-28')}
                                    />
                                </Field>
                            ) : (
                                <span className="text-sm text-slate-500">Made to order: never sells out.</span>
                            )}
                            <Field
                                id={`variants-${index}-handling_days`}
                                label="Handling time (business days)"
                                error={err('handling_days')}
                            >
                                <input
                                    id={`field-variants-${index}-handling_days`}
                                    type="number"
                                    min={0}
                                    max={365}
                                    step={1}
                                    value={variant.handling_days}
                                    onChange={(e) => update(index, { handling_days: e.target.value })}
                                    aria-invalid={Boolean(err('handling_days'))}
                                    className={inputClass(err('handling_days'), 'w-36')}
                                    placeholder={`Default (${defaultHandlingDays})`}
                                />
                            </Field>
                            <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                                <input
                                    type="radio"
                                    name="default-variant"
                                    checked={variant.is_default}
                                    onChange={() => makeDefault(index)}
                                    className="cursor-pointer accent-slate-900"
                                />
                                Default
                            </label>
                            {variants.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => remove(index)}
                                    className="cursor-pointer text-sm text-red-600 underline underline-offset-2 hover:text-red-800"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
            <button
                type="button"
                onClick={() => onChange([...variants, newVariant(variants.length === 0)])}
                className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
                Add variant
            </button>
        </div>
    );
}

function DescriptionEditor({
    lines,
    onChange,
    error,
}: {
    lines: string[];
    onChange: (lines: string[]) => void;
    error?: string;
}) {
    const update = (index: number, value: string) => onChange(lines.map((line, i) => (i === index ? value : line)));

    return (
        <div className="space-y-2" id="field-description_lines" tabIndex={-1}>
            {lines.length === 0 && <p className="text-sm text-slate-500">No description yet. Add a paragraph shoppers see on the product page.</p>}
            {lines.map((line, index) => (
                <div key={index} className="flex items-start gap-2">
                    <textarea
                        aria-label={`Description paragraph ${index + 1}`}
                        value={line}
                        onChange={(e) => update(index, e.target.value)}
                        rows={2}
                        maxLength={2000}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                        placeholder="Detail shoppers should know"
                    />
                    <button
                        type="button"
                        onClick={() => onChange(lines.filter((_, i) => i !== index))}
                        className="cursor-pointer py-2 text-sm text-red-600 underline underline-offset-2 hover:text-red-800"
                    >
                        Remove
                    </button>
                </div>
            ))}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {lines.length < 50 && (
                <button
                    type="button"
                    onClick={() => onChange([...lines, ''])}
                    className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                    Add paragraph
                </button>
            )}
        </div>
    );
}

function GalleryEditor({
    rows,
    variants,
    onChange,
    error,
    uploadUrl,
}: {
    rows: GalleryRow[];
    variants: VariantFormData[];
    onChange: (rows: GalleryRow[]) => void;
    error?: string;
    uploadUrl: string;
}) {
    const update = (index: number, patch: Partial<GalleryRow>) =>
        onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const upload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        setUploadError(null);
        try {
            const uploaded = await uploadImages(Array.from(files).slice(0, 10 - rows.length), 'products', uploadUrl);
            const added = uploaded
                .filter((path) => !rows.some((row) => row.path === path)).map((path) => ({ path, variant: null }));
            onChange([...rows, ...added].slice(0, 10));
        } catch (e) {
            setUploadError(e instanceof Error ? e.message : 'Upload failed. Try again.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="mt-4 space-y-2" id="field-gallery" tabIndex={-1}>
            <p className="text-sm font-medium text-slate-700">Gallery (optional, up to 10)</p>
            {rows.length === 0 && <p className="text-sm text-slate-500">Extra images shown after the cover on the product page.</p>}
            {rows.length > 0 && variants.length > 1 && (
                <p className="text-sm text-slate-500">
                    Pick the variant an image shows. The product page slides to it when a shopper picks that variant.
                </p>
            )}
            {rows.map((row, index) => (
                <div key={index} className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                    <ImagePreview src={row.path} className="h-12 w-12" />
                    <input
                        type="text"
                        aria-label={`Gallery image ${index + 1}`}
                        value={row.path}
                        onChange={(e) => update(index, { path: e.target.value })}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                        placeholder="https://cdn.example.com/tote-2.jpg"
                    />
                    {variants.length > 1 && (
                        <select
                            aria-label={`Variant shown in gallery image ${index + 1}`}
                            value={row.variant ?? ''}
                            onChange={(e) => update(index, { variant: e.target.value === '' ? null : Number(e.target.value) })}
                            className="w-full cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none sm:w-56"
                        >
                            <option value="">No variant</option>
                            {variants.map((variant, i) => (
                                <option key={i} value={i}>
                                    {variant.name.trim() || `Variant ${i + 1}`}
                                    {variant.sku.trim() ? ` (${variant.sku.trim()})` : ''}
                                </option>
                            ))}
                        </select>
                    )}
                    <button
                        type="button"
                        onClick={() => onChange(rows.filter((_, i) => i !== index))}
                        className="cursor-pointer py-2 text-sm text-red-600 underline underline-offset-2 hover:text-red-800"
                    >
                        Remove
                    </button>
                </div>
            ))}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {rows.length < 10 && (
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => onChange([...rows, { path: '', variant: null }])}
                        className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                    >
                        Add image
                    </button>
                    <label className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
                        {uploading ? 'Uploading…' : 'Upload images'}
                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            disabled={uploading}
                            className="hidden"
                            aria-label="Upload gallery images"
                            onChange={(e) => {
                                void upload(e.target.files);
                                e.target.value = '';
                            }}
                        />
                    </label>
                </div>
            )}
            {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
        </div>
    );
}

function AttributesEditor({
    rows,
    onChange,
    errors,
    definitions,
    categoryRid,
    categoryTree,
}: {
    rows: ProductAttributeRow[];
    onChange: (rows: ProductAttributeRow[]) => void;
    errors: Record<string, string>;
    definitions: ProductAttributeDefinition[];
    categoryRid: string;
    categoryTree: CategoryPickerNode[];
}) {
    const route = useRoute();
    const lineage = categoryRid ? [...(ancestorRids(categoryTree, categoryRid) ?? []), categoryRid] : [];
    const available = definitions
        .filter((definition) => lineage.includes(definition.categoryRid))
        .sort((a, b) => lineage.indexOf(a.categoryRid) - lineage.indexOf(b.categoryRid));
    const byRid = new Map(definitions.map((definition) => [definition.rid, definition]));
    const unused = available.filter((definition) => !rows.some((row) => row.attribute_rid === definition.rid));
    const categoryName = categoryRid ? findPath(categoryTree, categoryRid)?.at(-1) : null;

    const update = (index: number, patch: Partial<ProductAttributeRow>) =>
        onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

    if (!categoryRid) {
        return <p className="text-sm text-slate-500" id="field-attributes">Pick a category first. Its attributes appear here.</p>;
    }

    return (
        <div className="space-y-3" id="field-attributes" tabIndex={-1}>
            {available.length === 0 && rows.length === 0 && (
                <p className="text-sm text-slate-500">
                    {categoryName ? `"${categoryName}"` : 'This category'} has no attributes yet.{' '}
                    <Link
                        href={route('admin.categories.edit', categoryRid)}
                        className="cursor-pointer underline underline-offset-2 hover:text-slate-900"
                    >
                        Add them on the category
                    </Link>
                    , then set values here.
                </p>
            )}

            {rows.map((row, index) => {
                const definition = byRid.get(row.attribute_rid);
                const offered = available.some((candidate) => candidate.rid === row.attribute_rid);
                const pickError = errors[`attributes.${index}.attribute_rid`];
                const valueError = errors[`attributes.${index}.value`];
                const choices = available.filter(
                    (candidate) => candidate.rid === row.attribute_rid || !rows.some((other) => other.attribute_rid === candidate.rid),
                );
                const listId = `attribute-values-${index}`;
                const pickProblem = pickError ?? (definition && !offered ? 'not offered by this category' : undefined);

                return (
                    <div key={index} className="grid gap-2 sm:grid-cols-[14rem_minmax(0,1fr)_auto] sm:items-start">
                        <div>
                            <select
                                id={`field-attributes-${index}-attribute_rid`}
                                aria-label="Attribute"
                                value={row.attribute_rid}
                                onChange={(e) => update(index, { attribute_rid: e.target.value, value: '' })}
                                aria-invalid={Boolean(pickProblem)}
                                className={inputClass(pickProblem, 'w-full cursor-pointer')}
                            >
                                <option value="" disabled>
                                    Pick an attribute
                                </option>
                                {definition && !offered && <option value={definition.rid}>{definition.label}</option>}
                                {choices.map((candidate) => (
                                    <option key={candidate.rid} value={candidate.rid}>
                                        {candidate.label}
                                    </option>
                                ))}
                            </select>
                            {pickError ? (
                                <p className="mt-1 text-sm text-red-600">{pickError}</p>
                            ) : (
                                definition &&
                                !offered && (
                                    <p className="mt-1 text-sm text-amber-700">
                                        Not offered by this category (it belongs to {definition.categoryLabel}). Remove it to save.
                                    </p>
                                )
                            )}
                        </div>
                        <div>
                            {definition && definition.options.length > 0 ? (
                                <select
                                    aria-label={`${definition.label} value`}
                                    value={row.value}
                                    onChange={(e) => update(index, { value: e.target.value })}
                                    aria-invalid={Boolean(valueError)}
                                    className={inputClass(valueError, 'w-full cursor-pointer')}
                                >
                                    <option value="" disabled>
                                        Pick a value
                                    </option>
                                    {definition.options.map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                    {row.value && !definition.options.includes(row.value) && <option value={row.value}>{row.value}</option>}
                                </select>
                            ) : (
                                <>
                                    <input
                                        type="text"
                                        aria-label={definition ? `${definition.label} value` : 'Value'}
                                        value={row.value}
                                        onChange={(e) => update(index, { value: e.target.value })}
                                        disabled={!definition}
                                        aria-invalid={Boolean(valueError)}
                                        className={inputClass(valueError, 'w-full disabled:cursor-not-allowed disabled:bg-slate-50')}
                                        placeholder={definition ? 'Value' : 'Pick an attribute first'}
                                        list={listId}
                                    />
                                    <datalist id={listId}>
                                        {(definition?.usedValues ?? []).map((value) => (
                                            <option key={value} value={value} />
                                        ))}
                                    </datalist>
                                </>
                            )}
                            {valueError && <p className="mt-1 text-sm text-red-600">{valueError}</p>}
                        </div>
                        <button
                            type="button"
                            onClick={() => onChange(rows.filter((_, i) => i !== index))}
                            className="cursor-pointer py-2 text-sm text-red-600 underline underline-offset-2 hover:text-red-800"
                        >
                            Remove
                        </button>
                    </div>
                );
            })}

            {unused.length > 0 && (
                <button
                    type="button"
                    onClick={() => onChange([...rows, { attribute_rid: unused.length === 1 ? unused[0].rid : '', value: '' }])}
                    className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                    Add attribute
                </button>
            )}
            {available.length > 0 && unused.length === 0 && (
                <p className="text-sm text-slate-500">Every attribute this category offers is set.</p>
            )}
        </div>
    );
}
