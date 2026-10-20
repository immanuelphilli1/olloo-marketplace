import { FormEvent } from 'react';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '../../Layouts/AdminLayout';
import { focusFirstError, forStrategy, ShippingRuleForm, type ShippingClassOption, type ShippingRuleFormData } from './Create';
import { useRoute } from '@/utils/route';

type RuleRecord = {
    rid: string;
    name: string;
    strategy: string;
    feeMajor: number;
    currency: string;
    country: string | null;
    thresholdMajor: number | null;
    priority: number;
    isActive: boolean;
    shippingClassRid: string | null;
    transitDaysMin: number;
    transitDaysMax: number;
};

type SharedProps = {
    errors: Record<string, string>;
};

export default function Edit({
    rule,
    strategies,
    currencies,
    shippingClasses,
}: {
    rule: RuleRecord;
    strategies: string[];
    currencies: string[];
    shippingClasses: ShippingClassOption[];
}) {
    const route = useRoute();
    const { errors } = usePage<SharedProps>().props;
    const { data, setData, put, processing, transform } = useForm<ShippingRuleFormData>({
        name: rule.name,
        strategy: rule.strategy,
        fee: rule.feeMajor,
        currency_code: rule.currency,
        country: rule.country ?? '',
        threshold: rule.thresholdMajor ?? '',
        priority: rule.priority,
        is_active: rule.isActive,
        shipping_class_rid: rule.shippingClassRid ?? '',
        transit_days_min: rule.transitDaysMin,
        transit_days_max: rule.transitDaysMax,
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        transform(forStrategy);
        put(route('admin.shipping-rules.update', rule.rid), { preserveScroll: true, onError: focusFirstError });
    };

    const destroy = () => {
        if (confirm(`Delete the shipping rule "${rule.name}"? This cannot be undone.`)) {
            router.delete(route('admin.shipping-rules.destroy', rule.rid), { onError: focusFirstError });
        }
    };

    return (
        <AdminLayout title={`Edit rule: ${rule.name}`}>
            <div className="mb-6 flex items-center justify-between gap-3">
                <Link href={route('admin.shipping-rules.index')} className="cursor-pointer text-sm text-slate-600 hover:text-slate-900">
                    &larr; All shipping rules
                </Link>
                <button
                    type="button"
                    onClick={destroy}
                    className="cursor-pointer rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                >
                    Delete rule
                </button>
            </div>
            <ShippingRuleForm
                data={data}
                setData={setData}
                errors={errors}
                strategies={strategies}
                currencies={currencies}
                shippingClasses={shippingClasses}
                processing={processing}
                onSubmit={submit}
                submitLabel="Save rule"
                cancelHref={route('admin.shipping-rules.index')}
            />
        </AdminLayout>
    );
}
