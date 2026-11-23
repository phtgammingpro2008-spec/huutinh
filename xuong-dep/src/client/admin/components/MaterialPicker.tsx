import { useId } from 'react';
import { api, ApiError } from '../api';
import { KIND_LABEL, type Material, type MaterialKind } from '../catalog';

const NEW = '__new__';

/** Select for one material group, with "+ Thêm mới…" to add an entry on the spot. */
export function MaterialPicker({ kind, value, materials, onChange, onCreated, disabled }: {
  kind: MaterialKind; value: string | null; materials: Material[]; onChange: (id: string | null) => void;
  onCreated: () => Promise<void>; disabled?: boolean;
}) {
  const options = materials.filter((m) => m.kind === kind);
  const id = useId();

  async function pick(v: string) {
    if (v !== NEW) return onChange(v || null);
    const name = window.prompt(`Tên ${KIND_LABEL[kind].toLowerCase()} mới (tiếng Việt)`)?.trim();
    if (!name) return;
    try {
      const m = await api<Material>('POST', '/api/materials', { kind, nameVi: name });
      await onCreated();
      onChange(m.id);
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : 'Không thêm được');
    }
  }

  return (
    <div className="grow" style={{ minWidth: 90 }}>
      <label htmlFor={id} className="small">{KIND_LABEL[kind]}</label>
      <select id={id} value={value ?? ''} disabled={disabled} onChange={(e) => pick(e.target.value)}>
        <option value="">—</option>
        {options.map((m) => <option key={m.id} value={m.id}>{m.nameVi}</option>)}
        {value && !options.some((m) => m.id === value) && <option value={value}>(đã ẩn)</option>}
        <option value={NEW}>+ Thêm mới…</option>
      </select>
    </div>
  );
}
