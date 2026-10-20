import { FormEvent, useEffect, useState } from 'react';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import { useRoute } from '@/utils/route';

type CustomerMatch = {
    rid: string;
    name: string;
    email: string;
    isGuest: boolean;
};

type Props = {
    permissions: string[];
    canEditPermissions: boolean;
    canForcePasswordChange: boolean;
    canPromoteCustomers: boolean;
    customers?: CustomerMatch[];
};

type SharedProps = {
    errors: Record<string, string>;
};

export default function Create({
    permissions,
    canEditPermissions,
    canForcePasswordChange,
    canPromoteCustomers,
    customers = [],
}: Props) {
    const route = useRoute();
    const { errors } = usePage<SharedProps>().props;
    const [fromCustomer, setFromCustomer] = useState(false);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<CustomerMatch | null>(null);
    const { data, setData, post, processing } = useForm({
        customer: '',
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        force_password_change: false,
        permissions: [] as string[],
    });

    const togglePermission = (name: string) => {
        setData(
            'permissions',
            data.permissions.includes(name)
                ? data.permissions.filter((p) => p !== name)
                : [...data.permissions, name],
        );
    };

    useEffect(() => {
        if (!fromCustomer || search.trim() === '') {
            return;
        }
        const timer = setTimeout(() => {
            router.reload({ only: ['customers'], data: { customer_search: search.trim() }, preserveUrl: true });
        }, 300);
        return () => clearTimeout(timer);
    }, [fromCustomer, search]);

    const chooseMode = (next: boolean) => {
        setFromCustomer(next);
        setSelected(null);
        setData('customer', '');
    };

    const chooseCustomer = (customer: CustomerMatch | null) => {
        setSelected(customer);
        setData('customer', customer?.rid ?? '');
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('admin.staff.store'));
    };

    return (
        <AdminLayout title="New staff">
            <div className="mb-4">
                <Link href={route('admin.staff.index')} className="cursor-pointer text-sm underline">
                    Back to staff
                </Link>
            </div>
            <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-lg border border-slate-200 bg-white p-5">
                {canPromoteCustomers && (
                    <div className="flex gap-2 text-sm">
                        {[
                            { value: false, label: 'New account' },
                            { value: true, label: 'Existing customer' },
                        ].map((option) => (
                            <button
                                key={option.label}
                                type="button"
                                onClick={() => chooseMode(option.value)}
                                className={`cursor-pointer rounded-md border px-3 py-1.5 ${
                                    fromCustomer === option.value
                                        ? 'border-slate-900 bg-slate-900 text-white'
                                        : 'border-slate-300 text-slate-700'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                )}
                {fromCustomer ? (
                    <div className="text-sm">
                        <span className="mb-1 block text-slate-700">Customer</span>
                        {selected ? (
                            <div className="flex items-center justify-between rounded-md border border-slate-300 px-3 py-2">
                                <div>
                                    <div className="font-medium text-slate-900">{selected.name}</div>
                                    <div className="text-slate-600">{selected.email}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => chooseCustomer(null)}
                                    className="cursor-pointer text-xs text-indigo-700 underline"
                                >
                                    Change
                                </button>
                            </div>
                        ) : (
                            <>
                                <input
                                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                                    placeholder="Search by name or email"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                {search.trim() !== '' && (
                                    <ul className="mt-1 max-h-64 overflow-y-auto rounded-md border border-slate-200">
                                        {customers.length === 0 && (
                                            <li className="px-3 py-2 text-slate-500">No customers match.</li>
                                        )}
                                        {customers.map((customer) => (
                                            <li key={customer.rid}>
                                                <button
                                                    type="button"
                                                    onClick={() => chooseCustomer(customer)}
                                                    className="w-full cursor-pointer px-3 py-2 text-left hover:bg-slate-50"
                                                >
                                                    <span className="font-medium text-slate-900">{customer.name}</span>{' '}
                                                    <span className="text-slate-600">{customer.email}</span>
                                                    {customer.isGuest && (
                                                        <span className="ml-2 text-xs text-slate-500">(guest)</span>
                                                    )}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        )}
                        <span className="mt-1 block text-slate-500">
                            The customer keeps their shop account and orders, and signs in to the admin with the same
                            email and password.
                        </span>
                        {errors.customer && <span className="mt-1 block text-sm text-red-600">{errors.customer}</span>}
                    </div>
                ) : (
                    <>
                        <Field label="Name" error={errors.name}>
                            <input
                                className="w-full rounded-md border border-slate-300 px-3 py-2"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                required
                            />
                        </Field>
                        <Field label="Email" error={errors.email}>
                            <input
                                type="email"
                                className="w-full rounded-md border border-slate-300 px-3 py-2"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                required
                            />
                        </Field>
                    </>
                )}
                <Field label="Password" error={errors.password}>
                    <input
                        type="password"
                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        required={!fromCustomer}
                    />
                    {fromCustomer && (
                        <span className="mt-1 block text-slate-500">
                            Leave blank to keep their shop password. A new password also changes their shop password.
                        </span>
                    )}
                </Field>
                <Field label="Confirm password">
                    <input
                        type="password"
                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                        value={data.password_confirmation}
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                        required={!fromCustomer}
                    />
                </Field>
                {canForcePasswordChange && (
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            className="cursor-pointer"
                            checked={data.force_password_change}
                            onChange={(e) => setData('force_password_change', e.target.checked)}
                        />
                        Force password change on next login
                    </label>
                )}
                {canEditPermissions && (
                    <PermissionChecklist
                        permissions={permissions}
                        selected={data.permissions}
                        onToggle={togglePermission}
                        onChangeAll={(next) => setData('permissions', next)}
                        error={errors.permissions}
                    />
                )}
                <button
                    type="submit"
                    disabled={processing || (fromCustomer && !selected)}
                    className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {fromCustomer ? 'Promote to staff' : 'Create staff'}
                </button>
            </form>
        </AdminLayout>
    );
}

function Field({
    label,
    error,
    children,
}: {
    label: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block text-sm">
            <span className="mb-1 block text-slate-700">{label}</span>
            {children}
            {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
        </label>
    );
}

export function PermissionChecklist({
    permissions,
    selected,
    onToggle,
    onChangeAll,
    error,
}: {
    permissions: string[];
    selected: string[];
    onToggle: (name: string) => void;
    onChangeAll?: (next: string[]) => void;
    error?: string;
}) {
    const allChecked = permissions.length > 0 && permissions.every((name) => selected.includes(name));

    return (
        <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-slate-700">Permissions</div>
                {onChangeAll && (
                    <button
                        type="button"
                        onClick={() => onChangeAll(allChecked ? [] : [...permissions])}
                        className="cursor-pointer text-xs text-indigo-700 underline"
                    >
                        {allChecked ? 'Uncheck all' : 'Check all'}
                    </button>
                )}
            </div>
            <div className="grid max-h-64 gap-2 overflow-y-auto rounded-md border border-slate-200 p-3 sm:grid-cols-2">
                {permissions.map((name) => (
                    <label key={name} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            className="cursor-pointer"
                            checked={selected.includes(name)}
                            onChange={() => onToggle(name)}
                        />
                        <span className="font-mono text-xs">{name}</span>
                    </label>
                ))}
            </div>
            {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
        </div>
    );
}
