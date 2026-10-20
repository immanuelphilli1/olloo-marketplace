import { FormEvent, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import { FaSearch, FaSync } from 'react-icons/fa';
import AdminLayout from '../Layouts/AdminLayout';
import Pagination from '@/Components/Pagination';
import { useRoute } from '@/utils/route';

type CountryRow = {
    rid: string;
    code: string;
    alpha3: string | null;
    name: string;
    region: string | null;
    phoneCode: string | null;
    currencyCode: string | null;
    flag: string | null;
    regionsCount: number | null;
    addressesCount: number | null;
};

type Props = {
    countries: {
        data: CountryRow[];
        total: number;
        links: Array<{ url: string | null; label: string; active: boolean }>;
    };
    filters: { search: string; search_by: string };
    lastSyncedAt: string | null;
    syncConfigured: boolean;
    canSync: boolean;
};

const SEARCH_FIELDS = [
    { value: 'name', label: 'Name' },
    { value: 'code', label: 'Code' },
    { value: 'region', label: 'Region' },
];

export default function Index({ countries, filters, lastSyncedAt, syncConfigured, canSync }: Props) {
    const route = useRoute();
    const [search, setSearch] = useState(filters.search);
    const [searchBy, setSearchBy] = useState(filters.search_by);
    const [syncing, setSyncing] = useState(false);

    const applySearch = (event: FormEvent) => {
        event.preventDefault();
        router.get(
            route('admin.countries.index'),
            search.trim() === '' ? {} : { search: search.trim(), search_by: searchBy },
            { preserveState: true, replace: true },
        );
    };

    const sync = () => {
        if (!confirm('Queue a sync from RestCountries? It creates and updates country rows in the background and never deletes any.')) {
            return;
        }
        router.post(route('admin.countries.sync'), {}, { onStart: () => setSyncing(true), onFinish: () => setSyncing(false) });
    };

    return (
        <AdminLayout title="Countries">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <p className="max-w-2xl text-sm text-slate-600">
                    Read-only list used by customer addresses and shipping rules. Sync from RestCountries to add or refresh
                    countries.{' '}
                    {lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}.` : 'Not synced yet.'}
                </p>
                {canSync && (
                    <div className="text-right">
                        <button
                            type="button"
                            onClick={sync}
                            disabled={syncing || !syncConfigured}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <FaSync className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                            {syncing ? 'Queuing…' : 'Sync countries'}
                        </button>
                        {!syncConfigured && (
                            <p className="mt-1 text-xs text-amber-700">Set RESTCOUNTRIES_API_KEY on the server to enable sync.</p>
                        )}
                    </div>
                )}
            </div>

            <form onSubmit={applySearch} className="mb-4 flex flex-wrap items-center gap-2">
                <select
                    aria-label="Search by"
                    value={searchBy}
                    onChange={(e) => setSearchBy(e.target.value)}
                    className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                    {SEARCH_FIELDS.map((field) => (
                        <option key={field.value} value={field.value}>
                            {field.label}
                        </option>
                    ))}
                </select>
                <label className="relative min-w-56 flex-1 text-sm sm:max-w-sm">
                    <span className="sr-only">Search countries</span>
                    <FaSearch className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search countries"
                        className="w-full rounded-md border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                </label>
                <button type="submit" className="cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">
                    Search
                </button>
                <span className="text-sm text-slate-600">
                    {countries.total} {countries.total === 1 ? 'country' : 'countries'}
                </span>
            </form>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                            <th className="px-4 py-3 font-medium">Country</th>
                            <th className="px-4 py-3 font-medium">Code</th>
                            <th className="px-4 py-3 font-medium">Region</th>
                            <th className="px-4 py-3 font-medium">Calling code</th>
                            <th className="px-4 py-3 font-medium">Currency</th>
                            <th className="px-4 py-3 font-medium">Addresses</th>
                        </tr>
                    </thead>
                    <tbody>
                        {countries.data.map((country) => (
                            <tr key={country.rid} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                <td className="px-4 py-3">
                                    <Link
                                        href={route('admin.countries.show', country.rid)}
                                        className="cursor-pointer font-medium text-slate-900 hover:underline"
                                    >
                                        <span className="mr-2" aria-hidden>
                                            {country.flag ?? ''}
                                        </span>
                                        {country.name}
                                    </Link>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs">
                                    {country.code}
                                    {country.alpha3 && <span className="text-slate-400"> / {country.alpha3}</span>}
                                </td>
                                <td className="px-4 py-3 text-slate-600">{country.region ?? 'None'}</td>
                                <td className="px-4 py-3 text-slate-600">{country.phoneCode ?? 'None'}</td>
                                <td className="px-4 py-3 text-slate-600">{country.currencyCode ?? 'None'}</td>
                                <td className="px-4 py-3 text-slate-600">{country.addressesCount ?? 0}</td>
                            </tr>
                        ))}
                        {countries.data.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                                    {filters.search
                                        ? `No countries match "${filters.search}".`
                                        : 'No countries yet. Run a sync to load the full list.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination links={countries.links} />
        </AdminLayout>
    );
}
