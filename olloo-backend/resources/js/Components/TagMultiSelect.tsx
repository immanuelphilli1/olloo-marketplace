import { useEffect, useMemo, useRef, useState } from 'react';
import { FaCheck, FaChevronDown, FaPlus, FaTimes } from 'react-icons/fa';

type Props = {
    id?: string;
    invalid?: boolean;
    value: string[];
    onChange: (next: string[]) => void;
    suggestions?: string[];
    placeholder?: string;
    searchPlaceholder?: string;
    max?: number;
};

function clean(tag: string): string {
    return tag.trim().replace(/\s+/g, ' ');
}

export default function TagMultiSelect({
    id,
    invalid = false,
    value,
    onChange,
    suggestions = [],
    placeholder = 'Select tags',
    searchPlaceholder = 'Search or type a new tag…',
    max = 10,
}: Props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: PointerEvent) => {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const normalized = useMemo(() => value.map(clean).filter(Boolean), [value]);
    const selected = useMemo(() => new Set(normalized.map((tag) => tag.toLowerCase())), [normalized]);
    const full = normalized.length >= max;

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        const pool = suggestions.map(clean).filter(Boolean);
        const unique = [...new Map(pool.map((tag) => [tag.toLowerCase(), tag])).values()];
        const filtered = q === '' ? unique : unique.filter((tag) => tag.toLowerCase().includes(q));
        return filtered.filter((tag) => !selected.has(tag.toLowerCase()));
    }, [suggestions, query, selected]);

    const alreadyListed = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (q === '') return true;
        return (
            selected.has(q) ||
            suggestions.map((tag) => clean(tag).toLowerCase()).includes(q)
        );
    }, [query, selected, suggestions]);

    const add = (raw: string) => {
        const tag = clean(raw);
        if (tag === '' || selected.has(tag.toLowerCase()) || normalized.length >= max) return;
        onChange([...normalized, tag]);
        setQuery('');
    };

    const remove = (raw: string) => {
        onChange(normalized.filter((tag) => tag.toLowerCase() !== raw.toLowerCase()));
    };

    return (
        <div ref={rootRef} className="relative">
            <button
                id={id}
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-invalid={invalid || undefined}
                className={`flex min-h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-left text-sm ${invalid ? 'border-red-400' : 'border-slate-300 hover:border-slate-400'}`}
            >
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {normalized.length === 0 ? (
                        <span className="truncate text-slate-500">{placeholder}</span>
                    ) : (
                        normalized.map((tag) => (
                            <span
                                key={tag.toLowerCase()}
                                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-800"
                            >
                                {tag}
                                <span
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Remove ${tag}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        remove(tag);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            remove(tag);
                                        }
                                    }}
                                    className="cursor-pointer text-slate-500 hover:text-slate-800"
                                >
                                    <FaTimes size={10} />
                                </span>
                            </span>
                        ))
                    )}
                </span>
                <FaChevronDown size={12} className="shrink-0 text-slate-500" />
            </button>
            {open && (
                <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 p-2">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    add(query);
                                }
                            }}
                            placeholder={searchPlaceholder}
                            aria-label="Search or add tags"
                            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                        />
                    </div>
                    <div role="listbox" aria-label="Tags" aria-multiselectable className="max-h-64 overflow-auto p-1">
                        {matches.map((tag) => (
                            <button
                                key={tag.toLowerCase()}
                                type="button"
                                role="option"
                                aria-selected={false}
                                disabled={full}
                                onClick={() => add(tag)}
                                className="flex w-full cursor-pointer items-center justify-between gap-2 rounded px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {tag}
                                <FaCheck size={12} className="invisible text-slate-400" />
                            </button>
                        ))}
                        {query.trim() !== '' && !alreadyListed && (
                            <button
                                type="button"
                                role="option"
                                aria-selected={false}
                                disabled={full}
                                onClick={() => add(query)}
                                className="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-1.5 text-left text-sm text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <FaPlus size={12} className="text-slate-500" />
                                Add “{clean(query)}”
                            </button>
                        )}
                        {matches.length === 0 && (query.trim() === '' || alreadyListed) && (
                            <p className="px-3 py-4 text-center text-sm text-slate-500">
                                {suggestions.length === 0
                                    ? 'No tags yet. Type above and press Enter to add one.'
                                    : 'No more matching tags.'}
                            </p>
                        )}
                    </div>
                    <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                        {normalized.length}/{max} tags{full ? '. Remove one to add another.' : '.'}
                    </p>
                </div>
            )}
        </div>
    );
}
