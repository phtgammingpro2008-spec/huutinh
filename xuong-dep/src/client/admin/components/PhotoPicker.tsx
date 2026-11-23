import { useState, type ChangeEvent } from 'react';
import { compressImage, ImageError } from '../../lib/image';

export type EditorImage = {
  id: string;
  name: string;
  width: number;
  height: number;
  url: string; // object URL while local, /img/... once stored
  key: string | null;
  blob?: Blob;
  uploadError?: string;
};

/** "Chọn ảnh": compresses each photo on the phone and hands it over at once. Unreadable files get a message; the rest still load. */
export function PhotoPicker({ onAdded, label = 'Chọn ảnh' }: { onAdded: (img: EditorImage) => void; label?: string }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(0);

  async function onChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    setErrors([]);
    setBusy((n) => n + files.length);
    for (const file of files) {
      try {
        const { blob, width, height } = await compressImage(file);
        onAdded({ id: crypto.randomUUID(), name: file.name, width, height, url: URL.createObjectURL(blob), key: null, blob });
      } catch (err) {
        setErrors((xs) => [...xs, err instanceof ImageError ? err.message : `Không đọc được ảnh này: ${file.name}`]);
      } finally {
        setBusy((n) => n - 1);
      }
    }
  }

  return (
    <div>
      <label htmlFor="photo-input" className="btn btn-block btn-primary" style={{ display: 'flex' }}>{label}</label>
      <input id="photo-input" type="file" accept="image/*" multiple onChange={onChange} aria-label={label}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
      {busy > 0 && <p className="muted small">Đang xử lý {busy} ảnh…</p>}
      {errors.map((m) => <p key={m} className="error" role="alert" style={{ marginTop: 8 }}>{m}</p>)}
    </div>
  );
}
