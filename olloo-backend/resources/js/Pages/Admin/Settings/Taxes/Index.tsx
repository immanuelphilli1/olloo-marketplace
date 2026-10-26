import { FormEvent, useState } from 'react';
import { router, useForm } from '@inertiajs/react';
import AdminLayout from '../../Layouts/AdminLayout';
import { Badge, Field, Switch, inputClass } from '@/Components/Form';
import { useRoute } from '@/utils/route';

type Rate = {
    rid: string;
    name: string;
    country: string;
    taxClassRid: string | null;
    taxClassName: string | null;
    ratePercent: number;
    isCompound: boolean;
    appliesToShipping: boolean;
    sortOrder: number;
    isActive: boolean;
};

type TaxClassRow = { rid: string; name: string; productsCount: number; ratesCount: number };

type Props = {
    rates: Rate[];
    classes: TaxClassRow[];
    countries: Array<{ code: string; name: string }>;
    untaxedShippingCountries: string[];
};

type RateForm = {
    name: string;
    country: string;
    tax_class_rid: string;
    rate_percent: string | number;
    is_compound: boolean;
    applies_to_shipping: boolean;
    sort_order: string | number;
    is_active: boolean;
};

const emptyRate: RateForm = {
    name: 'VAT',
    country: '',
    tax_class_rid: '',
    rate_percent: '',
    is_compound: false,
    applies_to_shipping: true,
    sort_order: 0,
    is_active: true,
};

export default function Index({ rates, classes, countries, untaxedShippingCountries }: Props) {
    const [editing, setEditing] = useState<string | 'new' | null>(rates.length === 0 ? 'new' : null);
    const countryName = (code: string) => countries.find((country) => country.code === code)?.name ?? code;
    const byCountry = rates.reduce<Record<string, Rate[]>>((groups, rate) => {
        (groups[rate.country] ??= []).push(rate);
        return groups;
    }, {});

    return (
        <AdminLayout title="Taxes">
            <p className="mb-4 max-w-3xl text-sm text-slate-600">
                Product prices are stored excluding tax. At checkout the destination country's rates are added on top. Only
                countries listed here are taxed, so add the countries you are registered in. A country can have several
                parts (for example VAT plus levies); a compound part is charged on the price plus the parts before it.
            </p>

            {untaxedShippingCountries.length > 0 && (
                <div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    You ship to {untaxedShippingCountries.map(countryName).join(', ')} but charge no tax there. Add a rate if you
                    must collect tax for those countries.
                </div>
            )}

            <section className="mb-8 rounded-lg border border-slate-200 bg-white">
                <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                    <h2 className="font-semibold text-slate-900">Tax rates</h2>
                    {editing !== 'new' && (
                        <button
                            type="button"
                            onClick={() => setEditing('new')}
                            className="cursor-pointer rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
                        >
                            Add rate
                        </button>
                    )}
                </header>

                {editing === 'new' && (
                    <div className="border-b border-slate-200 bg-slate-50 p-5">
                        <RateEditor initial={emptyRate} countries={countries} classes={classes} onDone={() => setEditing(null)} />
                    </div>
                )}

                {rates.length === 0 && editing !== 'new' && <p className="px-5 py-6 text-sm text-slate-500">No tax rates yet. No tax is charged anywhere.</p>}

                {Object.entries(byCountry).map(([country, countryRates]) => (
                    <div key={country} className="border-b border-slate-100 last:border-0">
                        <p className="bg-slate-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {countryName(country)} ({country})
                        </p>
                        <ul className="divide-y divide-slate-100">
                            {countryRates.map((rate) =>
                                editing === rate.rid ? (
                                    <li key={rate.rid} className="p-5">
                                        <RateEditor
                                            rid={rate.rid}
                                            initial={{
                                                name: rate.name,
                                                country: rate.country,
                                                tax_class_rid: rate.taxClassRid ?? '',
                                                rate_percent: rate.ratePercent,
                                                is_compound: rate.isCompound,
                                                applies_to_shipping: rate.appliesToShipping,
                                                sort_order: rate.sortOrder,
                                                is_active: rate.isActive,
                                            }}
                                            countries={countries}
                                            classes={classes}
                                            onDone={() => setEditing(null)}
                                        />
                                    </li>
                                ) : (
                                    <li key={rate.rid} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                                        <span className="min-w-40 font-medium text-slate-900">{rate.name}</span>
                                        <span className="w-16 text-slate-900">{rate.ratePercent}%</span>
                                        <span className="text-slate-600">{rate.taxClassName ?? 'Standard products'}</span>
                                        {rate.isCompound && <Badge tone="violet">Compound</Badge>}
                                        {rate.appliesToShipping && <Badge tone="sky">Also on shipping</Badge>}
                                        {!rate.isActive && <Badge tone="amber">Off</Badge>}
                                        <span className="ml-auto flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setEditing(rate.rid)}
                                                className="cursor-pointer text-slate-700 underline underline-offset-2 hover:text-slate-900"
                                            >
                                                Edit
                                            </button>
                                            <DeleteButton
                                                label={`Delete ${rate.name} (${rate.country})? New orders stop paying it; past orders keep their tax.`}
                                                href={`taxes.rates.destroy:${rate.rid}`}
                                            />
                                        </span>
                                    </li>
                                ),
                            )}
                        </ul>
                    </div>
                ))}
            </section>

            <TaxClasses classes={classes} />
        </AdminLayout>
    );
}

function RateEditor({
    rid,
    initial,
    countries,
    classes,
    onDone,
}: {
    rid?: string;
    initial: RateForm;
    countries: Props['countries'];
    classes: TaxClassRow[];
    onDone: () => void;
}) {
    const route = useRoute();
    const { data, setData, post, put, processing, errors } = useForm<RateForm>(initial);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: onDone };
        if (rid) {
            put(route('admin.taxes.rates.update', rid), options);
        } else {
            post(route('admin.taxes.rates.store'), options);
        }
    };

    return (
        <form onSubmit={submit} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)_8rem]">
                <Field id={`rate-${rid ?? 'new'}-name`} label="Name on receipts" error={errors.name}>
                    <input
                        id={`field-rate-${rid ?? 'new'}-name`}
                        type="text"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        aria-invalid={Boolean(errors.name)}
                        className={inputClass(errors.name)}
                        placeholder="VAT"
                        maxLength={80}
                    />
                </Field>
                <Field id={`rate-${rid ?? 'new'}-country`} label="Country" error={errors.country}>
                    <select
                        id={`field-rate-${rid ?? 'new'}-country`}
                        value={data.country}
                        onChange={(e) => setData('country', e.target.value)}
                        aria-invalid={Boolean(errors.country)}
                        className={inputClass(errors.country, 'w-full cursor-pointer')}
                    >
                        <option value="" disabled>
                            Pick a country
                        </option>
                        {countries.map((country) => (
                            <option key={country.code} value={country.code}>
                                {country.name} ({country.code})
                            </option>
                        ))}
                    </select>
                </Field>
                <Field id={`rate-${rid ?? 'new'}-rate_percent`} label="Rate (%)" error={errors.rate_percent}>
                    <input
                        id={`field-rate-${rid ?? 'new'}-rate_percent`}
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={data.rate_percent}
                        onChange={(e) => setData('rate_percent', e.target.value)}
                        aria-invalid={Boolean(errors.rate_percent)}
                        className={inputClass(errors.rate_percent)}
                        placeholder="5"
                    />
                </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
                <Field
                    id={`rate-${rid ?? 'new'}-tax_class_rid`}
                    label="Applies to"
                    helper="Standard products, or only products in a tax class."
                    error={errors.tax_class_rid}
                >
                    <select
                        id={`field-rate-${rid ?? 'new'}-tax_class_rid`}
                        value={data.tax_class_rid}
                        onChange={(e) => setData('tax_class_rid', e.target.value)}
                        className={inputClass(errors.tax_class_rid, 'w-full cursor-pointer sm:w-72')}
                    >
                        <option value="">Standard products</option>
                        {classes.map((taxClass) => (
                            <option key={taxClass.rid} value={taxClass.rid}>
                                {taxClass.name}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field id={`rate-${rid ?? 'new'}-sort_order`} label="Order" helper="Lower first." error={errors.sort_order}>
                    <input
                        id={`field-rate-${rid ?? 'new'}-sort_order`}
                        type="number"
                        min={0}
                        step={1}
                        value={data.sort_order}
                        onChange={(e) => setData('sort_order', e.target.value)}
                        className={inputClass(errors.sort_order)}
                    />
                </Field>
            </div>
            <div className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white px-4">
                <Switch
                    checked={data.applies_to_shipping}
                    onChange={(value) => setData('applies_to_shipping', value)}
                    label="Also charge on shipping"
                    description="Turn off if the delivery fee is not taxed in this country."
                />
                <Switch
                    checked={data.is_compound}
                    onChange={(value) => setData('is_compound', value)}
                    label="Compound"
                    description="Charged on the price plus the non-compound parts listed before it."
                />
                <Switch checked={data.is_active} onChange={(value) => setData('is_active', value)} label="Active" />
            </div>
            <div className="flex gap-3">
                <button
                    type="submit"
                    disabled={processing}
                    className="cursor-pointer rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {processing ? 'Saving…' : rid ? 'Save rate' : 'Add rate'}
                </button>
                <button type="button" onClick={onDone} className="cursor-pointer rounded-md px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
                    Cancel
                </button>
            </div>
        </form>
    );
}

function TaxClasses({ classes }: { classes: TaxClassRow[] }) {
    const route = useRoute();
    const create = useForm({ name: '' });
    const [renaming, setRenaming] = useState<string | null>(null);

    return (
        <section className="rounded-lg border border-slate-200 bg-white">
            <header className="border-b border-slate-200 px-5 py-3">
                <h2 className="font-semibold text-slate-900">Tax classes</h2>
                <p className="mt-1 text-sm text-slate-600">
                    For products taxed differently from the standard rate, for example zero-rated goods. Products without a
                    class are standard.
                </p>
            </header>
            <ul className="divide-y divide-slate-100">
                {classes.map((taxClass) =>
                    renaming === taxClass.rid ? (
                        <li key={taxClass.rid} className="px-5 py-3">
                            <RenameClass taxClass={taxClass} onDone={() => setRenaming(null)} />
                        </li>
                    ) : (
                        <li key={taxClass.rid} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                            <span className="font-medium text-slate-900">{taxClass.name}</span>
                            <span className="text-slate-500">
                                {taxClass.productsCount} products · {taxClass.ratesCount} rates
                            </span>
                            <span className="ml-auto flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setRenaming(taxClass.rid)}
                                    className="cursor-pointer text-slate-700 underline underline-offset-2 hover:text-slate-900"
                                >
                                    Rename
                                </button>
                                {taxClass.productsCount === 0 && taxClass.ratesCount === 0 && (
                                    <DeleteButton label={`Delete the tax class "${taxClass.name}"?`} href={`taxes.classes.destroy:${taxClass.rid}`} />
                                )}
                            </span>
                        </li>
                    ),
                )}
            </ul>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    create.post(route('admin.taxes.classes.store'), { preserveScroll: true, onSuccess: () => create.reset() });
                }}
                className="flex flex-wrap items-start gap-2 border-t border-slate-200 px-5 py-4"
            >
                <div>
                    <label htmlFor="new-tax-class" className="sr-only">
                        New tax class name
                    </label>
                    <input
                        id="new-tax-class"
                        type="text"
                        value={create.data.name}
                        onChange={(e) => create.setData('name', e.target.value)}
                        aria-invalid={Boolean(create.errors.name)}
                        className={inputClass(create.errors.name, 'w-64')}
                        placeholder="Zero-rated"
                        maxLength={80}
                    />
                    {create.errors.name && <p className="mt-1 text-sm text-red-600">{create.errors.name}</p>}
                </div>
                <button
                    type="submit"
                    disabled={create.processing}
                    className="cursor-pointer rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    Add class
                </button>
            </form>
        </section>
    );
}

function RenameClass({ taxClass, onDone }: { taxClass: TaxClassRow; onDone: () => void }) {
    const route = useRoute();
    const { data, setData, put, processing, errors } = useForm({ name: taxClass.name });

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                put(route('admin.taxes.classes.update', taxClass.rid), { preserveScroll: true, onSuccess: onDone });
            }}
            className="flex flex-wrap items-start gap-2"
        >
            <div>
                <label htmlFor={`rename-${taxClass.rid}`} className="sr-only">
                    New name for {taxClass.name}
                </label>
                <input
                    id={`rename-${taxClass.rid}`}
                    type="text"
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && onDone()}
                    aria-invalid={Boolean(errors.name)}
                    className={inputClass(errors.name, 'w-64')}
                    autoFocus
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>
            <button
                type="submit"
                disabled={processing}
                className="cursor-pointer rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
                Save name
            </button>
            <button type="button" onClick={onDone} className="cursor-pointer rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                Cancel
            </button>
        </form>
    );
}

/** `href` is "routeName:rid"; confirms before deleting. */
function DeleteButton({ label, href }: { label: string; href: string }) {
    const route = useRoute();
    const [name, rid] = href.split(':');

    return (
        <button
            type="button"
            onClick={() => {
                if (confirm(label)) router.delete(route(`admin.${name}`, rid), { preserveScroll: true });
            }}
            className="cursor-pointer text-red-600 underline underline-offset-2 hover:text-red-800"
        >
            Delete
        </button>
    );
}
