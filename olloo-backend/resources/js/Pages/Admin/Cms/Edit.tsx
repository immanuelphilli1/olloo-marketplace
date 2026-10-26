import { FormEvent, useId } from 'react';
import { Link, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/Pages/Admin/Layouts/AdminLayout';
import { useRoute } from '@/utils/route';

type BlockType = 'heading' | 'paragraph' | 'bullets';

type ContentBlock = {
    type: BlockType;
    text?: string;
    items?: string[];
};

type Props = {
    page: {
        rid: string;
        slug: string;
        title: string;
        lastUpdated: string | null;
        intro: unknown;
        blocks: unknown;
    };
};

type SharedProps = {
    errors: Record<string, string>;
};

const BLOCK_TYPES: { value: BlockType; label: string }[] = [
    { value: 'heading', label: 'Heading' },
    { value: 'paragraph', label: 'Paragraph' },
    { value: 'bullets', label: 'Bullet list' },
];

function normalizeIntro(value: unknown): string[] {
    if (!Array.isArray(value) || value.length === 0) {
        return [''];
    }

    return value.map((line) => (typeof line === 'string' ? line : String(line ?? '')));
}

function normalizeBlocks(value: unknown): ContentBlock[] {
    if (!Array.isArray(value) || value.length === 0) {
        return [{ type: 'paragraph', text: '' }];
    }

    return value.map((raw): ContentBlock => {
        if (!raw || typeof raw !== 'object') {
            return { type: 'paragraph', text: '' };
        }

        const block = raw as Record<string, unknown>;
        const type = block.type === 'heading' || block.type === 'bullets' ? block.type : 'paragraph';

        if (type === 'bullets') {
            const items = Array.isArray(block.items)
                ? block.items.map((item) => (typeof item === 'string' ? item : String(item ?? '')))
                : [''];

            return { type, items: items.length > 0 ? items : [''] };
        }

        return {
            type,
            text: typeof block.text === 'string' ? block.text : String(block.text ?? ''),
        };
    });
}

export default function Edit({ page }: Props) {
    const route = useRoute();
    const formId = useId();
    const { errors } = usePage<SharedProps>().props;
    const { data, setData, put, processing } = useForm({
        title: page.title,
        slug: page.slug,
        last_updated: page.lastUpdated ?? '',
        intro: normalizeIntro(page.intro),
        blocks: normalizeBlocks(page.blocks),
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        put(route('admin.cms.update', page.rid));
    };

    const updateIntro = (index: number, value: string) => {
        setData(
            'intro',
            data.intro.map((line, i) => (i === index ? value : line)),
        );
    };

    const addIntro = () => {
        setData('intro', [...data.intro, '']);
    };

    const removeIntro = (index: number) => {
        const next = data.intro.filter((_, i) => i !== index);
        setData('intro', next.length > 0 ? next : ['']);
    };

    const updateBlock = (index: number, next: ContentBlock) => {
        setData(
            'blocks',
            data.blocks.map((block, i) => (i === index ? next : block)),
        );
    };

    const setBlockType = (index: number, type: BlockType) => {
        const current = data.blocks[index];
        if (type === 'bullets') {
            updateBlock(index, {
                type,
                items: current.items?.length ? current.items : [current.text || ''],
            });
            return;
        }

        updateBlock(index, {
            type,
            text: current.text ?? current.items?.filter(Boolean).join('\n') ?? '',
        });
    };

    const addBlock = (type: BlockType = 'paragraph') => {
        const next: ContentBlock =
            type === 'bullets' ? { type, items: [''] } : { type, text: '' };
        setData('blocks', [...data.blocks, next]);
    };

    const removeBlock = (index: number) => {
        const next = data.blocks.filter((_, i) => i !== index);
        setData('blocks', next.length > 0 ? next : [{ type: 'paragraph', text: '' }]);
    };

    const moveBlock = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= data.blocks.length) {
            return;
        }

        const next = [...data.blocks];
        const [item] = next.splice(index, 1);
        next.splice(target, 0, item);
        setData('blocks', next);
    };

    const updateBullet = (blockIndex: number, itemIndex: number, value: string) => {
        const block = data.blocks[blockIndex];
        if (block.type !== 'bullets' || !block.items) {
            return;
        }

        updateBlock(blockIndex, {
            ...block,
            items: block.items.map((item, i) => (i === itemIndex ? value : item)),
        });
    };

    const addBullet = (blockIndex: number) => {
        const block = data.blocks[blockIndex];
        if (block.type !== 'bullets') {
            return;
        }

        updateBlock(blockIndex, {
            ...block,
            items: [...(block.items ?? []), ''],
        });
    };

    const removeBullet = (blockIndex: number, itemIndex: number) => {
        const block = data.blocks[blockIndex];
        if (block.type !== 'bullets' || !block.items) {
            return;
        }

        const items = block.items.filter((_, i) => i !== itemIndex);
        updateBlock(blockIndex, {
            ...block,
            items: items.length > 0 ? items : [''],
        });
    };

    return (
        <AdminLayout title={`Edit ${page.title}`}>
            <div className="mb-4">
                <Link href={route('admin.cms.index')} className="cursor-pointer text-sm underline">
                    Back to CMS pages
                </Link>
            </div>
            <form onSubmit={submit} className="max-w-3xl space-y-6 rounded-lg border border-slate-200 bg-white p-5">
                <label className="block text-sm">
                    <span className="mb-1 block text-slate-700">Title</span>
                    <input
                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                        value={data.title}
                        onChange={(e) => setData('title', e.target.value)}
                        required
                    />
                    {errors.title && <span className="mt-1 block text-sm text-red-600">{errors.title}</span>}
                </label>

                <label className="block text-sm">
                    <span className="mb-1 block text-slate-700">Slug</span>
                    <input
                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                        value={data.slug}
                        onChange={(e) => setData('slug', e.target.value)}
                        required
                    />
                    <span className="mt-1 block text-xs text-slate-500">
                        URL key for the storefront page (for example about, privacy-policy).
                    </span>
                    {errors.slug && <span className="mt-1 block text-sm text-red-600">{errors.slug}</span>}
                </label>

                <label className="block text-sm">
                    <span className="mb-1 block text-slate-700">Last updated label</span>
                    <input
                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                        value={data.last_updated}
                        onChange={(e) => setData('last_updated', e.target.value)}
                        placeholder="January 1, 2026"
                    />
                    <span className="mt-1 block text-xs text-slate-500">
                        Shown to customers as the page date. Plain text is fine.
                    </span>
                </label>

                <section className="space-y-3 border-t border-slate-100 pt-5">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900">Intro</h2>
                        <p className="mt-1 text-xs text-slate-500">
                            Short paragraphs at the top of the page. Add one box per paragraph.
                        </p>
                    </div>
                    {errors.intro && <p className="text-sm text-red-600">{errors.intro}</p>}
                    <div className="space-y-3">
                        {data.intro.map((line, index) => (
                            <div key={`${formId}-intro-${index}`} className="flex gap-2">
                                <textarea
                                    rows={3}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                    value={line}
                                    onChange={(e) => updateIntro(index, e.target.value)}
                                    placeholder="Intro paragraph"
                                    aria-label={`Intro paragraph ${index + 1}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => removeIntro(index)}
                                    className="cursor-pointer self-start rounded-md border border-slate-300 px-2 py-2 text-xs text-slate-600 hover:bg-slate-50"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={addIntro}
                        className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                        Add intro paragraph
                    </button>
                </section>

                <section className="space-y-3 border-t border-slate-100 pt-5">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900">Page content</h2>
                        <p className="mt-1 text-xs text-slate-500">
                            Build the page with headings, paragraphs, and bullet lists. Reorder with Move up / Move
                            down.
                        </p>
                    </div>
                    {errors.blocks && <p className="text-sm text-red-600">{errors.blocks}</p>}

                    <div className="space-y-4">
                        {data.blocks.map((block, index) => (
                            <article
                                key={`${formId}-block-${index}`}
                                className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <label className="flex items-center gap-2 text-sm">
                                        <span className="text-slate-700">Block type</span>
                                        <select
                                            className="cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1.5"
                                            value={block.type}
                                            onChange={(e) => setBlockType(index, e.target.value as BlockType)}
                                        >
                                            {BLOCK_TYPES.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => moveBlock(index, -1)}
                                            disabled={index === 0}
                                            className="cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            Move up
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => moveBlock(index, 1)}
                                            disabled={index === data.blocks.length - 1}
                                            className="cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            Move down
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeBlock(index)}
                                            className="cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-red-700"
                                        >
                                            Remove block
                                        </button>
                                    </div>
                                </div>

                                {block.type === 'bullets' ? (
                                    <div className="space-y-2">
                                        <span className="block text-sm text-slate-700">Bullet points</span>
                                        {(block.items ?? ['']).map((item, itemIndex) => (
                                            <div key={`${formId}-bullet-${index}-${itemIndex}`} className="flex gap-2">
                                                <input
                                                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                                    value={item}
                                                    onChange={(e) => updateBullet(index, itemIndex, e.target.value)}
                                                    placeholder={`Point ${itemIndex + 1}`}
                                                    aria-label={`Block ${index + 1} bullet ${itemIndex + 1}`}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeBullet(index, itemIndex)}
                                                    className="cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-slate-600"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => addBullet(index)}
                                            className="cursor-pointer rounded-md border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
                                        >
                                            Add bullet
                                        </button>
                                    </div>
                                ) : (
                                    <label className="block text-sm">
                                        <span className="mb-1 block text-slate-700">
                                            {block.type === 'heading' ? 'Heading text' : 'Paragraph text'}
                                        </span>
                                        {block.type === 'heading' ? (
                                            <input
                                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                                                value={block.text ?? ''}
                                                onChange={(e) =>
                                                    updateBlock(index, { ...block, text: e.target.value })
                                                }
                                                placeholder="Section heading"
                                            />
                                        ) : (
                                            <textarea
                                                rows={4}
                                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                                                value={block.text ?? ''}
                                                onChange={(e) =>
                                                    updateBlock(index, { ...block, text: e.target.value })
                                                }
                                                placeholder="Write the paragraph customers will read."
                                            />
                                        )}
                                    </label>
                                )}
                            </article>
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => addBlock('heading')}
                            className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                            Add heading
                        </button>
                        <button
                            type="button"
                            onClick={() => addBlock('paragraph')}
                            className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                            Add paragraph
                        </button>
                        <button
                            type="button"
                            onClick={() => addBlock('bullets')}
                            className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                            Add bullet list
                        </button>
                    </div>
                </section>

                <button
                    type="submit"
                    disabled={processing}
                    className="cursor-pointer rounded-md bg-brand px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                    Save page
                </button>
            </form>
        </AdminLayout>
    );
}
