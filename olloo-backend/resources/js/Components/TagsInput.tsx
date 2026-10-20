import { KeyboardEvent, useMemo, useState } from 'react';

export type TagsInputProps = {
    label?: string;
    value: string[];
    onChange: (next: string[]) => void;
    placeholder?: string;
    className?: string;
    errors?: string[];
    validateTag?: (tag: string) => string | null;
};

function splitTokens(input: string): string[] {
    return input
        .split(/[\s,;]+/g)
        .map((item) => item.trim())
        .filter(Boolean);
}

export default function TagsInput({
    label,
    value,
    onChange,
    placeholder = 'Type and press Enter, Space, or comma',
    className = '',
    errors = [],
    validateTag,
}: TagsInputProps) {
    const [input, setInput] = useState('');
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    const normalizedValue = useMemo(
        () => value.map((v) => v.trim()).filter(Boolean),
        [value],
    );

    const pushTokens = (raw: string[]) => {
        if (raw.length === 0) {
            return;
        }

        const next = [...normalizedValue];
        const nextErrors: string[] = [];

        for (const token of raw) {
            const candidate = token.trim();
            if (!candidate || next.includes(candidate)) {
                continue;
            }

            if (validateTag) {
                const reason = validateTag(candidate);
                if (reason) {
                    nextErrors.push(`"${candidate}": ${reason}`);
                    continue;
                }
            }

            next.push(candidate);
        }

        onChange(next);
        setValidationErrors(nextErrors);
    };

    const commitInput = () => {
        pushTokens(splitTokens(input));
        setInput('');
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
            event.preventDefault();
            commitInput();
        }

        if (event.key === 'Backspace' && input === '' && normalizedValue.length > 0) {
            onChange(normalizedValue.slice(0, -1));
        }
    };

    const onPaste: React.ClipboardEventHandler<HTMLInputElement> = (event) => {
        const text = event.clipboardData.getData('text');
        const tokens = splitTokens(text);
        if (tokens.length <= 1) {
            return;
        }

        event.preventDefault();
        pushTokens(tokens);
        setInput('');
    };

    const removeAt = (index: number) => {
        onChange(normalizedValue.filter((_, idx) => idx !== index));
    };

    const allErrors = [...validationErrors, ...errors];

    return (
        <div className={className}>
            {label && <label className="mb-1 block text-sm text-slate-600">{label}</label>}
            <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2">
                {normalizedValue.map((tag, index) => (
                    <span
                        key={`${tag}-${index}`}
                        className="inline-flex items-center gap-2 rounded bg-slate-100 px-2 py-1 text-xs text-slate-800"
                    >
                        {tag}
                        <button
                            type="button"
                            onClick={() => removeAt(index)}
                            className="cursor-pointer text-slate-500 hover:text-slate-800"
                            aria-label={`Remove ${tag}`}
                        >
                            ×
                        </button>
                    </span>
                ))}
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    onBlur={commitInput}
                    onPaste={onPaste}
                    placeholder={normalizedValue.length === 0 ? placeholder : ''}
                    className="min-w-[10rem] flex-1 border-0 bg-transparent p-0 text-sm outline-none focus:ring-0"
                />
            </div>
            {allErrors.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-red-600">
                    {allErrors.map((err) => (
                        <li key={err}>{err}</li>
                    ))}
                </ul>
            )}
        </div>
    );
}
