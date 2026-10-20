import { FormEvent, type ReactNode } from 'react';
import { Link, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '../../Layouts/AdminLayout';
import { useRoute } from '@/utils/route';

export type ShippingRuleFormData = {
    name: string;
    strategy: string;
    fee: string | number;
    currency_code: string;
    country: string;
    threshold: string | number;
    priority: string | number;
    is_active: boolean;
    shipping_class_rid: string;
    transit_days_min: string | number;
    transit_days_max: string | number;
};

export type ShippingClassOption = { rid: string; name: string };

type SharedProps = {
    errors: Record<string, string>;
};

const STRATEGY_COPY: Record<string, { title: string; body: string }> = {
    flat: {
        title: 'Flat rate',
        body: 'Charge the same fee on every matching order.',
    },
    free_over_threshold: {
        title: 'Free over a subtotal',
        body: 'Ship free once the order subtotal reaches an amount.',
    },
};

// Display order of fields; also decides which error gets focus first.
const FIELDS: Array<{ key: string; label: string; section: Section }> = [
    { key: 'strategy', label: 'Rule type', section: 'type' },
    { key: 'currency_code', label: 'Currency', section: 'pricing' },
    { key: 'fee', label: 'Fee', section: 'pricing' },
    { key: 'threshold', label: 'Free from subtotal', section: 'pricing' },
    { key: 'country', label: 'Country', section: 'scope' },
    { key: 'shipping_class_rid', label: 'Shipping class', section: 'scope' },
    { key: 'transit_days_min', label: 'Fastest transit', section: 'transit' },
    { key: 'transit_days_max', label: 'Slowest transit', section: 'transit' },
    { key: 'name', label: 'Name', section: 'details' },
    { key: 'priority', label: 'Priority', section: 'details' },
    { key: 'is_active', label: 'Active', section: 'details' },
];

type Section = 'type' | 'pricing' | 'scope' | 'transit' | 'details';

export function focusFirstError(errors: Record<string, string>) {
    const first = FIELDS.find((field) => errors[field.key]);
    if (first) {
        document.getElementById(`field-${first.key}`)?.focus();
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/** Blank out the money field the chosen strategy does not use, so stale input never fails validation. */
export function forStrategy(data: ShippingRuleFormData): ShippingRuleFormData {
    return data.strategy === 'free_over_threshold' ? { ...data, fee: 0 } : { ...data, threshold: '' };
}

export function ShippingRuleForm({
    data,
    setData,
    errors,
    strategies,
    currencies,
    shippingClasses,
    processing,
    onSubmit,
    submitLabel,
    cancelHref,
}: {
    data: ShippingRuleFormData;
    setData: (key: keyof ShippingRuleFormData, value: ShippingRuleFormData[keyof ShippingRuleFormData]) => void;
    errors: Record<string, string>;
    strategies: string[];
    currencies: string[];
    shippingClasses: ShippingClassOption[];
    processing: boolean;
    onSubmit: (event: FormEvent) => void;
    submitLabel: string;
    cancelHref: string;
}) {
    const isFree = data.strategy === 'free_over_threshold';
    const fieldErrors = FIELDS.filter((field) => errors[field.key]);
    const otherErrors = Object.entries(errors).filter(([key]) => !FIELDS.some((field) => field.key === key));
    const sectionHasError = (section: Section) => fieldErrors.some((field) => field.section === section);
    const hasErrors = fieldErrors.length > 0 || otherErrors.length > 0;

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,42rem)_minmax(0,20rem)] lg:items-start">
            <form onSubmit={onSubmit} noValidate className="space-y-6">
                {hasErrors && (
                    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                        {fieldErrors.length > 0 && (
                            <>
                                <p className="font-medium">
                                    Fix {fieldErrors.length === 1 ? 'this field' : `these ${fieldErrors.length} fields`} to save
                                    the rule:
                                </p>
                                <ul className="mt-2 list-disc space-y-1 pl-5">
                                    {fieldErrors.map((field) => (
                                        <li key={field.key}>
                                            <button
                                                type="button"
                                                onClick={() => document.getElementById(`field-${field.key}`)?.focus()}
                                                className="cursor-pointer text-left underline underline-offset-2 hover:text-red-950"
                                            >
                                                {field.label}: {errors[field.key]}
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
                )}

                <FormSection
                    title="Rule type"
                    description="How the shipping fee is worked out."
                    hasError={sectionHasError('type')}
                >
                    <div role="radiogroup" aria-label="Rule type" className="grid gap-3 sm:grid-cols-2">
                        {strategies.map((strategy, index) => {
                            const copy = STRATEGY_COPY[strategy] ?? { title: strategy, body: '' };
                            const selected = data.strategy === strategy;
                            return (
                                <label
                                    key={strategy}
                                    className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                                        selected
                                            ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <input
                                        id={index === 0 ? 'field-strategy' : undefined}
                                        type="radio"
                                        name="strategy"
                                        value={strategy}
                                        checked={selected}
                                        onChange={() => setData('strategy', strategy)}
                                        className="mt-0.5 cursor-pointer accent-slate-900"
                                    />
                                    <span>
                                        <span className="block text-sm font-medium text-slate-900">{copy.title}</span>
                                        <span className="mt-0.5 block text-sm text-slate-600">{copy.body}</span>
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                    <ErrorText id="strategy" error={errors.strategy} />
                </FormSection>

                <FormSection
                    title="Pricing"
                    description="Rules only match orders paid in their currency."
                    hasError={sectionHasError('pricing')}
                >
                    <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
                        <Field id="currency_code" label="Currency" error={errors.currency_code}>
                            <select
                                id="field-currency_code"
                                value={data.currency_code}
                                onChange={(e) => setData('currency_code', e.target.value)}
                                aria-invalid={Boolean(errors.currency_code)}
                                className={inputClass(errors.currency_code, 'cursor-pointer')}
                            >
                                <option value="" disabled>
                                    Select
                                </option>
                                {currencies.map((code) => (
                                    <option key={code} value={code}>
                                        {code}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        {isFree ? (
                            <Field
                                id="threshold"
                                label="Free from subtotal"
                                helper="Orders below this amount fall through to the next matching rule."
                                error={errors.threshold}
                            >
                                <MoneyInput
                                    id="threshold"
                                    currency={data.currency_code}
                                    value={data.threshold}
                                    onChange={(value) => setData('threshold', value)}
                                    error={errors.threshold}
                                    placeholder="500.00"
                                />
                            </Field>
                        ) : (
                            <Field id="fee" label="Fee" helper="Use 0 to offer free shipping on every order." error={errors.fee}>
                                <MoneyInput
                                    id="fee"
                                    currency={data.currency_code}
                                    value={data.fee}
                                    onChange={(value) => setData('fee', value)}
                                    error={errors.fee}
                                    placeholder="20.00"
                                />
                            </Field>
                        )}
                    </div>
                </FormSection>

                <FormSection
                    title="Where it applies"
                    description="Limit the rule to one destination country or one shipping class, or leave it open."
                    hasError={sectionHasError('scope')}
                >
                    <Field
                        id="shipping_class_rid"
                        label="Shipping class"
                        helper="A rule for a class is used for products in that class before any open rule. Open rules cover every product without a more specific rule."
                        error={errors.shipping_class_rid}
                    >
                        <select
                            id="field-shipping_class_rid"
                            value={data.shipping_class_rid}
                            onChange={(e) => setData('shipping_class_rid', e.target.value)}
                            aria-invalid={Boolean(errors.shipping_class_rid)}
                            className={inputClass(errors.shipping_class_rid, 'w-full cursor-pointer sm:w-72')}
                        >
                            <option value="">Any class (open rule)</option>
                            {shippingClasses.map((shippingClass) => (
                                <option key={shippingClass.rid} value={shippingClass.rid}>
                                    {shippingClass.name}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field
                        id="country"
                        label="Country code (optional)"
                        helper="Two-letter ISO code, for example AE or GB. Leave empty to apply to all countries."
                        error={errors.country}
                    >
                        <input
                            id="field-country"
                            type="text"
                            inputMode="text"
                            autoComplete="off"
                            maxLength={2}
                            value={data.country}
                            onChange={(e) => setData('country', e.target.value.replace(/[^a-z]/gi, '').toUpperCase())}
                            aria-invalid={Boolean(errors.country)}
                            className={inputClass(errors.country, 'w-24 uppercase tracking-widest')}
                            placeholder="AE"
                        />
                    </Field>
                </FormSection>

                <FormSection
                    title="Delivery time"
                    description="Business days the courier takes once the order is dispatched. Shoppers see this plus the product's handling time."
                    hasError={sectionHasError('transit')}
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field id="transit_days_min" label="Fastest (business days)" error={errors.transit_days_min}>
                            <input
                                id="field-transit_days_min"
                                type="number"
                                min={0}
                                max={120}
                                step={1}
                                value={data.transit_days_min}
                                onChange={(e) => setData('transit_days_min', e.target.value)}
                                aria-invalid={Boolean(errors.transit_days_min)}
                                className={inputClass(errors.transit_days_min, 'w-28')}
                                placeholder="2"
                            />
                        </Field>
                        <Field id="transit_days_max" label="Slowest (business days)" error={errors.transit_days_max}>
                            <input
                                id="field-transit_days_max"
                                type="number"
                                min={0}
                                max={120}
                                step={1}
                                value={data.transit_days_max}
                                onChange={(e) => setData('transit_days_max', e.target.value)}
                                aria-invalid={Boolean(errors.transit_days_max)}
                                className={inputClass(errors.transit_days_max, 'w-28')}
                                placeholder="4"
                            />
                        </Field>
                    </div>
                </FormSection>

                <FormSection title="Name and order" hasError={sectionHasError('details')}>
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
                        <Field id="name" label="Name" helper="Only staff see this." error={errors.name}>
                            <input
                                id="field-name"
                                type="text"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                aria-invalid={Boolean(errors.name)}
                                className={inputClass(errors.name)}
                                placeholder="UAE standard"
                            />
                        </Field>
                        <Field id="priority" label="Priority" helper="Lower numbers are checked first." error={errors.priority}>
                            <input
                                id="field-priority"
                                type="number"
                                step="1"
                                min="0"
                                value={data.priority}
                                onChange={(e) => setData('priority', e.target.value)}
                                aria-invalid={Boolean(errors.priority)}
                                className={inputClass(errors.priority)}
                            />
                        </Field>
                    </div>

                    <Switch
                        checked={data.is_active}
                        onChange={(value) => setData('is_active', value)}
                        label="Active"
                        description="Inactive rules are skipped at checkout."
                    />
                </FormSection>

                <div className="flex items-center gap-3">
                    <button
                        type="submit"
                        disabled={processing}
                        className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {processing ? 'Saving…' : submitLabel}
                    </button>
                    <Link href={cancelHref} className="cursor-pointer rounded-md px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                        Cancel
                    </Link>
                </div>
            </form>

            <aside className="rounded-lg border border-slate-200 bg-white p-5 text-sm lg:sticky lg:top-6">
                <h2 className="font-semibold text-slate-900">What this rule does</h2>
                <p className="mt-2 leading-relaxed text-slate-700">{describeRule(data, shippingClasses)}</p>
                {!data.is_active && (
                    <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-amber-800">Inactive, so checkout ignores it.</p>
                )}
                <p className="mt-4 border-t border-slate-100 pt-4 text-slate-500">
                    At checkout, active rules are checked by priority (lowest first). The first rule whose currency,
                    country and subtotal all match sets the fee.
                </p>
            </aside>
        </div>
    );
}

function describeRule(data: ShippingRuleFormData, shippingClasses: ShippingClassOption[]): string {
    return `${describeFee(data, shippingClasses)} ${describeTransit(data)}`;
}

function describeTransit(data: ShippingRuleFormData): string {
    const min = data.transit_days_min === '' ? null : Number(data.transit_days_min);
    const max = data.transit_days_max === '' ? null : Number(data.transit_days_max);
    if (min === null || max === null || Number.isNaN(min) || Number.isNaN(max)) {
        return '';
    }
    const days = min === max ? `${min} business ${min === 1 ? 'day' : 'days'}` : `${min}-${max} business days`;
    return `The courier takes ${days} after dispatch.`;
}

function describeFee(data: ShippingRuleFormData, shippingClasses: ShippingClassOption[]): string {
    const currency = data.currency_code || 'the selected currency';
    const className = shippingClasses.find((option) => option.rid === data.shipping_class_rid)?.name;
    const audience = `${className ? `${className} items in orders` : 'Orders'} paid in ${currency}${data.country.length === 2 ? ` shipping to ${data.country}` : ''}`;

    if (data.strategy === 'free_over_threshold') {
        const threshold = formatAmount(data.threshold);
        return threshold
            ? `${audience} ship free once the subtotal reaches ${currency} ${threshold}. Smaller orders use the next matching rule.`
            : `${audience} ship free once the subtotal reaches the amount you set.`;
    }

    const fee = formatAmount(data.fee);
    if (fee === null) {
        return `${audience} pay a flat shipping fee.`;
    }

    return Number(fee) === 0 ? `${audience} always ship free.` : `${audience} pay ${currency} ${fee} shipping.`;
}

function formatAmount(value: string | number): string | null {
    if (value === '' || Number.isNaN(Number(value))) {
        return null;
    }
    return Number(value).toFixed(2);
}

function inputClass(error: string | undefined, extra = 'w-full') {
    return `${extra} rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
        error ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:border-slate-500 focus:ring-slate-200'
    }`;
}

function FormSection({
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
        <section
            className={`space-y-4 rounded-lg border bg-white p-5 ${hasError ? 'border-red-300' : 'border-slate-200'}`}
        >
            <header>
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                    {title}
                    {hasError && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Needs attention</span>
                    )}
                </h2>
                {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
            </header>
            {children}
        </section>
    );
}

function Field({
    id,
    label,
    helper,
    error,
    children,
}: {
    id: string;
    label: string;
    helper?: string;
    error?: string;
    children: ReactNode;
}) {
    return (
        <div className="text-sm">
            <label htmlFor={`field-${id}`} className="mb-1 block font-medium text-slate-700">
                {label}
            </label>
            {children}
            {helper && !error && <p className="mt-1 text-slate-500">{helper}</p>}
            <ErrorText id={id} error={error} />
        </div>
    );
}

function ErrorText({ id, error }: { id: string; error?: string }) {
    if (!error) {
        return null;
    }
    return (
        <p id={`error-${id}`} className="mt-1 text-sm text-red-600">
            {error}
        </p>
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
    placeholder: string;
}) {
    return (
        <div
            className={`flex rounded-md border focus-within:ring-2 ${
                error ? 'border-red-400 focus-within:ring-red-200' : 'border-slate-300 focus-within:ring-slate-200'
            }`}
        >
            <span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                {currency || '---'}
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
                aria-describedby={error ? `error-${id}` : undefined}
                className="w-full rounded-r-md px-3 py-2 text-sm tabular-nums focus:outline-none"
                placeholder={placeholder}
            />
        </div>
    );
}

function Switch({
    checked,
    onChange,
    label,
    description,
}: {
    checked: boolean;
    onChange: (value: boolean) => void;
    label: string;
    description: string;
}) {
    return (
        <div className="flex items-start gap-3">
            <button
                id="field-is_active"
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                onClick={() => onChange(!checked)}
                className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                    checked ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
            >
                <span
                    className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${
                        checked ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                />
            </button>
            <div className="text-sm">
                <div className="font-medium text-slate-700">{label}</div>
                <div className="text-slate-500">{description}</div>
            </div>
        </div>
    );
}

export default function Create({
    strategies,
    currencies,
    shippingClasses,
}: {
    strategies: string[];
    currencies: string[];
    shippingClasses: ShippingClassOption[];
}) {
    const route = useRoute();
    const { errors } = usePage<SharedProps>().props;
    const { data, setData, post, processing, transform } = useForm<ShippingRuleFormData>({
        name: '',
        strategy: strategies[0] ?? '',
        fee: '',
        currency_code: currencies[0] ?? '',
        country: '',
        threshold: '',
        priority: 100,
        is_active: true,
        shipping_class_rid: '',
        transit_days_min: '',
        transit_days_max: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        transform(forStrategy);
        post(route('admin.shipping-rules.store'), { preserveScroll: true, onError: focusFirstError });
    };

    return (
        <AdminLayout title="New shipping rule">
            <ShippingRuleForm
                data={data}
                setData={setData}
                errors={errors}
                strategies={strategies}
                currencies={currencies}
                shippingClasses={shippingClasses}
                processing={processing}
                onSubmit={submit}
                submitLabel="Create rule"
                cancelHref={route('admin.shipping-rules.index')}
            />
        </AdminLayout>
    );
}
