import { FormEvent, useState } from 'react';
import { Link, useForm } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import CategoryTreePicker, { CategoryPickerNode, ancestorRids, findPath } from '@/Components/CategoryTreePicker';
import TagMultiSelect from '@/Components/TagMultiSelect';
import ImageUploadField from '@/Components/ImageUploader';
import {
    ErrorSummary,
    Field,
    FormSection,
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
    parentTree: CategoryPickerNode[];
    defaultParentRid: string | null;
    definitions: AttributeDefinition[];
};

export default function Create({ parentTree, defaultParentRid, definitions }: Props) {
    const route = useRoute();
    const form = useForm<CategoryFormData>({
        label: '',
        slug: '',
        image: '',
        parent_rid: defaultParentRid ?? '',
        sort_order: 0,
        is_active: true,
        is_returnable: true,
        return_window_days: '',
        attributes: [],
    });

    const parentPath = defaultParentRid ? findPath(parentTree, defaultParentRid)?.join(' / ') : null;

    return (
        <AdminLayout title={parentPath ? `New category under ${parentPath}` : 'New category'}>
            <CategoryForm
                form={form}
                parentTree={parentTree}
                definitions={definitions}
                autoSlug
                onSubmit={() =>
                    form.post(route('admin.categories.store'), {
                        onError: (errors) => focusFirstError(CATEGORY_FIELDS, errors),
                    })
                }
                submitLabel="Create category"
                cancelHref={
                    defaultParentRid ? route('admin.categories.show', defaultParentRid) : route('admin.categories.index')
                }
            />
        </AdminLayout>
    );
}

export type CategoryFormData = {
    label: string;
    slug: string;
    image: string;
    parent_rid: string;
    sort_order: number | string;
    is_active: boolean;
    is_returnable: boolean;
    return_window_days: number | string;
    attributes: CategoryAttributeRow[];
};

export type CategoryAttributeRow = {
    rid: string | null;
    label: string;
    options: string[];
    /** Products using it; only known for saved attributes. */
    productsCount?: number;
};

/** Any attribute definition in the store, with the category that owns it. */
export type AttributeDefinition = {
    rid: string;
    key: string;
    label: string;
    options: string[];
    categoryRid: string;
    categoryLabel: string;
};

/** Mirrors CategoryAttribute::keyFromLabel: "Screen size" becomes "screenSize". */
export function attributeKey(label: string): string {
    const words = label
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
    return words.map((word, index) => (index === 0 ? word : word[0].toUpperCase() + word.slice(1))).join('');
}

type Section = 'basics' | 'placement' | 'attributes' | 'media';

export const CATEGORY_FIELDS: FormFieldMeta<Section>[] = [
    { key: 'label', label: 'Name', section: 'basics' },
    { key: 'slug', label: 'Slug', section: 'basics' },
    { key: 'parent_rid', label: 'Parent category', section: 'placement' },
    { key: 'sort_order', label: 'Position', section: 'placement' },
    { key: 'is_active', label: 'Visible in store', section: 'placement' },
    { key: 'is_returnable', label: 'Returnable', section: 'placement' },
    { key: 'return_window_days', label: 'Return window', section: 'placement' },
    { key: 'attributes', label: 'Product attributes', section: 'attributes' },
    { key: 'image', label: 'Image', section: 'media' },
];

export function CategoryForm({
    form,
    parentTree,
    definitions,
    ownRid = null,
    autoSlug = false,
    onSubmit,
    submitLabel,
    cancelHref,
}: {
    form: ReturnType<typeof useForm<CategoryFormData>>;
    parentTree: CategoryPickerNode[];
    definitions: AttributeDefinition[];
    /** The category being edited, so its own saved definitions are not shown as inherited. */
    ownRid?: string | null;
    /** Keep the slug in step with the name until staff edit it by hand (new categories only). */
    autoSlug?: boolean;
    onSubmit: () => void;
    submitLabel: string;
    cancelHref: string;
}) {
    const { data, setData, errors, processing, isDirty } = form;
    const [slugLinked, setSlugLinked] = useState(autoSlug);
    useUnsavedChangesWarning(isDirty && !processing);
    const route = useRoute();
    const uploadUrl = route('admin.uploads.store');

    const sectionHasError = (section: Section) =>
        CATEGORY_FIELDS.some((field) => field.section === section && fieldError(errors, field.key));

    const lineage = data.parent_rid ? [...(ancestorRids(parentTree, data.parent_rid) ?? []), data.parent_rid] : [];
    const inherited = definitions
        .filter((definition) => definition.categoryRid !== ownRid && lineage.includes(definition.categoryRid))
        .sort((a, b) => lineage.indexOf(a.categoryRid) - lineage.indexOf(b.categoryRid));
    const [removedInUse, setRemovedInUse] = useState<CategoryAttributeRow[]>([]);

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (removedInUse.length > 0) {
            const names = removedInUse.map((row) => `"${row.label}" (${row.productsCount} products)`).join(', ');
            if (!confirm(`Removing ${names} also deletes those values from the products. Continue?`)) return;
        }
        onSubmit();
    };

    return (
        <form onSubmit={handleSubmit} noValidate className="max-w-2xl space-y-6">
            <ErrorSummary fields={CATEGORY_FIELDS} errors={errors} noun="category" />

            <FormSection title="Basics" hasError={sectionHasError('basics')}>
                <Field id="label" label="Name" error={errors.label}>
                    <input
                        id="field-label"
                        type="text"
                        value={data.label}
                        onChange={(e) =>
                            setData((prev) => ({
                                ...prev,
                                label: e.target.value,
                                slug: slugLinked ? slugify(e.target.value) : prev.slug,
                            }))
                        }
                        aria-invalid={Boolean(errors.label)}
                        className={inputClass(errors.label)}
                        placeholder="Sneakers"
                        autoFocus={autoSlug}
                    />
                </Field>
                <Field
                    id="slug"
                    label="Slug"
                    error={errors.slug}
                    helper={
                        slugLinked
                            ? 'Used in the storefront link. Filled in from the name.'
                            : 'Used in the storefront link. Changing it breaks links already shared.'
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
                        placeholder="fashion-shoes-sneakers"
                    />
                </Field>
            </FormSection>

            <FormSection title="Placement" description="Where the category sits in the store menu." hasError={sectionHasError('placement')}>
                <Field
                    id="parent_rid"
                    label="Parent category"
                    asLabel={false}
                    helper={data.parent_rid ? undefined : 'Leave empty to make it a top-level category.'}
                    error={errors.parent_rid}
                >
                    <CategoryTreePicker
                        id="field-parent_rid"
                        nodes={parentTree}
                        value={data.parent_rid}
                        onChange={(rid) => setData('parent_rid', rid)}
                        invalid={Boolean(errors.parent_rid)}
                        placeholder="None (top level)"
                        allowClear
                        clearLabel="Make it top level"
                    />
                </Field>
                <Field
                    id="sort_order"
                    label="Position"
                    helper="Lower numbers come first among categories with the same parent."
                    error={errors.sort_order}
                >
                    <input
                        id="field-sort_order"
                        type="number"
                        min={0}
                        step={1}
                        value={data.sort_order}
                        onChange={(e) => setData('sort_order', e.target.value)}
                        aria-invalid={Boolean(errors.sort_order)}
                        className={inputClass(errors.sort_order, 'w-32')}
                    />
                </Field>
                <Switch
                    id="field-is_active"
                    checked={data.is_active}
                    onChange={(value) => setData('is_active', value)}
                    label="Visible in store"
                    description="Turn off to hide the category from the store menu without deleting it."
                />
                <Switch
                    id="field-is_returnable"
                    checked={data.is_returnable}
                    onChange={(value) => setData('is_returnable', value)}
                    label="Returnable"
                    description="Turn off for items that cannot be sent back, such as personalised or final-sale goods."
                />
                {data.is_returnable && (
                    <Field
                        id="return_window_days"
                        label="Return window (days, optional)"
                        helper="Leave empty for no deadline. The tightest window across an order's items applies."
                        error={errors.return_window_days}
                    >
                        <input
                            id="field-return_window_days"
                            type="number"
                            min={1}
                            max={365}
                            step={1}
                            value={data.return_window_days}
                            onChange={(e) => setData('return_window_days', e.target.value)}
                            aria-invalid={Boolean(errors.return_window_days)}
                            className={inputClass(errors.return_window_days, 'w-32')}
                            placeholder="30"
                        />
                    </Field>
                )}
            </FormSection>

            <FormSection
                title="Product attributes"
                description="Facts products in this category (and its subcategories) can have, such as brand or color. Products then pick from these and set a value."
                hasError={sectionHasError('attributes')}
            >
                <AttributesEditor
                    rows={data.attributes}
                    onChange={(rows) => setData('attributes', rows)}
                    onRemoveInUse={(row) => setRemovedInUse((prev) => [...prev, row])}
                    inherited={inherited}
                    errors={errors}
                />
            </FormSection>

            <FormSection title="Image" hasError={sectionHasError('media')}>
                <Field
                    id="image"
                    label="Image (optional)"
                    helper="Upload a file, or paste a full URL or a path such as /images/categories/fashion-shoes.jpg."
                    error={errors.image}
                >
                    <ImageUploadField
                        id="image"
                        value={data.image}
                        onChange={(value) => setData('image', value)}
                        folder="categories"
                        uploadUrl={uploadUrl}
                        error={errors.image}
                        placeholder="/images/categories/fashion-shoes.jpg"
                    />
                </Field>
            </FormSection>

            <div className="flex items-center gap-3">
                <button
                    type="submit"
                    disabled={processing}
                    className="cursor-pointer rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {processing ? 'Saving…' : submitLabel}
                </button>
                <Link href={cancelHref} className="cursor-pointer rounded-md px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                    Cancel
                </Link>
            </div>
        </form>
    );
}

function AttributesEditor({
    rows,
    onChange,
    onRemoveInUse,
    inherited,
    errors,
}: {
    rows: CategoryAttributeRow[];
    onChange: (rows: CategoryAttributeRow[]) => void;
    onRemoveInUse: (row: CategoryAttributeRow) => void;
    inherited: AttributeDefinition[];
    errors: Record<string, string>;
}) {
    const update = (index: number, patch: Partial<CategoryAttributeRow>) =>
        onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

    const remove = (index: number) => {
        const row = rows[index];
        if (row.rid && (row.productsCount ?? 0) > 0) onRemoveInUse(row);
        onChange(rows.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-4" id="field-attributes" tabIndex={-1}>
            {inherited.length > 0 && (
                <div className="rounded-md bg-slate-50 p-3 text-sm">
                    <p className="font-medium text-slate-700">Inherited</p>
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                        {inherited.map((definition) => (
                            <li
                                key={definition.rid}
                                title={`From ${definition.categoryLabel}`}
                                className="rounded-full bg-white px-2.5 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200"
                            >
                                {definition.label}
                                <span className="text-slate-400"> · {definition.categoryLabel}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {rows.length === 0 && <p className="text-sm text-slate-500">No attributes of its own yet.</p>}

            {rows.map((row, index) => {
                const labelError = errors[`attributes.${index}.label`];
                const optionsError =
                    errors[`attributes.${index}.options`] ??
                    Object.entries(errors).find(([key]) => key.startsWith(`attributes.${index}.options.`))?.[1];
                const key = attributeKey(row.label);
                return (
                    <div key={row.rid ?? `new-${index}`} className="rounded-md border border-slate-200 p-4">
                        <div className="grid gap-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
                            <Field
                                id={`attributes-${index}-label`}
                                label="Display name"
                                error={labelError}
                                helper={
                                    row.rid
                                        ? 'Shown to shoppers and staff. Renaming keeps existing values and filters.'
                                        : key
                                          ? `Shown to shoppers. Filter key: ${key}`
                                          : 'Shown to shoppers, for example "Screen size".'
                                }
                            >
                                <input
                                    id={`field-attributes-${index}-label`}
                                    type="text"
                                    value={row.label}
                                    onChange={(e) => update(index, { label: e.target.value })}
                                    aria-invalid={Boolean(labelError)}
                                    className={inputClass(labelError)}
                                    maxLength={120}
                                    placeholder="Screen size"
                                />
                            </Field>
                            <Field
                                id={`attributes-${index}-options`}
                                label="Allowed values (optional)"
                                asLabel={false}
                                error={optionsError}
                                helper="Leave empty to let staff type any value. Set a list to keep filters tidy."
                            >
                                <TagMultiSelect
                                    value={row.options}
                                    onChange={(options) => update(index, { options })}
                                    max={100}
                                    placeholder="Any value"
                                    searchPlaceholder="Type a value and press Enter"
                                    invalid={Boolean(optionsError)}
                                />
                            </Field>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                            <span className="text-slate-500">
                                {row.rid ? `Used by ${row.productsCount ?? 0} ${row.productsCount === 1 ? 'product' : 'products'}` : 'New'}
                            </span>
                            <button
                                type="button"
                                onClick={() => remove(index)}
                                className="cursor-pointer text-red-600 underline underline-offset-2 hover:text-red-800"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                );
            })}

            <button
                type="button"
                onClick={() => onChange([...rows, { rid: null, label: '', options: [] }])}
                className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
                Add attribute
            </button>
        </div>
    );
}
