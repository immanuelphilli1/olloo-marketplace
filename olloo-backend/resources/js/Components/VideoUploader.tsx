import { useRef, useState } from 'react';
import { inputClass } from '@/Components/Form';

function xsrfToken(): string {
    const match = document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN='));
    return match ? decodeURIComponent(match.slice('XSRF-TOKEN='.length)) : '';
}

/**
 * A URL-or-path input with an upload button for banner videos (MP4 or WebM).
 * Same shape as ImageUploadField: the upload fills the input with the stored path.
 */
export default function VideoUploadField({
    id,
    value,
    onChange,
    uploadUrl,
    error,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    uploadUrl: string;
    error?: string;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const upload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        setUploadError(null);
        try {
            const form = new FormData();
            form.append('video', files[0]);
            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'X-XSRF-TOKEN': xsrfToken(), Accept: 'application/json' },
                credentials: 'same-origin',
                body: form,
            });
            const payload = (await response.json().catch(() => null)) as {
                path?: string;
                error?: { message?: string };
                errors?: Record<string, string[]>;
            } | null;
            if (!response.ok || !payload || typeof payload.path !== 'string') {
                throw new Error(
                    payload?.error?.message ??
                        (payload?.errors ? Object.values(payload.errors).flat()[0] : undefined) ??
                        'Upload failed. Try again.',
                );
            }
            onChange(payload.path);
        } catch (e) {
            setUploadError(e instanceof Error ? e.message : 'Upload failed. Try again.');
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <div className="space-y-2">
            {value && (
                <video
                    src={value}
                    className="h-12 w-full rounded-md border border-slate-200 object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                />
            )}
            <input
                id={`field-${id}`}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-invalid={Boolean(error)}
                className={inputClass(error)}
                placeholder="https://"
            />
            <div className="flex flex-wrap items-center gap-3">
                <input
                    ref={fileRef}
                    type="file"
                    accept="video/mp4,video/webm"
                    className="hidden"
                    aria-label="Upload a video file"
                    onChange={(e) => void upload(e.target.files)}
                />
                <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {uploading ? 'Uploading…' : 'Upload video'}
                </button>
                <span className="text-xs text-slate-500">MP4 or WebM up to 20 MB.</span>
            </div>
            {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
        </div>
    );
}
