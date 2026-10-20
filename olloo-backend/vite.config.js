import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, projectRoot, '');

    const host = env.VITE_HOST || 'localhost';
    const port = Number(env.VITE_PORT || 5173);
    const httpsEnabled = env.VITE_HTTPS === 'true';
    const protocol = httpsEnabled ? 'https' : 'http';
    const devServerUrl = env.VITE_DEV_SERVER_URL || `${protocol}://${host}:${port}`;

    let https = false;

    if (httpsEnabled) {
        const keyPath = path.resolve(projectRoot, env.VITE_SSL_KEY || 'ssl/privkey.pem');
        const certPath = path.resolve(projectRoot, env.VITE_SSL_CERT || 'ssl/fullchain.pem');

        if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
            throw new Error(
                `VITE_HTTPS=true but SSL certificate files were not found.\n`
                + `  key:  ${keyPath}\n`
                + `  cert: ${certPath}`,
            );
        }

        https = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath),
        };
    }

    return {
        plugins: [
            laravel({
                input: ['resources/css/app.css', 'resources/js/app.tsx'],
                refresh: true,
            }),
            react(),
            tailwindcss(),
        ],
        resolve: {
            alias: {
                '@': path.resolve('resources/js'),
            },
        },
        server: {
            // Bind on all interfaces when host is not localhost (remote dev / Docker).
            host: host === 'localhost' ? true : host,
            port,
            strictPort: true,
            https,
            // Allow the app origin to load modules cross-origin.
            cors: true,
            // Laravel writes this into public/hot. It must stay the domain, not the
            // bind IP: an https page cannot load assets from an http origin, and a
            // Let's Encrypt cert does not validate against a bare IP anyway.
            origin: devServerUrl,
            hmr: {
                host: env.VITE_HMR_HOST || (host === '0.0.0.0' ? 'localhost' : host),
                protocol: httpsEnabled ? 'wss' : 'ws',
                port,
            },
            watch: {
                ignored: ['**/storage/framework/views/**'],
            },
        },
    };
});