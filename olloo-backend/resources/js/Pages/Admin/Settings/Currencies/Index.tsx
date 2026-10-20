import { FormEvent, useState } from 'react';
import { router, useForm } from '@inertiajs/react';
import { FaSync } from 'react-icons/fa';
import AdminLayout from '../../Layouts/AdminLayout';
import { Badge, Field, inputClass } from '@/Components/Form';
import { useRoute } from '@/utils/route';

type CurrencyRow = {
    code: string;
    name: string;
    countryCode: string | null;
    countryName: string | null;
    paymentProvider: string;
    decimalPlaces: number;
    isDefault: boolean;
};

type Pair = {
    rid: string;
    from: string;
    to: string;
    midRate: number;
    markupOverride: number | null;
    effectiveRate: number;
    fetchedAt: string;
    isStale: boolean;
    source: string;
};

type Props = {
    currencies: CurrencyRow[];
    pairs: Pair[];
    defaultMarkupPercent: number;
    defaultMarkupSaved: boolean;
    maxRateAgeHours: number;
    usesApiKey: boolean;
};

const formatRate = (rate: number) => rate.toLocaleString(undefined, { maximumSignificantDigits: 8 });
const formatDate = (iso: string) => new Date(iso).toLocaleString();

export default function Index({ currencies, pairs, defaultMarkupPercent, defaultMarkupSaved, maxRateAgeHours, usesApiKey }: Props) {
    const route = useRoute();
    const [refreshing, setRefreshing] = useState(false);
    const [editing, setEditing] = useState<string | null>(null);
    const base = currencies.find((currency) => currency.isDefault);

    // A currency with no fresh rate from the base is never shown to shoppers.
    const unpriced = currencies.filter(
        (currency) => !currency.isDefault && !pairs.some((pair) => pair.from === base?.code && pair.to === currency.code && !pair.isStale),
    );
    const lastFetched = pairs.reduce<string | null>((latest, pair) => (latest === null || pair.fetchedAt > latest ? pair.fetchedAt : latest), null);

    const refresh = () => {
        router.post(route('admin.currencies.refresh'), {}, {
            preserveScroll: true,
            onStart: () => setRefreshing(true),
            onFinish: () => setRefreshing(false),
        });
    };

    return (
        <AdminLayout title="Currencies">
            <p className="mb-4 max-w-3xl text-sm text-slate-600">
                Shoppers see prices and pay in their country's currency when it is listed below and has a rate from{' '}
                {base?.code ?? 'the default currency'} younger than {maxRateAgeHours} hours. Everyone else sees {base?.code ?? 'the default currency'}.
                The rate they pay is the market rate plus a markup, which covers the rate moving before the money settles.
            </p>

            {unpriced.length > 0 && (
                <div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    No usable rate for {unpriced.map((currency) => currency.code).join(', ')}, so those shoppers see {base?.code}. Refresh the rates, and
                    check the provider supports the currency if this stays.
                </div>
            )}

            <DefaultMarkup percent={defaultMarkupPercent} saved={defaultMarkupSaved} />

            <section className="mb-8 rounded-lg border border-slate-200 bg-white">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
                    <div>
                        <h2 className="font-semibold text-slate-900">Exchange rates</h2>
                        <p className="mt-1 text-sm text-slate-600">
                            Updated twice a day from exchangerate-api.com{usesApiKey ? '' : ' (free endpoint, no API key)'}.
                            {lastFetched && ` Last update ${formatDate(lastFetched)}.`}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={refresh}
                        disabled={refreshing}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <FaSync className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Updating…' : 'Update rates now'}
                    </button>
                </header>

                {pairs.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-slate-500">No rates yet. Update the rates to start pricing in local currencies.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-5 py-2">Pair</th>
                                    <th className="px-5 py-2 text-right">Market rate</th>
                                    <th className="px-5 py-2">Markup</th>
                                    <th className="px-5 py-2 text-right">Shopper rate</th>
                                    <th className="px-5 py-2">Updated</th>
                                    <th className="px-5 py-2" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pairs.map((pair) => (
                                    <tr key={pair.rid} className="align-top">
                                        <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-900">
                                            1 {pair.from} → {pair.to}
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-slate-700">{formatRate(pair.midRate)}</td>
                                        <td className="px-5 py-3">
                                            {editing === pair.rid ? (
                                                <PairMarkupEditor pair={pair} onDone={() => setEditing(null)} />
                                            ) : pair.markupOverride !== null ? (
                                                <span className="text-slate-900">
                                                    {pair.markupOverride}% <Badge tone="violet">Override</Badge>
                                                </span>
                                            ) : (
                                                <span className="text-slate-500">Default ({defaultMarkupPercent}%)</span>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums font-medium text-slate-900">
                                            {formatRate(pair.effectiveRate)}
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                                            {formatDate(pair.fetchedAt)} {pair.isStale && <Badge tone="red">Too old, not used</Badge>}
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3 text-right">
                                            {editing !== pair.rid && (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditing(pair.rid)}
                                                    className="cursor-pointer text-slate-700 underline underline-offset-2 hover:text-slate-900"
                                                >
                                                    Set markup
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white">
                <header className="border-b border-slate-200 px-5 py-3">
                    <h2 className="font-semibold text-slate-900">Currencies</h2>
                    <p className="mt-1 text-sm text-slate-600">
                        Each currency is charged through its own payment provider. A country whose currency is not listed sees {base?.code}.
                    </p>
                </header>
                <ul className="divide-y divide-slate-100">
                    {currencies.map((currency) => (
                        <li key={currency.code} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                            <span className="w-12 font-medium text-slate-900">{currency.code}</span>
                            <span className="min-w-40 text-slate-700">{currency.name}</span>
                            {/* Where a shopper we cannot place ends up. Without a
                                country here the store has no fallback market. */}
                            <span className="text-slate-500">
                                {currency.countryCode
                                    ? `${currency.countryName ?? currency.countryCode} (${currency.countryCode})`
                                    : 'No country set'}
                            </span>
                            <span className="text-slate-500">Paid with {currency.paymentProvider}</span>
                            {currency.isDefault && <Badge tone="green">Default</Badge>}
                        </li>
                    ))}
                </ul>
            </section>
        </AdminLayout>
    );
}

function DefaultMarkup({ percent, saved }: { percent: number; saved: boolean }) {
    const route = useRoute();
    const { data, setData, setDefaults, put, processing, errors, isDirty } = useForm({ default_markup_percent: percent as string | number });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        put(route('admin.currencies.markup.update'), { preserveScroll: true, onSuccess: () => setDefaults() });
    };

    return (
        <section className="mb-8 rounded-lg border border-slate-200 bg-white">
            <header className="border-b border-slate-200 px-5 py-3">
                <h2 className="font-semibold text-slate-900">Default markup</h2>
                <p className="mt-1 text-sm text-slate-600">
                    Added to every market rate unless a pair below has its own markup.
                    {!saved && ' Not saved yet, so the server default applies.'}
                </p>
            </header>
            <form onSubmit={submit} noValidate className="flex flex-wrap items-end gap-3 px-5 py-4">
                <Field id="default_markup_percent" label="Markup (%)" error={errors.default_markup_percent}>
                    <input
                        id="field-default_markup_percent"
                        type="number"
                        min={0}
                        max={50}
                        step={0.01}
                        value={data.default_markup_percent}
                        onChange={(e) => setData('default_markup_percent', e.target.value)}
                        aria-invalid={Boolean(errors.default_markup_percent)}
                        className={inputClass(errors.default_markup_percent, 'w-32')}
                        placeholder="2"
                    />
                </Field>
                <button
                    type="submit"
                    disabled={processing || !isDirty}
                    className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {processing ? 'Saving…' : 'Save markup'}
                </button>
            </form>
        </section>
    );
}

function PairMarkupEditor({ pair, onDone }: { pair: Pair; onDone: () => void }) {
    const route = useRoute();
    const { data, setData, put, processing, errors, transform } = useForm({ markup_percent: (pair.markupOverride ?? '') as string | number });

    const save = (event: FormEvent) => {
        event.preventDefault();
        put(route('admin.currencies.pairs.update', pair.rid), { preserveScroll: true, onSuccess: onDone });
    };

    const useDefault = () => {
        transform(() => ({ markup_percent: null }));
        put(route('admin.currencies.pairs.update', pair.rid), { preserveScroll: true, onSuccess: onDone });
    };

    return (
        <form onSubmit={save} noValidate className="flex flex-wrap items-start gap-2">
            <div>
                <label htmlFor={`markup-${pair.rid}`} className="sr-only">
                    Markup for {pair.from} to {pair.to} (%)
                </label>
                <input
                    id={`markup-${pair.rid}`}
                    type="number"
                    min={0}
                    max={50}
                    step={0.01}
                    value={data.markup_percent}
                    onChange={(e) => setData('markup_percent', e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && onDone()}
                    aria-invalid={Boolean(errors.markup_percent)}
                    className={inputClass(errors.markup_percent, 'w-24')}
                    placeholder="3"
                    autoFocus
                />
                {errors.markup_percent && <p className="mt-1 text-sm text-red-600">{errors.markup_percent}</p>}
            </div>
            <button
                type="submit"
                disabled={processing || data.markup_percent === ''}
                className="cursor-pointer rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
                Save
            </button>
            {pair.markupOverride !== null && (
                <button
                    type="button"
                    onClick={useDefault}
                    disabled={processing}
                    className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    Use default
                </button>
            )}
            <button type="button" onClick={onDone} className="cursor-pointer rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                Cancel
            </button>
        </form>
    );
}
