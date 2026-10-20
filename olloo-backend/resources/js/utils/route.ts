import { route as ziggyRoute } from 'ziggy-js';
import { usePage } from '@inertiajs/react';

type ZiggyConfig = {
    url?: string;
    port?: number | null;
    defaults?: Record<string, string>;
    routes: Record<string, { uri: string; methods?: string[]; [key: string]: unknown }>;
    location?: string;
};

declare global {
    interface Window {
        route?: typeof ziggyRoute;
    }
}

export function useRoute() {
    const { props } = usePage<{ ziggy?: ZiggyConfig }>();
    const ziggy = props.ziggy;

    return (
        name: string,
        params?: Record<string, unknown> | string | number,
        absolute = false,
    ) => {
        if (ziggy?.routes) {
            return ziggyRoute(name, params as never, absolute, ziggy as never);
        }

        if (typeof window !== 'undefined' && typeof window.route === 'function') {
            return window.route(name, params as never, absolute);
        }

        return '#';
    };
}
