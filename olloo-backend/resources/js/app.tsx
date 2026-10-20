import '../css/app.css';
import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';

// The brand, not APP_NAME: the image build has no VITE_APP_NAME, so the old
// fallback put "HandCO" in every admin tab.
const ADMIN_TITLE = 'H&CO. Admin';

createInertiaApp({
    title: (title) => (title ? `${title} · ${ADMIN_TITLE}` : ADMIN_TITLE),
    resolve: (name) =>
        resolvePageComponent(`./Pages/${name}.tsx`, import.meta.glob('./Pages/**/*.tsx')),
    setup({ el, App, props }) {
        createRoot(el).render(<App {...props} />);
    },
    progress: {
        color: '#0f172a',
        showSpinner: true,
    },
});
