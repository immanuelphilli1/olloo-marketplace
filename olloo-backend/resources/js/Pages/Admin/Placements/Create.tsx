import { FormEvent } from 'react';
import { Link, useForm, type InertiaFormProps } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import ImageUploadField from '@/Components/ImageUploader';
import VideoUploadField from '@/Components/VideoUploader';
import {
    ErrorSummary,
    Field,
    FormSection,
    Switch,
    fieldError,
    focusFirstError,
    inputClass,
    useUnsavedChangesWarning,
    type FormFieldMeta,
} from '@/Components/Form';
import { useRoute } from '@/utils/route';

export type SlotOption = { value: string; label: string };

export type PlacementFormData = {
    slot: string;
    image: string;
    video: string;
    alt_text: string;
    title: string;
    description: string;
    button_text: string;
    link_url: string;
    sort_order: number | string;
    is_active: boolean;
};

type Section = 'place' | 'image' | 'text' | 'visibility';

export const PLACEMENT_FIELDS: FormFieldMeta<Section>[] = [
    { key: 'slot', label: 'Where it shows', section: 'place' },
    { key: 'video', label: 'Video', section: 'image' },
    { key: 'image', label: 'Image', section: 'image' },
    { key: 'alt_text', label: 'Image description', section: 'image' },
    { key: 'title', label: 'Title', section: 'text' },
    { key: 'description', label: 'Description', section: 'text' },
    { key: 'button_text', label: 'Button text', section: 'text' },
    { key: 'link_url', label: 'Link', section: 'text' },
    { key: 'sort_order', label: 'Order', section: 'visibility' },
    { key: 'is_active', label: 'Active', section: 'visibility' },
];

type Props = {
    slotOptions: SlotOption[];
    slot: string;
    /** Slots that show a video, with the image as its poster. */
    videoSlots: string[];
};

export default function Create({ slotOptions, slot, videoSlots }: Props) {
    const route = useRoute();
    const form = useForm<PlacementFormData>({
        slot,
        image: '',
        video: '',
        alt_text: '',
        title: '',
        description: '',
        button_text: '',
        link_url: '',
        sort_order: 0,
        is_active: true,
    });

    return (
        <AdminLayout title="New banner">
            <PlacementForm
                form={form}
                slotOptions={slotOptions}
                videoSlots={videoSlots}
                onSubmit={() =>
                    form.post(route('admin.placements.store'), {
                        onError: (errors) => focusFirstError(PLACEMENT_FIELDS, errors),
                    })
                }
                submitLabel="Add banner"
            />
        </AdminLayout>
    );
}

export function PlacementForm({
    form,
    slotOptions,
    videoSlots,
    onSubmit,
    submitLabel,
    footer,
}: {
    form: InertiaFormProps<PlacementFormData>;
    slotOptions: SlotOption[];
    videoSlots: string[];
    onSubmit: () => void;
    submitLabel: string;
    footer?: React.ReactNode;
}) {
    const route = useRoute();
    const { data, setData, errors, processing, isDirty } = form;
    useUnsavedChangesWarning(isDirty && !processing);
    const isVideo = videoSlots.includes(data.slot);

    const sectionHasError = (section: Section) =>
        PLACEMENT_FIELDS.some((field) => field.section === section && fieldError(errors, field.key));

    const submit = (event: FormEvent) => {
        event.preventDefault();
        onSubmit();
    };

    return (
        <form onSubmit={submit} className="max-w-3xl space-y-4" noValidate>
            <ErrorSummary fields={PLACEMENT_FIELDS} errors={errors} noun="banner" />

            <FormSection title="Where it shows" hasError={sectionHasError('place')}>
                <Field id="slot" label="Place on the store" error={fieldError(errors, 'slot')}>
                    <select
                        id="field-slot"
                        value={data.slot}
                        onChange={(e) => setData('slot', e.target.value)}
                        className={`${inputClass(fieldError(errors, 'slot'))} cursor-pointer`}
                    >
                        <option value="">Choose a place</option>
                        {slotOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </Field>
            </FormSection>

            <FormSection
                title={isVideo ? 'Video' : 'Image'}
                description={
                    isVideo
                        ? 'A short silent loop for the thin strip at the top of every page on desktop, about 30 times wider than it is tall (for example 2880 × 96 pixels). Keep it small: an MP4 (H.264) of 2 MB or less starts at once and plays on every device.'
                        : 'Use a wide image, for example 2400 × 640 pixels. The store crops the edges on small screens, so keep the subject in the middle.'
                }
                hasError={sectionHasError('image')}
            >
                {isVideo && (
                    <Field id="video" label="Video" error={fieldError(errors, 'video')} asLabel={false}>
                        <VideoUploadField
                            id="video"
                            value={data.video}
                            onChange={(value) => setData('video', value)}
                            uploadUrl={route('admin.uploads.video')}
                            error={fieldError(errors, 'video')}
                        />
                    </Field>
                )}
                <Field
                    id="image"
                    label={isVideo ? 'Poster image' : 'Image'}
                    helper={
                        isVideo
                            ? 'Shown before the video plays, and instead of it when a browser blocks autoplay (for example iPhone Low Power Mode). Use a still from the video.'
                            : undefined
                    }
                    error={fieldError(errors, 'image')}
                    asLabel={false}
                >
                    <ImageUploadField
                        id="image"
                        value={data.image}
                        onChange={(value) => setData('image', value)}
                        folder="placements"
                        uploadUrl={route('admin.uploads.store')}
                        error={fieldError(errors, 'image')}
                        placeholder="https://"
                    />
                </Field>
                <Field
                    id="alt_text"
                    label={isVideo ? 'Video description' : 'Image description'}
                    helper="Read aloud to shoppers who use a screen reader. Describe what it shows."
                    error={fieldError(errors, 'alt_text')}
                >
                    <input
                        id="field-alt_text"
                        value={data.alt_text}
                        onChange={(e) => setData('alt_text', e.target.value)}
                        className={inputClass(fieldError(errors, 'alt_text'))}
                        placeholder="Living room with a grey sofa and wooden side tables"
                    />
                </Field>
            </FormSection>

            <FormSection
                title={isVideo ? 'Link' : 'Text and link'}
                description={
                    isVideo
                        ? 'Optional. The strip shows no text; a link makes the whole strip clickable.'
                        : 'All optional. Leave the text empty if the image already contains it.'
                }
                hasError={sectionHasError('text')}
            >
                {!isVideo && (
                    <>
                        <Field id="title" label="Title" error={fieldError(errors, 'title')}>
                            <input
                                id="field-title"
                                value={data.title}
                                onChange={(e) => setData('title', e.target.value)}
                                className={inputClass(fieldError(errors, 'title'))}
                            />
                        </Field>
                        <Field id="description" label="Description" error={fieldError(errors, 'description')}>
                            <textarea
                                id="field-description"
                                rows={2}
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                className={inputClass(fieldError(errors, 'description'))}
                            />
                        </Field>
                    </>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                        id="link_url"
                        label="Link"
                        helper="Where a click goes. A store path such as /category/fashion, or a full URL."
                        error={fieldError(errors, 'link_url')}
                    >
                        <input
                            id="field-link_url"
                            value={data.link_url}
                            onChange={(e) => setData('link_url', e.target.value)}
                            className={inputClass(fieldError(errors, 'link_url'))}
                            placeholder="/category/fashion"
                        />
                    </Field>
                    {!isVideo && (
                        <Field id="button_text" label="Button text" helper="Shown only when there is a link." error={fieldError(errors, 'button_text')}>
                            <input
                                id="field-button_text"
                                value={data.button_text}
                                onChange={(e) => setData('button_text', e.target.value)}
                                className={inputClass(fieldError(errors, 'button_text'))}
                                placeholder="Shop now"
                            />
                        </Field>
                    )}
                </div>
            </FormSection>

            <FormSection title="Visibility" hasError={sectionHasError('visibility')}>
                <Switch
                    id="field-is_active"
                    checked={data.is_active}
                    onChange={(value) => setData('is_active', value)}
                    label="Active"
                    description="Hidden banners stay saved but do not show on the store."
                />
                <Field
                    id="sort_order"
                    label="Order"
                    helper="Lower numbers show first."
                    error={fieldError(errors, 'sort_order')}
                >
                    <input
                        id="field-sort_order"
                        type="number"
                        min={0}
                        value={data.sort_order}
                        onChange={(e) => setData('sort_order', e.target.value)}
                        className={inputClass(fieldError(errors, 'sort_order'), 'w-32')}
                    />
                </Field>
            </FormSection>

            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="submit"
                    disabled={processing}
                    className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {submitLabel}
                </button>
                <Link href={route('admin.placements.index')} className="cursor-pointer text-sm underline">
                    Cancel
                </Link>
                {footer}
            </div>
        </form>
    );
}
