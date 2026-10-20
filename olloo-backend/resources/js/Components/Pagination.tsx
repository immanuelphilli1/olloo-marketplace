import { router } from '@inertiajs/react';

type LinkItem = { url: string | null; label: string; active: boolean };

export default function Pagination({ links }: { links: LinkItem[] }) {
    if (links.length <= 3) {
        return null;
    }

    return (
        <div className="mt-4 flex flex-wrap gap-2">
            {links.map((link, index) => (
                <button
                    key={`${link.label}-${index}`}
                    type="button"
                    disabled={!link.url || link.active}
                    className={`cursor-pointer rounded-md border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                        link.active
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-300 bg-white'
                    }`}
                    onClick={() => link.url && router.get(link.url)}
                    dangerouslySetInnerHTML={{ __html: link.label }}
                />
            ))}
        </div>
    );
}
