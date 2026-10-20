import type { Config } from 'ziggy-js';

declare global {
    function route(
        name?: string,
        params?: Record<string, unknown> | string | number,
        absolute?: boolean,
        config?: Config,
    ): string;

    interface Window {
        route: typeof route;
        Ziggy?: Config;
    }
}

export {};
