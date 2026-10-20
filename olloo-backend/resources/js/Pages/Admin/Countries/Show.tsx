import { Link } from '@inertiajs/react';
import { FaArrowLeft } from 'react-icons/fa';
import AdminLayout from '../Layouts/AdminLayout';
import { useRoute } from '@/utils/route';

type Props = {
    country: {
        rid: string;
        code: string;
        alpha3: string | null;
        name: string;
        region: string | null;
        phoneCode: string | null;
        currencyCode: string | null;
        flag: string | null;
        syncedAt: string | null;
        regionsCount: number | null;
        addressesCount: number | null;
        regions: Array<{ rid: string; name: string; citiesCount: number }>;
    };
};

export default function Show({ country }: Props) {
    const route = useRoute();
    const rows: Array<[string, string]> = [
        ['ISO alpha-2', country.code],
        ['ISO alpha-3', country.alpha3 ?? 'None'],
        ['World region', country.region ?? 'None'],
        ['Calling code', country.phoneCode ?? 'None'],
        ['Currency', country.currencyCode ?? 'None'],
        ['Customer addresses', String(country.addressesCount ?? 0)],
        ['Last synced', country.syncedAt ? new Date(country.syncedAt).toLocaleString() : 'Never (added by seeder)'],
    ];

    return (
        <AdminLayout title={`${country.flag ? `${country.flag} ` : ''}${country.name}`}>
            <Link
                href={route('admin.countries.index')}
                className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
            >
                <FaArrowLeft size={11} /> All countries
            </Link>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-start">
                <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
                    <h2 className="mb-3 font-semibold text-slate-900">Details</h2>
                    <dl className="space-y-2">
                        {rows.map(([label, value]) => (
                            <div key={label} className="flex justify-between gap-4">
                                <dt className="text-slate-500">{label}</dt>
                                <dd className="text-right font-medium text-slate-900">{value}</dd>
                            </div>
                        ))}
                    </dl>
                    <p className="mt-4 border-t border-slate-100 pt-3 text-slate-500">
                        Shipping rules match this country by its code, {country.code}.
                    </p>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
                    <h2 className="mb-3 font-semibold text-slate-900">Address regions</h2>
                    {country.regions.length === 0 ? (
                        <p className="text-slate-500">
                            No regions listed. Customers type their region and city freely for this country.
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {country.regions.map((region) => (
                                <li key={region.rid} className="flex justify-between gap-4 py-2">
                                    <span className="text-slate-900">{region.name}</span>
                                    <span className="text-slate-500">
                                        {region.citiesCount} {region.citiesCount === 1 ? 'city' : 'cities'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </AdminLayout>
    );
}
