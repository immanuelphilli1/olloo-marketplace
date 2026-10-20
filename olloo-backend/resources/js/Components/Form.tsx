import { router } from '@inertiajs/react';
import { useEffect, type ReactNode } from 'react';

/** A form field the error summary can list and jump to. Its input must have id `field-${key}`. */
export type FormFieldMeta<S extends string> = { key: string; label: string; section: S };

export function inputClass(error: string | undefined, extra = 'w-full') {
    return `${extra} rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
        error ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:border-slate-500 focus:ring-slate-200'
    }`;
}

export function slugify(value: string): string {
    return value
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** Laravel reports array items as `tags.0`; fold them onto their parent field. */
export function fieldError(errors: Record<string, string>, key: string): string | undefined {
    return errors[key] ?? Object.entries(errors).find(([name]) => name.startsWith(`${key}.`))?.[1];
}

export function focusField(key: string) {
    const el = document.getElementById(`field-${key}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
}

export function focusFirstError<S extends string>(fields: FormFieldMeta<S>[], errors: Record<string, string>) {
    const first = fields.find((field) => fieldError(errors, field.key));
    if (first) {
        focusField(first.key);
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/** Warn before leaving a form with unsaved edits, both on tab close and on in-app navigation. */
export function useUnsavedChangesWarning(dirty: boolean) {
    useEffect(() => {
        if (!dirty) return;

        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
        };
        const removeBefore = router.on('before', (event) => {
            // Submits and deletes are intentional; only guard plain navigation.
            if (event.detail.visit.method !== 'get') return;
            if (!window.confirm('You have unsaved changes. Leave this page and lose them?')) {
                event.preventDefault();
            }
        });

        window.addEventListener('beforeunload', onBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            removeBefore();
        };
    }, [dirty]);
}

export function ErrorSummary<S extends string>({
    fields,
    errors,
    noun,
}: {
    fields: FormFieldMeta<S>[];
    errors: Record<string, string>;
    noun: string;
}) {
    const fieldErrors = fields.filter((field) => fieldError(errors, field.key));
    const otherErrors = Object.entries(errors).filter(
        ([key]) => !fields.some((field) => key === field.key || key.startsWith(`${field.key}.`)),
    );

    if (fieldErrors.length === 0 && otherErrors.length === 0) {
        return null;
    }

    return (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {fieldErrors.length > 0 && (
                <>
                    <p className="font-medium">
                        Fix {fieldErrors.length === 1 ? 'this field' : `these ${fieldErrors.length} fields`} to save the{' '}
                        {noun}:
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                        {fieldErrors.map((field) => (
                            <li key={field.key}>
                                <button
                                    type="button"
                                    onClick={() => focusField(field.key)}
                                    className="cursor-pointer text-left underline underline-offset-2 hover:text-red-950"
                                >
                                    {field.label}: {fieldError(errors, field.key)}
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {otherErrors.map(([key, message]) => (
                <p key={key} className={fieldErrors.length > 0 ? 'mt-2' : undefined}>
                    {message}
                </p>
            ))}
        </div>
    );
}

export function FormSection({
    title,
    description,
    hasError,
    children,
}: {
    title: string;
    description?: string;
    hasError: boolean;
    children: ReactNode;
}) {
    return (
        <section className={`space-y-4 rounded-lg border bg-white p-5 ${hasError ? 'border-red-300' : 'border-slate-200'}`}>
            <header>
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                    {title}
                    {hasError && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            Needs attention
                        </span>
                    )}
                </h2>
                {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
            </header>
            {children}
        </section>
    );
}

/**
 * Label + helper + error around one control. `asLabel` is false for custom pickers:
 * a <label> forwards clicks to its control, which would toggle a popover shut.
 */
export function Field({
    id,
    label,
    helper,
    error,
    asLabel = true,
    children,
}: {
    id: string;
    label: string;
    helper?: ReactNode;
    error?: string;
    asLabel?: boolean;
    children: ReactNode;
}) {
    return (
        <div className="text-sm">
            {asLabel ? (
                <label htmlFor={`field-${id}`} className="mb-1 block font-medium text-slate-700">
                    {label}
                </label>
            ) : (
                <span id={`label-${id}`} className="mb-1 block font-medium text-slate-700">
                    {label}
                </span>
            )}
            {children}
            {helper && !error && <p className="mt-1 text-slate-500">{helper}</p>}
            {error && (
                <p id={`error-${id}`} className="mt-1 text-sm text-red-600">
                    {error}
                </p>
            )}
        </div>
    );
}

export function Switch({
    id,
    checked,
    onChange,
    label,
    description,
}: {
    id?: string;
    checked: boolean;
    onChange: (value: boolean) => void;
    label: string;
    description?: string;
}) {
    return (
        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-md py-1">
            <span className="text-sm">
                <span className="block font-medium text-slate-900">{label}</span>
                {description && <span className="mt-0.5 block text-slate-600">{description}</span>}
            </span>
            <span className="relative mt-0.5 inline-flex shrink-0">
                <input
                    id={id}
                    type="checkbox"
                    role="switch"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="peer sr-only"
                />
                <span className="h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-slate-900 peer-focus-visible:ring-2 peer-focus-visible:ring-slate-400 peer-focus-visible:ring-offset-2" />
                <span className="pointer-events-none absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </span>
        </label>
    );
}

/** Live preview for an image path or URL; shows a neutral tile when empty or broken. */
export function ImagePreview({ src, className = 'h-24 w-24' }: { src: string; className?: string }) {
    const value = src.trim();
    return (
        <span className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-400`}>
            {value ? (
                <img
                    key={value}
                    src={value}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                    }}
                />
            ) : (
                'No image'
            )}
        </span>
    );
}

export function Badge({ tone = 'slate', children }: { tone?: 'slate' | 'green' | 'amber' | 'sky' | 'violet' | 'red'; children: ReactNode }) {
    const tones = {
        slate: 'bg-slate-100 text-slate-700 ring-slate-500/20',
        green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
        amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
        sky: 'bg-sky-50 text-sky-700 ring-sky-600/20',
        violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
        red: 'bg-red-50 text-red-700 ring-red-600/20',
    };
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}>
            {children}
        </span>
    );
}
