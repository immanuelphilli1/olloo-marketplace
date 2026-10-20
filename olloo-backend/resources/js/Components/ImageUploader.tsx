import { useRef, useState } from 'react';
import { ImagePreview, inputClass } from '@/Components/Form';

function xsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find((cookie) => cookie.startsWith('XSRF-TOKEN='));
    return match ? decodeURIComponent(match.slice('XSRF-TOKEN='.length)) : '';
}

/** Upload image files to storage and return their paths. Throws on failure. */
export async function uploadImages(files: File[], folder: string, uploadUrl: string): Promise<string[]> {
    const paths: string[] = [];

    for (const file of files) {
        const form = new FormData();
        form.append('image', file);
        form.append('folder', folder);

        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'X-XSRF-TOKEN': xsrfToken(), Accept: 'application/json' },
            credentials: 'same-origin',
            body: form,
        });

        const payload = (await response.json().catch(() => null)) as { path?: string; error?: { message?: string }; errors?: Record<string, string[]> } | null;

        if (!response.ok || !payload || typeof payload.path !== 'string') {
            const message =
                payload?.error?.message ??
                (payload?.errors ? Object.values(payload.errors).flat()[0] : undefined) ??
                'Upload failed. Try again.';
            throw new Error(message);
        }

        paths.push(payload.path);
    }

    return paths;
}

/**
 * A URL-or-path text input with an upload button. Uploaded files go to
 * storage and the returned path fills the input; external URLs can still be
 * pasted directly.
 */
export default function ImageUploadField({
    id,
    value,
    onChange,
    folder,
    uploadUrl,
    error,
    placeholder,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    folder: 'products' | 'categories' | 'placements';
    uploadUrl: string;
    error?: string;
    placeholder?: string;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const upload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        setUploadError(null);
        try {
            const [path] = await uploadImages([files[0]], folder, uploadUrl);
            onChange(path);
        } catch (e) {
            setUploadError(e instanceof Error ? e.message : 'Upload failed. Try again.');
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <div className="flex items-start gap-4">
            <ImagePreview src={value} />
            <div className="min-w-0 flex-1">
                <input
                    id={`field-${id}`}
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    aria-invalid={Boolean(error)}
                    className={inputClass(error)}
                    placeholder={placeholder}
                />
                <div className="mt-2 flex items-center gap-3">
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        aria-label="Upload an image file"
                        onChange={(e) => void upload(e.target.files)}
                    />
                    <button
                        type="button"
                        disabled={uploading}
                        onClick={() => fileRef.current?.click()}
                        className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {uploading ? 'Uploading…' : 'Upload image'}
                    </button>
                    <span className="text-xs text-slate-500">JPEG, PNG or WebP up to 5 MB.</span>
                </div>
                {uploadError && <p className="mt-1 text-sm text-red-600">{uploadError}</p>}
            </div>
        </div>
    );
}
