import { useState } from 'react';

async function copyText(value: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * Copies a reference and confirms it, so staff can paste it into an email, a
 * chat or a bank query without retyping it from the screen.
 */
export default function CopyButton({
    value,
    label,
    title,
    className = 'cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50',
}: {
    value: string;
    label: string;
    title?: string;
    className?: string;
}) {
    const [copied, setCopied] = useState<'copied' | 'failed' | null>(null);

    const copy = async () => {
        const ok = await copyText(value);
        setCopied(ok ? 'copied' : 'failed');

        window.setTimeout(() => setCopied(null), 2000);
    };

    return (
        <button
            type="button"
            onClick={copy}
            title={title ?? `Copy ${label.toLowerCase()}`}
            aria-label={title ?? `Copy ${label.toLowerCase()}`}
            className={className}
        >
            {copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Press Ctrl+C' : label}
        </button>
    );
}