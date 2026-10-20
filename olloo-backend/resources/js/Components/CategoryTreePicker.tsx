import { useEffect, useMemo, useRef, useState } from 'react';
import { FaChevronDown, FaChevronRight, FaTimes } from 'react-icons/fa';

export type CategoryPickerNode = {
    rid: string;
    label: string;
    children: CategoryPickerNode[];
};

type Props = {
    id?: string;
    invalid?: boolean;
    nodes: CategoryPickerNode[];
    value: string;
    onChange: (rid: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    required?: boolean;
    allowClear?: boolean;
    clearLabel?: string;
};

export function findPath(nodes: CategoryPickerNode[], rid: string, trail: string[] = []): string[] | null {
    for (const node of nodes) {
        const next = [...trail, node.label];
        if (node.rid === rid) return next;
        const child = findPath(node.children, rid, next);
        if (child) return child;
    }
    return null;
}

export function ancestorRids(nodes: CategoryPickerNode[], rid: string, trail: string[] = []): string[] | null {
    for (const node of nodes) {
        if (node.rid === rid) return trail;
        const child = ancestorRids(node.children, rid, [...trail, node.rid]);
        if (child) return child;
    }
    return null;
}

function collectMatches(
    nodes: CategoryPickerNode[],
    query: string,
    trail: string[] = [],
): Array<{ rid: string; label: string; path: string }> {
    const out: Array<{ rid: string; label: string; path: string }> = [];
    const q = query.trim().toLowerCase();
    for (const node of nodes) {
        const path = [...trail, node.label].join(' / ');
        if (node.label.toLowerCase().includes(q) || path.toLowerCase().includes(q)) {
            out.push({ rid: node.rid, label: node.label, path });
        }
        out.push(...collectMatches(node.children, query, [...trail, node.label]));
    }
    return out;
}

export default function CategoryTreePicker({
    id,
    invalid = false,
    nodes,
    value,
    onChange,
    placeholder = 'Select category',
    searchPlaceholder = 'Search categories…',
    required = false,
    allowClear = false,
    clearLabel = 'Clear selection',
}: Props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [expanded, setExpanded] = useState<string[]>(() => ancestorRids(nodes, value) ?? []);
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

    const selectedPath = useMemo(() => {
        if (!value) return null;
        return findPath(nodes, value)?.join(' / ') ?? null;
    }, [nodes, value]);

    const matches = useMemo(
        () => (query.trim() === '' ? null : collectMatches(nodes, query)),
        [nodes, query],
    );

    const toggle = (rid: string) =>
        setExpanded((prev) => (prev.includes(rid) ? prev.filter((id) => id !== rid) : [...prev, rid]));

    const pick = (rid: string) => {
        onChange(rid);
        setOpen(false);
        setQuery('');
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
                className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-left text-sm ${invalid ? 'border-red-400' : 'border-slate-300 hover:border-slate-400'}`}
            >
                <span className={selectedPath ? 'truncate text-slate-900' : 'truncate text-slate-500'}>
                    {selectedPath ?? placeholder}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-slate-500">
                    {allowClear && value && (
                        <span
                            role="button"
                            tabIndex={0}
                            title={clearLabel}
                            aria-label={clearLabel}
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                                setQuery('');
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onChange('');
                                    setQuery('');
                                }
                            }}
                            className="cursor-pointer rounded p-1 hover:bg-slate-100 hover:text-slate-800"
                        >
                            <FaTimes size={12} />
                        </span>
                    )}
                    <FaChevronDown size={12} />
                </span>
            </button>
            {open && (
                <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 p-2">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={searchPlaceholder}
                            aria-label="Search categories"
                            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                        />
                    </div>
                    <div role="listbox" aria-label="Categories" className="max-h-64 overflow-auto p-1">
                        {matches !== null ? (
                            matches.length === 0 ? (
                                <p className="px-3 py-4 text-center text-sm text-slate-500">
                                    No categories match.
                                </p>
                            ) : (
                                matches.map((match) => (
                                    <button
                                        key={match.rid}
                                        type="button"
                                        role="option"
                                        aria-selected={match.rid === value}
                                        onClick={() => pick(match.rid)}
                                        className={`block w-full cursor-pointer truncate rounded px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                                            match.rid === value
                                                ? 'bg-slate-100 font-medium text-slate-900'
                                                : 'text-slate-700'
                                        }`}
                                        title={match.path}
                                    >
                                        {match.path}
                                    </button>
                                ))
                            )
                        ) : nodes.length === 0 ? (
                            <p className="px-3 py-4 text-center text-sm text-slate-500">
                                No categories yet.
                            </p>
                        ) : (
                            nodes.map((node) => (
                                <PickerRow
                                    key={node.rid}
                                    node={node}
                                    depth={0}
                                    value={value}
                                    expanded={expanded}
                                    onToggle={toggle}
                                    onPick={pick}
                                />
                            ))
                        )}
                    </div>
                    {required && !value && (
                        <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                            Pick the most specific category.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

function PickerRow({
    node,
    depth,
    value,
    expanded,
    onToggle,
    onPick,
}: {
    node: CategoryPickerNode;
    depth: number;
    value: string;
    expanded: string[];
    onToggle: (rid: string) => void;
    onPick: (rid: string) => void;
}) {
    const isOpen = expanded.includes(node.rid);
    const hasChildren = node.children.length > 0;
    const selected = node.rid === value;

    return (
        <div>
            <div
                role="option"
                aria-selected={selected}
                className={`flex items-center gap-1 rounded hover:bg-slate-50 ${
                    selected ? 'bg-slate-100' : ''
                }`}
                style={{ paddingLeft: 4 + depth * 16 }}
            >
                {hasChildren ? (
                    <button
                        type="button"
                        onClick={() => onToggle(node.rid)}
                        aria-label={isOpen ? `Collapse ${node.label}` : `Expand ${node.label}`}
                        className="cursor-pointer rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                    >
                        {isOpen ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                    </button>
                ) : (
                    <span className="w-7" />
                )}
                <button
                    type="button"
                    onClick={() => onPick(node.rid)}
                    className={`flex-1 cursor-pointer truncate rounded px-1 py-1.5 text-left text-sm ${
                        selected ? 'font-medium text-slate-900' : 'text-slate-700'
                    }`}
                >
                    {node.label}
                </button>
            </div>
            {hasChildren && isOpen && (
                <div>
                    {node.children.map((child) => (
                        <PickerRow
                            key={child.rid}
                            node={child}
                            depth={depth + 1}
                            value={value}
                            expanded={expanded}
                            onToggle={onToggle}
                            onPick={onPick}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
