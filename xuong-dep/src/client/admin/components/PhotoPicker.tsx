import { useState, type ChangeEvent } from 'react';
import { ApiError, uploadImage } from '../api';
import { compressImage, ImageError } from '../../lib/image';

export type EditorImage = {
  id: string;
  name: string;
  width: number;
  height: number;
  url: string; // object URL while local, /img/... once uploaded
  key: string | null;
  blob?: Blob;
  uploadError?: string;
};

/** "Chọn ảnh": compresses each photo on the phone, shows it at once, uploads in the background. */
export function PhotoPicker(props: {
  onAdded: (img: EditorImage) => void;
  onUploaded: (id: string, key: string) => void;
  onUploadError: (id: string, message: string) => void;
  label?: string;
}) {
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
        const img: EditorImage = { id: crypto.randomUUID(), name: file.name, width, height, url: URL.createObjectURL(blob), key: null, blob };
        props.onAdded(img);
        uploadImage(blob, width, height, img.id)
          .then((r) => props.onUploaded(img.id, r.key))
          .catch((err) => props.onUploadError(img.id, err instanceof ApiError ? err.message : 'Tải ảnh lên thất bại'));
      } catch (err) {
        const msg = err instanceof ImageError ? err.message : `Không đọc được ảnh này: ${file.name}`;
        setErrors((xs) => [...xs, msg]);
      } finally {
        setBusy((n) => n - 1);
      }
    }
  }

  return (
    <div>
      <label htmlFor="photo-input" className="btn btn-block btn-primary" style={{ display: 'flex' }}>
        {props.label ?? 'Chọn ảnh'}
      </label>
      <input id="photo-input" type="file" accept="image/*" multiple onChange={onChange}
        aria-label={props.label ?? 'Chọn ảnh'} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
      {busy > 0 && <p className="muted small">Đang xử lý {busy} ảnh…</p>}
      {errors.map((m) => <p key={m} className="error" role="alert" style={{ marginTop: 8 }}>{m}</p>)}
    </div>
  );
}
