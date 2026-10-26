import { FormEvent, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '../../Layouts/AdminLayout';
import Pagination from '@/Components/Pagination';
import { useRoute } from '@/utils/route';

type RuleRow = {
    rid: string;
    name: string;
    strategy: string;
    fee: string;
    currency: string;
    country: string | null;
    threshold: string | null;
    priority: number;
    isActive: boolean;
    shippingClassName: string | null;
    transitDaysMin: number;
    transitDaysMax: number;
};

type Paginated<T> = {
    data: T[];
    links: Array<{ url: string | null; label: string; active: boolean }>;
};

type SharedProps = {
    auth: {
        staff: {
            permissions: string[];
        } | null;
    };
    errors: Record<string, string>;
};

type TestResult = {
    matchedRule: { rid: string; name: string } | null;
    checks: Array<{ label: string; passed: boolean }>;
    fee: string | null;
    currency: string;
};

export default function Index({ rules, currencies }: { rules: Paginated<RuleRow>; currencies: string[] }) {
    const route = useRoute();
    const { auth, errors } = usePage<SharedProps>().props;
    const permissions = auth.staff?.permissions ?? [];
    const canManage = permissions.includes('manage_shipping_settings');

    const [country, setCountry] = useState('');
    const [currency, setCurrency] = useState(currencies[0] ?? '');
    const [subtotal, setSubtotal] = useState('');
    const [testing, setTesting] = useState(false);
    const [result, setResult] = useState<TestResult | null>(null);
    const [testError, setTestError] = useState<string | null>(null);

    const runTest = async (event: FormEvent) => {
        event.preventDefault();
        setTesting(true);
        setResult(null);
        setTestError(null);
        try {
            const url = route('admin.shipping-rules.test-quote', {
                _query: { country: country || undefined, currency, subtotal },
            });
            const response = await fetch(url, { headers: { Accept: 'application/json' } });
            const body = await response.json().catch(() => null);
            if (response.ok) {
                setResult(body as TestResult);
            } else {
                setTestError(body?.error?.message ?? body?.message ?? 'The test could not run. Check the values and try again.');
            }
        } catch {
            setTestError('The test could not reach the server. Try again.');
        } finally {
            setTesting(false);
        }
    };

    const destroy = (rule: RuleRow) => {
        if (confirm(`Delete the shipping rule "${rule.name}"? This cannot be undone.`)) {
            router.delete(route('admin.shipping-rules.destroy', rule.rid), { preserveScroll: true });
        }
    };

    const matchedRid = result?.matchedRule?.rid ?? null;

    return (
        <AdminLayout title="Shipping rules">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <p className="max-w-2xl text-sm text-slate-600">
                    At checkout, active rules are checked by priority (lowest number first). The first rule whose currency,
                    country and subtotal all match sets the shipping fee.
                </p>
                {canManage && (
                    <Link
                        href={route('admin.shipping-rules.create')}
                        className="cursor-pointer rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
                    >
                        New rule
                    </Link>
                )}
            </div>

            {errors.rule && (
                <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errors.rule}
                </div>
            )}

            {rules.data.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                    <h2 className="text-base font-semibold text-slate-900">No shipping rules yet</h2>
                    <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
                        Checkout cannot quote shipping until at least one active rule exists for each currency you sell in.
                    </p>
                    {canManage && (
                        <Link
                            href={route('admin.shipping-rules.create')}
                            className="mt-4 inline-block cursor-pointer rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
                        >
                            Create the first rule
                        </Link>
                    )}
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                            <tr>
                                <th className="px-4 py-3 font-medium">Priority</th>
                                <th className="px-4 py-3 font-medium">Rule</th>
                                <th className="px-4 py-3 font-medium">Charge</th>
                                <th className="px-4 py-3 font-medium">Applies to</th>
                                <th className="px-4 py-3 font-medium">Transit</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                {canManage && (
                                    <th className="px-4 py-3 text-right font-medium">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rules.data.map((rule) => (
                                <tr
                                    key={rule.rid}
                                    className={
                                        rule.rid === matchedRid
                                            ? 'bg-emerald-50'
                                            : rule.isActive
                                              ? undefined
                                              : 'bg-slate-50/60 text-slate-500'
                                    }
                                >
                                    <td className="px-4 py-3 tabular-nums">{rule.priority}</td>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-slate-900">{rule.name}</div>
                                        {rule.rid === matchedRid && (
                                            <div className="mt-0.5 text-xs font-medium text-emerald-700">Matched by your test</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 tabular-nums">
                                        {rule.strategy === 'free_over_threshold' ? (
                                            <>
                                                Free from <span className="whitespace-nowrap">{rule.threshold}</span>
                                            </>
                                        ) : (
                                            <span className="whitespace-nowrap">{rule.fee}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {rule.country ?? 'All countries'}
                                        <span className="block text-xs text-slate-500">{rule.shippingClassName ?? 'Any class'}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        {rule.transitDaysMin === rule.transitDaysMax
                                            ? rule.transitDaysMin
                                            : `${rule.transitDaysMin}-${rule.transitDaysMax}`}{' '}
                                        business days
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                                rule.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                                            }`}
                                        >
                                            {rule.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    {canManage && (
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-1 whitespace-nowrap">
                                                <Link
                                                    href={route('admin.shipping-rules.edit', rule.rid)}
                                                    className="cursor-pointer rounded px-2 py-1 text-slate-700 hover:bg-slate-100"
                                                >
                                                    Edit
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        router.post(route('admin.shipping-rules.toggle', rule.rid), {}, { preserveScroll: true })
                                                    }
                                                    className="cursor-pointer rounded px-2 py-1 text-slate-700 hover:bg-slate-100"
                                                >
                                                    {rule.isActive ? 'Deactivate' : 'Activate'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => destroy(rule)}
                                                    className="cursor-pointer rounded px-2 py-1 text-red-700 hover:bg-red-50"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <Pagination links={rules.links} />

            <section className="mt-8 rounded-lg border border-slate-200 bg-white">
                <header className="border-b border-slate-200 px-5 py-4">
                    <h2 className="text-base font-semibold text-slate-900">Test a quote</h2>
                    <p className="mt-1 text-sm text-slate-600">
                        Enter an order to see which rule checkout would use and what it would charge.
                    </p>
                </header>
                <form onSubmit={runTest} className="grid gap-4 p-5 sm:grid-cols-[8rem_8rem_minmax(0,14rem)_auto] sm:items-end">
                    <label className="block text-sm">
                        <span className="mb-1 block font-medium text-slate-700">Currency</span>
                        <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="w-full cursor-pointer rounded-md border border-slate-300 px-3 py-2"
                        >
                            {currencies.map((code) => (
                                <option key={code} value={code}>
                                    {code}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block text-sm">
                        <span className="mb-1 block font-medium text-slate-700">Country</span>
                        <input
                            type="text"
                            maxLength={2}
                            autoComplete="off"
                            value={country}
                            onChange={(e) => setCountry(e.target.value.replace(/[^a-z]/gi, '').toUpperCase())}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 uppercase tracking-widest"
                            placeholder="AE"
                        />
                    </label>
                    <label className="block text-sm">
                        <span className="mb-1 block font-medium text-slate-700">Subtotal</span>
                        <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={subtotal}
                            onChange={(e) => setSubtotal(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 tabular-nums"
                            placeholder="600.00"
                            required
                        />
                    </label>
                    <button
                        type="submit"
                        disabled={testing}
                        className="cursor-pointer rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {testing ? 'Testing…' : 'Run test'}
                    </button>
                </form>

                {(result || testError) && (
                    <div aria-live="polite" className="border-t border-slate-200 px-5 py-4 text-sm">
                        {testError && <p className="text-red-700">{testError}</p>}
                        {result && (
                            <div
                                className={`rounded-md border px-4 py-3 ${
                                    result.matchedRule ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
                                }`}
                            >
                                <p className="font-medium text-slate-900">
                                    {result.matchedRule
                                        ? `Checkout would charge ${result.currency} ${result.fee} using "${result.matchedRule.name}".`
                                        : 'No rule matches, so checkout would fail with a shipping configuration error for this order.'}
                                </p>
                                <ul className="mt-2 space-y-1">
                                    {result.checks.map((check) => (
                                        <li
                                            key={check.label}
                                            className={`flex items-center gap-2 ${check.passed ? 'text-emerald-800' : 'text-red-700'}`}
                                        >
                                            <span aria-hidden="true">{check.passed ? '✓' : '✗'}</span>
                                            <span className="sr-only">{check.passed ? 'Passed:' : 'Failed:'}</span>
                                            {check.label}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </AdminLayout>
    );
}
