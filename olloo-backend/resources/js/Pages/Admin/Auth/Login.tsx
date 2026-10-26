import { FormEvent } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import { useRoute } from '@/utils/route';

type SharedProps = {
    errors: Record<string, string>;
};

export default function Login() {
    const route = useRoute();
    const { errors } = usePage<SharedProps>().props;
    const { data, setData, post, processing } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('admin.login.store'));
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
            <form
                onSubmit={submit}
                className="w-full max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
            >
                <div className="flex flex-col items-center text-center">
                    <img src="/images/brand/olloo-mark.svg" alt="olloo" className="mb-3 h-14 w-14" />
                    <h1 className="text-xl font-semibold">Staff login</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Sign in to the olloo admin panel.
                    </p>
                </div>

                <label className="block text-sm">
                    <span className="mb-1 block text-slate-700">Email</span>
                    <input
                        type="email"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                        autoComplete="username"
                        required
                    />
                    {errors.email && (
                        <span className="mt-1 block text-sm text-red-600">{errors.email}</span>
                    )}
                </label>

                <label className="block text-sm">
                    <span className="mb-1 block text-slate-700">Password</span>
                    <input
                        type="password"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                        autoComplete="current-password"
                        required
                    />
                    {errors.password && (
                        <span className="mt-1 block text-sm text-red-600">{errors.password}</span>
                    )}
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                        type="checkbox"
                        checked={data.remember}
                        onChange={(e) => setData('remember', e.target.checked)}
                        className="cursor-pointer"
                    />
                    Remember me
                </label>

                <button
                    type="submit"
                    disabled={processing}
                    className="cursor-pointer w-full rounded-md bg-brand px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-60"
                >
                    {processing ? 'Signing in…' : 'Sign in'}
                </button>
            </form>
        </div>
    );
}
