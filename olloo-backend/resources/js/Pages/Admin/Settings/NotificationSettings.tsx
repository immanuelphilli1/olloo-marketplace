import { FormEvent, useMemo } from 'react';
import { useForm } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import TagsInput from '@/Components/TagsInput';
import { useRoute } from '@/utils/route';

type ChannelBlock = { emails: string };

type Props = {
    settings: {
        payment: ChannelBlock;
        inquiry: ChannelBlock;
    };
};

function splitRecipients(raw: string): string[] {
    return raw
        .split(/[\s,;]+/g)
        .map((item) => item.trim())
        .filter(Boolean);
}

function isValidEmail(value: string): string | null {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Invalid email';
}

function Section({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">{title}</h2>
                <p className="mt-1 text-sm text-slate-600">{description}</p>
            </div>
            <div className="space-y-4 p-5">{children}</div>
        </div>
    );
}

export default function NotificationSettings({ settings }: Props) {
    const route = useRoute();
    const { data, setData, put, processing, errors } = useForm({
        payment: { emails: settings.payment.emails ?? '' },
        inquiry: { emails: settings.inquiry.emails ?? '' },
    });

    const paymentTags = useMemo(() => splitRecipients(data.payment.emails), [data.payment.emails]);
    const inquiryTags = useMemo(() => splitRecipients(data.inquiry.emails), [data.inquiry.emails]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        put(route('admin.notification-settings.update'), { preserveScroll: true });
    };

    return (
        <AdminLayout title="Notification recipients">
            <p className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Email and in-app alerts go only to these addresses (matched to staff accounts by
                email). Leave a list empty to send nothing for that event.
            </p>

            <form onSubmit={submit} className="space-y-5">
                <Section
                    title="Payments"
                    description="Emails notified when a payment settles as completed."
                >
                    <TagsInput
                        label="Admin emails"
                        value={paymentTags}
                        onChange={(next) => setData('payment', { emails: next.join(', ') })}
                        validateTag={isValidEmail}
                        errors={errors['payment.emails'] ? [errors['payment.emails']] : []}
                        placeholder="finance@handco.test"
                    />
                </Section>

                <Section
                    title="Inquiries"
                    description="Emails notified when a partnership, quotation, or agent inquiry is submitted."
                >
                    <TagsInput
                        label="Admin emails"
                        value={inquiryTags}
                        onChange={(next) => setData('inquiry', { emails: next.join(', ') })}
                        validateTag={isValidEmail}
                        errors={errors['inquiry.emails'] ? [errors['inquiry.emails']] : []}
                        placeholder="support@handco.test"
                    />
                </Section>

                <button
                    type="submit"
                    disabled={processing}
                    className="cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                    {processing ? 'Saving…' : 'Save recipients'}
                </button>
            </form>
        </AdminLayout>
    );
}
