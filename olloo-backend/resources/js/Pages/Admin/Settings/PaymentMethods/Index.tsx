import { FormEvent, useState } from 'react';
import { router, useForm } from '@inertiajs/react';
import AdminLayout from '../../Layouts/AdminLayout';
import TagMultiSelect from '@/Components/TagMultiSelect';
import ImageUploadField from '@/Components/ImageUploader';
import { Badge, ErrorSummary, Field, FormSection, inputClass, fieldError, focusFirstError, type FormFieldMeta } from '@/Components/Form';
import { useRoute } from '@/utils/route';

type MethodRow = {
    rid: string;
    code: string;
    label: string;
    provider: string;
    icon: string | null;
    iconUrl: string | null;
    currencies: string[];
    countries: string[];
    sortOrder: number;
    isActive: boolean;
    isFallback: boolean;
    paymentsCount: number;
};

type CurrencyRow = {
    rid: string;
    code: string;
    name: string;
    provider: string;
    isDefault: boolean;
};

type Props = {
    methods: MethodRow[];
    providers: string[];
    currencies: CurrencyRow[];
    countryOptions: Array<{ code: string; name: string }>;
};

type MethodFormData = {
    code: string;
    label: string;
    provider: string;
    icon: string;
    currencies: string[];
    countries: string[];
    sort_order: number | string;
    is_active: boolean;
    is_fallback: boolean;
};

const METHOD_FIELDS: FormFieldMeta<'method'>[] = [
    { key: 'code', label: 'Code', section: 'method' },
    { key: 'label', label: 'Label', section: 'method' },
    { key: 'provider', label: 'Provider', section: 'method' },
];

function blankMethod(providers: string[]): MethodFormData {
    return { code: '', label: '', provider: providers[0] ?? '', icon: '', currencies: [], countries: [], sort_order: 0, is_active: true, is_fallback: false };
}

export default function Index({ methods, providers, currencies, countryOptions }: Props) {
    const route = useRoute();
    const [editing, setEditing] = useState<string | null>(null);
    const create = useForm<MethodFormData>(blankMethod(providers));
    const uploadUrl = route('admin.uploads.store');

    const currencyCodes = currencies.map((c) => c.code);
    const countryCodes = countryOptions.map((c) => c.code);

    const submitCreate = (event: FormEvent) => {
        event.preventDefault();
        create.post(route('admin.payment-methods.store'), {
            preserveScroll: true,
            onSuccess: () => create.reset(),
            onError: (errors) => focusFirstError(METHOD_FIELDS, errors),
        });
    };

    return (
        <AdminLayout title="Payment methods">
            <p className="mb-4 max-w-2xl text-sm text-slate-600">
                How shoppers pay at checkout. Each method names its provider and the currencies it serves; checkout routes by method plus
                order currency. Without a chosen method, the order currency's provider applies.
            </p>

            <ErrorSummary fields={METHOD_FIELDS} errors={create.errors} noun="payment method" />

            <FormSection title="Add method">
                <form onSubmit={submitCreate} noValidate className="grid gap-3 sm:grid-cols-2">
                    <Field id="new-code" label="Code" error={create.errors.code} helper="Lowercase letters, numbers and underscores, for example mtn_momo.">
                        <input
                            id="field-new-code"
                            type="text"
                            value={create.data.code}
                            onChange={(e) => create.setData('code', e.target.value)}
                            aria-invalid={Boolean(create.errors.code)}
                            className={inputClass(create.errors.code, 'w-full font-mono')}
                            placeholder="mtn_momo"
                            maxLength={60}
                        />
                    </Field>
                    <Field id="new-label" label="Label" error={create.errors.label} helper="Shown to shoppers at checkout.">
                        <input
                            id="field-new-label"
                            type="text"
                            value={create.data.label}
                            onChange={(e) => create.setData('label', e.target.value)}
                            aria-invalid={Boolean(create.errors.label)}
                            className={inputClass(create.errors.label)}
                            placeholder="MTN MoMo"
                            maxLength={120}
                        />
                    </Field>
                    <Field id="new-provider" label="Provider" error={create.errors.provider}>
                        <select
                            id="field-new-provider"
                            value={create.data.provider}
                            onChange={(e) => create.setData('provider', e.target.value)}
                            aria-invalid={Boolean(create.errors.provider)}
                            className={inputClass(create.errors.provider, 'w-full cursor-pointer')}
                        >
                            {providers.map((provider) => (
                                <option key={provider} value={provider}>
                                    {provider}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field id="new-icon" label="Icon" error={create.errors.icon} helper="Upload a logo, or keep a short artwork key such as card.">
                        <ImageUploadField
                            id="new-icon"
                            value={create.data.icon}
                            onChange={(value) => create.setData('icon', value)}
                            folder="payment-methods"
                            uploadUrl={uploadUrl}
                            error={create.errors.icon}
                            placeholder="card"
                        />
                    </Field>
                    <Field id="new-currencies" label="Currencies (optional)" asLabel={false} error={fieldError(create.errors, 'currencies')} helper="Empty means every currency.">
                        <TagMultiSelect
                            value={create.data.currencies.map((c) => c.toUpperCase())}
                            onChange={(codes) => create.setData('currencies', codes.map((c) => c.toUpperCase()))}
                            suggestions={currencyCodes}
                            invalid={Boolean(fieldError(create.errors, 'currencies'))}
                        />
                    </Field>
                    <Field id="new-countries" label="Countries (optional)" asLabel={false} error={fieldError(create.errors, 'countries')} helper="Empty means every market. Markets, not shipping destinations.">
                        <TagMultiSelect
                            value={create.data.countries.map((c) => c.toUpperCase())}
                            onChange={(codes) => create.setData('countries', codes.map((c) => c.toUpperCase()))}
                            suggestions={countryCodes}
                            invalid={Boolean(fieldError(create.errors, 'countries'))}
                        />
                    </Field>
                    <Field id="new-is_fallback" label="Fallback" error={fieldError(create.errors, 'is_fallback')} helper="Only offered when the shopper's market has no methods of its own.">
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                                id="field-new-is_fallback"
                                type="checkbox"
                                checked={create.data.is_fallback}
                                onChange={(e) => create.setData('is_fallback', e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300"
                            />
                            Offer as a last resort
                        </label>
                    </Field>
                    <div className="sm:col-span-2">
                        <button
                            type="submit"
                            disabled={create.processing}
                            className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {create.processing ? 'Adding…' : 'Add method'}
                        </button>
                    </div>
                </form>
            </FormSection>

            <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">Method</th>
                            <th className="px-4 py-3 font-medium">Provider</th>
                            <th className="px-4 py-3 font-medium">Currencies</th>
                            <th className="px-4 py-3 font-medium">Countries</th>
                            <th className="px-4 py-3 font-medium">Payments</th>
                            <th className="px-4 py-3 font-medium">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {methods.map((row) =>
                            editing === row.rid ? (
                                <EditRow
                                    key={row.rid}
                                    row={row}
                                    providers={providers}
                                    currencyCodes={currencyCodes}
                                    countryCodes={countryCodes}
                                    uploadUrl={uploadUrl}
                                    onDone={() => setEditing(null)}
                                />
                            ) : (
                                <tr key={row.rid} className="border-b border-slate-100 last:border-0">
                                    <td className="px-4 py-3">
                                        <span className="flex items-center gap-2">
                                            {row.iconUrl && <img src={row.iconUrl} alt="" className="h-6 w-6 rounded object-contain" />}
                                            <span>
                                                <span className="font-medium text-slate-900">{row.label}</span>{' '}
                                                <span className="font-mono text-xs text-slate-500">{row.code}</span>{' '}
                                                {row.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="amber">Off</Badge>}{' '}
                                                {row.isFallback && <Badge tone="slate">Fallback</Badge>}
                                            </span>
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs">{row.provider}</td>
                                    <td className="px-4 py-3">{row.currencies.length > 0 ? row.currencies.join(', ') : 'All'}</td>
                                    <td className="px-4 py-3">{row.countries.length > 0 ? row.countries.join(', ') : 'All'}</td>
                                    <td className="px-4 py-3">{row.paymentsCount}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setEditing(row.rid)}
                                                className="cursor-pointer text-slate-700 underline underline-offset-2 hover:text-slate-900"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => router.post(route('admin.payment-methods.toggle', row.rid), {}, { preserveScroll: true })}
                                                className="cursor-pointer text-slate-700 underline underline-offset-2 hover:text-slate-900"
                                            >
                                                {row.isActive ? 'Turn off' : 'Turn on'}
                                            </button>
                                            <button
                                                type="button"
                                                disabled={row.paymentsCount > 0}
                                                title={row.paymentsCount > 0 ? 'Methods with payments cannot be deleted; turn it off instead' : undefined}
                                                onClick={() => {
                                                    if (confirm(`Delete the payment method "${row.label}"?`)) {
                                                        router.delete(route('admin.payment-methods.destroy', row.rid), { preserveScroll: true });
                                                    }
                                                }}
                                                className="cursor-pointer text-red-600 underline underline-offset-2 hover:text-red-800 disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ),
                        )}
                        {methods.length === 0 && (
                            <tr>
                                <td className="px-4 py-3 text-slate-500" colSpan={6}>
                                    No payment methods yet. Add one above.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <h2 className="mt-10 text-base font-semibold text-slate-900">Currencies</h2>
            <p className="mb-4 max-w-2xl text-sm text-slate-600">
                Each currency points at its provider for checkouts without a chosen method, and one currency is the store default for new
                carts and products.
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">Currency</th>
                            <th className="px-4 py-3 font-medium">Provider</th>
                            <th className="px-4 py-3 font-medium">Default</th>
                            <th className="px-4 py-3 font-medium">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {currencies.map((row) => (
                            <CurrencyRow key={row.code} row={row} providers={providers} />
                        ))}
                    </tbody>
                </table>
            </div>
        </AdminLayout>
    );
}

function EditRow({
    row,
    providers,
    currencyCodes,
    countryCodes,
    uploadUrl,
    onDone,
}: {
    row: MethodRow;
    providers: string[];
    currencyCodes: string[];
    countryCodes: string[];
    uploadUrl: string;
    onDone: () => void;
}) {
    const route = useRoute();
    const form = useForm<MethodFormData>({
        code: row.code,
        label: row.label,
        provider: row.provider,
        icon: row.icon ?? '',
        currencies: row.currencies,
        countries: row.countries,
        sort_order: row.sortOrder,
        is_active: row.isActive,
        is_fallback: row.isFallback,
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.put(route('admin.payment-methods.update', row.rid), { preserveScroll: true, onSuccess: onDone });
    };

    return (
        <tr className="border-b border-slate-100">
            <td className="px-4 py-3" colSpan={6}>
                <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-2">
                    <Field id={`edit-${row.rid}-label`} label="Label" error={form.errors.label}>
                        <input
                            id={`field-edit-${row.rid}-label`}
                            type="text"
                            value={form.data.label}
                            onChange={(e) => form.setData('label', e.target.value)}
                            aria-invalid={Boolean(form.errors.label)}
                            className={inputClass(form.errors.label)}
                            maxLength={120}
                        />
                    </Field>
                    <Field id={`edit-${row.rid}-provider`} label="Provider" error={form.errors.provider}>
                        <select
                            id={`field-edit-${row.rid}-provider`}
                            value={form.data.provider}
                            onChange={(e) => form.setData('provider', e.target.value)}
                            aria-invalid={Boolean(form.errors.provider)}
                            className={inputClass(form.errors.provider, 'w-full cursor-pointer')}
                        >
                            {providers.map((provider) => (
                                <option key={provider} value={provider}>
                                    {provider}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field id={`edit-${row.rid}-icon`} label="Icon" error={form.errors.icon}>
                        <ImageUploadField
                            id={`edit-${row.rid}-icon`}
                            value={form.data.icon}
                            onChange={(value) => form.setData('icon', value)}
                            folder="payment-methods"
                            uploadUrl={uploadUrl}
                            error={form.errors.icon}
                            placeholder="card"
                        />
                    </Field>
                    <Field id={`edit-${row.rid}-currencies`} label="Currencies (optional)" asLabel={false} error={fieldError(form.errors, 'currencies')}>
                        <TagMultiSelect
                            value={form.data.currencies}
                            onChange={(codes) => form.setData('currencies', codes.map((c) => c.toUpperCase()))}
                            suggestions={currencyCodes}
                            invalid={Boolean(fieldError(form.errors, 'currencies'))}
                        />
                    </Field>
                    <Field id={`edit-${row.rid}-countries`} label="Countries (optional)" asLabel={false} error={fieldError(form.errors, 'countries')}>
                        <TagMultiSelect
                            value={form.data.countries}
                            onChange={(codes) => form.setData('countries', codes.map((c) => c.toUpperCase()))}
                            suggestions={countryCodes}
                            invalid={Boolean(fieldError(form.errors, 'countries'))}
                        />
                    </Field>
                    <Field
                        id={`edit-${row.rid}-is_fallback`}
                        label="Fallback"
                        error={fieldError(form.errors, 'is_fallback')}
                        helper="Only offered when the shopper's market has no methods of its own."
                    >
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                                id={`field-edit-${row.rid}-is_fallback`}
                                type="checkbox"
                                checked={form.data.is_fallback}
                                onChange={(e) => form.setData('is_fallback', e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300"
                            />
                            Offer as a last resort
                        </label>
                    </Field>
                    <div className="flex items-center gap-2 sm:col-span-2">
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="cursor-pointer rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Save
                        </button>
                        <button type="button" onClick={onDone} className="cursor-pointer rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                            Cancel
                        </button>
                    </div>
                </form>
            </td>
        </tr>
    );
}

function CurrencyRow({ row, providers }: { row: CurrencyRow; providers: string[] }) {
    const route = useRoute();
    const form = useForm({ provider: row.provider, is_default: row.isDefault });

    const save = () => {
        form.put(route('admin.currencies.update', row.rid), { preserveScroll: true });
    };

    return (
        <tr className="border-b border-slate-100 last:border-0">
            <td className="px-4 py-3">
                <span className="font-medium text-slate-900">{row.code}</span> <span className="text-slate-500">{row.name}</span>{' '}
                {row.isDefault && <Badge tone="sky">Default</Badge>}
            </td>
            <td className="px-4 py-3">
                <select
                    aria-label={`Provider for ${row.code}`}
                    value={form.data.provider}
                    onChange={(e) => form.setData('provider', e.target.value)}
                    className="cursor-pointer rounded-md border border-slate-300 px-2 py-1.5 font-mono text-xs focus:border-slate-500 focus:outline-none"
                >
                    {providers.map((provider) => (
                        <option key={provider} value={provider}>
                            {provider}
                        </option>
                    ))}
                </select>
                {form.errors.provider && <p className="mt-1 text-sm text-red-600">{form.errors.provider}</p>}
            </td>
            <td className="px-4 py-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                        type="radio"
                        name="default-currency"
                        checked={form.data.is_default}
                        onChange={() => form.setData('is_default', true)}
                        className="cursor-pointer accent-slate-900"
                    />
                    Default
                </label>
            </td>
            <td className="px-4 py-3 text-right">
                <button
                    type="button"
                    disabled={form.processing || (form.data.provider === row.provider && form.data.is_default === row.isDefault)}
                    onClick={save}
                    className="cursor-pointer rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    Save
                </button>
            </td>
        </tr>
    );
}
