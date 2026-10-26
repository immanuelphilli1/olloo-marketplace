import { FormEvent } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import { useRoute } from '@/utils/route';

type Props = {
    mode: 'setup' | 'verify';
    secret: string | null;
    otpauthUrl: string | null;
};

type SharedProps = {
    errors: Record<string, string>;
    flash?: {
        error?: string | null;
    };
};

export default function Mfa({ mode, secret, otpauthUrl }: Props) {
    const route = useRoute();
    const { errors, flash } = usePage<SharedProps>().props;
    const { data, setData, post, processing } = useForm({
        code: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route(mode === 'setup' ? 'admin.mfa.setup.store' : 'admin.mfa.verify.store'));
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
            <form
                onSubmit={submit}
                className="w-full max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
            >
                <div>
                    <h1 className="text-xl font-semibold">
                        {mode === 'setup' ? 'Set up MFA' : 'Verify MFA'}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {mode === 'setup'
                            ? 'Add this secret to your authenticator app, then enter a code.'
                            : 'Enter the 6-digit code from your authenticator app.'}
                    </p>
                </div>

                {flash?.error && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {flash.error}
                    </div>
                )}

                {mode === 'setup' && secret && (
                    <div className="space-y-2 rounded-md bg-slate-50 p-3 text-sm">
                        <div>
                            <span className="font-medium">Secret:</span>{' '}
                            <code className="break-all">{secret}</code>
                        </div>
                        {otpauthUrl && (
                            <div>
                                <span className="font-medium">otpauth URL:</span>{' '}
                                <code className="break-all text-xs">{otpauthUrl}</code>
                            </div>
                        )}
                    </div>
                )}

                <label className="block text-sm">
                    <span className="mb-1 block text-slate-700">Authentication code</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={data.code}
                        onChange={(e) => setData('code', e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 tracking-widest"
                        autoComplete="one-time-code"
                        required
                    />
                    {errors.code && (
                        <span className="mt-1 block text-sm text-red-600">{errors.code}</span>
                    )}
                </label>

                <button
                    type="submit"
                    disabled={processing}
                    className="cursor-pointer w-full rounded-md bg-brand px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-60"
                >
                    {processing ? 'Checking…' : mode === 'setup' ? 'Enable MFA' : 'Verify'}
                </button>
            </form>
        </div>
    );
}
