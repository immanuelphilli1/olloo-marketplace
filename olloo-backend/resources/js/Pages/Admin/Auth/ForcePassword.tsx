import { FormEvent } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import { useRoute } from '@/utils/route';

type SharedProps = {
    errors: Record<string, string>;
};

export default function ForcePassword() {
    const route = useRoute();
    const { errors } = usePage<SharedProps>().props;
    const { data, setData, post, processing } = useForm({
        password: '',
        password_confirmation: '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('admin.password.force.update'));
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
            <form
                onSubmit={submit}
                className="w-full max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
            >
                <div>
                    <h1 className="text-xl font-semibold">Change password</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        You must set a new password before continuing.
                    </p>
                </div>

                <label className="block text-sm">
                    <span className="mb-1 block text-slate-700">New password</span>
                    <input
                        type="password"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                        autoComplete="new-password"
                        required
                    />
                    {errors.password && (
                        <span className="mt-1 block text-sm text-red-600">{errors.password}</span>
                    )}
                </label>

                <label className="block text-sm">
                    <span className="mb-1 block text-slate-700">Confirm password</span>
                    <input
                        type="password"
                        value={data.password_confirmation}
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                        autoComplete="new-password"
                        required
                    />
                </label>

                <button
                    type="submit"
                    disabled={processing}
                    className="cursor-pointer w-full rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-60"
                >
                    {processing ? 'Saving…' : 'Update password'}
                </button>
            </form>
        </div>
    );
}
