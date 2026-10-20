import { useState } from 'react';

type Props = {
    previewUrl: string;
    hasHtml: boolean;
    textFallback: string | null;
};

type Viewport = 'desktop' | 'tablet' | 'mobile';

const VIEWPORTS: Record<Viewport, { label: string; width: string }> = {
    desktop: { label: 'Desktop', width: '100%' },
    tablet: { label: 'Tablet', width: '768px' },
    mobile: { label: 'Mobile', width: '390px' },
};

/**
 * Sandboxed HTML email renderer.
 * Loads HTML through a same-origin preview endpoint with a locked-down CSP.
 * Scripts cannot run (iframe sandbox without allow-scripts).
 */
export default function EmailHtmlPreview({ previewUrl, hasHtml, textFallback }: Props) {
    const [viewport, setViewport] = useState<Viewport>('desktop');
    const [bg, setBg] = useState<'light' | 'dim'>('dim');
    const [loaded, setLoaded] = useState(false);

    if (!hasHtml) {
        return (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6">
                <p className="mb-2 text-sm font-medium text-slate-700">No HTML body</p>
                <pre className="whitespace-pre-wrap text-sm text-slate-600">
                    {textFallback || 'This email was stored without an HTML part.'}
                </pre>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                    {(Object.keys(VIEWPORTS) as Viewport[]).map((key) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setViewport(key)}
                            className={`cursor-pointer rounded-md px-2.5 py-1 text-xs ${
                                viewport === key
                                    ? 'bg-slate-900 text-white'
                                    : 'border border-slate-300 bg-white text-slate-700'
                            }`}
                        >
                            {VIEWPORTS[key].label}
                        </button>
                    ))}
                </div>
                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={() => setBg('dim')}
                        className={`cursor-pointer rounded-md px-2.5 py-1 text-xs ${
                            bg === 'dim' ? 'bg-slate-800 text-white' : 'border border-slate-300 bg-white'
                        }`}
                    >
                        Dim stage
                    </button>
                    <button
                        type="button"
                        onClick={() => setBg('light')}
                        className={`cursor-pointer rounded-md px-2.5 py-1 text-xs ${
                            bg === 'light' ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white'
                        }`}
                    >
                        Light stage
                    </button>
                    <a
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="cursor-pointer rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs"
                    >
                        Open raw
                    </a>
                </div>
            </div>

            <div
                className={`flex justify-center overflow-auto rounded-md border border-slate-300 p-4 ${
                    bg === 'dim' ? 'bg-slate-700' : 'bg-slate-100'
                }`}
                style={{ minHeight: 480 }}
            >
                <div
                    className="overflow-hidden rounded-md bg-white shadow-lg transition-[width] duration-200"
                    style={{ width: VIEWPORTS[viewport].width, maxWidth: '100%' }}
                >
                    {!loaded && (
                        <div className="p-6 text-center text-sm text-slate-500">Loading preview…</div>
                    )}
                    <iframe
                        title="Email HTML preview"
                        src={previewUrl}
                        sandbox=""
                        referrerPolicy="no-referrer"
                        className="block w-full border-0"
                        style={{ height: 640, background: '#fff' }}
                        onLoad={() => setLoaded(true)}
                    />
                </div>
            </div>

            <p className="text-xs text-slate-500">
                Preview is sandboxed: scripts, forms, and top-level navigation are blocked. Images from http(s)
                and data URIs are allowed so typical marketing emails still render.
            </p>
        </div>
    );
}
