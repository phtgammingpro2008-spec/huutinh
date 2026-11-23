import { useEffect, useState } from 'react';
import { LANGS, type Lang, type LineSetting } from '../../../shared/types';
import { api, ApiError } from '../api';
import { invalidateMaterials, invalidateSettings, KIND_LABEL, type Material, type MaterialKind, type Settings as SettingsData } from '../catalog';

const LANG_NAME: Record<Lang, string> = { vi: 'Tiếng Việt', en: 'English', km: 'ខ្មែរ' };

function MaterialRow({ m, onSaved }: { m: Material; onSaved: () => void }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(m);
  const save = async (next: Material) => {
    await api('PUT', `/api/materials/${m.id}`, next);
    invalidateMaterials();
    setEdit(false);
    onSaved();
  };
  return (
    <li className="card material-row" style={{ padding: 10, opacity: m.hidden ? 0.6 : 1 }}>
      {!edit ? (
        <div className="row">
          <div className="grow"><strong>{m.nameVi}</strong>
            <div className="small muted">{[m.nameEn, m.nameKm].filter(Boolean).join(' · ') || 'Chưa có tên tiếng Anh/Khmer'}{m.hidden && ' · đang ẩn'}</div></div>
          <button type="button" className="btn-sm" onClick={() => setEdit(true)}>Sửa</button>
          <button type="button" className="btn-sm" onClick={() => save({ ...m, hidden: !m.hidden })}>{m.hidden ? 'Hiện lại' : 'Ẩn'}</button>
        </div>
      ) : (
        <div className="stack">
          <input aria-label="Tên tiếng Việt" value={v.nameVi} onChange={(e) => setV({ ...v, nameVi: e.target.value })} />
          <input aria-label="Tên tiếng Anh" placeholder="Tên tiếng Anh" value={v.nameEn} onChange={(e) => setV({ ...v, nameEn: e.target.value })} />
          <input aria-label="Tên tiếng Khmer" placeholder="Tên tiếng Khmer" value={v.nameKm} onChange={(e) => setV({ ...v, nameKm: e.target.value })} />
          <div className="row"><button type="button" className="btn-primary btn-sm" onClick={() => save(v)}>Lưu</button><button type="button" className="btn-sm" onClick={() => setEdit(false)}>Thôi</button></div>
        </div>
      )}
    </li>
  );
}

export function Settings() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [kind, setKind] = useState<MaterialKind>('sole');
  const [newName, setNewName] = useState('');
  const [s, setS] = useState<SettingsData | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const loadMaterials = () => api<Material[]>('GET', '/api/materials?all=1').then(setMaterials).catch(() => {});
  useEffect(() => { loadMaterials(); api<SettingsData>('GET', '/api/settings').then(setS).catch((e) => setError(e.message)); }, []);

  async function addMaterial() {
    setError('');
    try {
      await api('POST', '/api/materials', { kind, nameVi: newName });
      invalidateMaterials();
      setNewName('');
      loadMaterials();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Không thêm được'); }
  }

  const setLine = (i: number, l: LineSetting) => { setMsg(''); setS((x) => x && { ...x, lines: x.lines.map((y, k) => (k === i ? l : y)) }); };
  async function saveSettings() {
    if (!s) return;
    setError(''); setMsg('');
    try {
      setS(await api<SettingsData>('PUT', '/api/settings', s));
      invalidateSettings();
      setMsg('Đã lưu cài đặt');
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Không lưu được'); }
  }
  async function logout() {
    await api('POST', '/api/logout').catch(() => {});
    window.location.hash = '#/';
    window.location.reload();
  }

  return (
    <main className="page">
      <h1>Cài đặt</h1>
      <a className="list-item" href="#/customers"><strong className="grow">Khách hàng</strong><span aria-hidden="true">›</span></a>

      <h2>Vật liệu</h2>
      <div className="row">
        <select aria-label="Nhóm vật liệu" value={kind} onChange={(e) => setKind(e.target.value as MaterialKind)} style={{ width: 110 }}>
          {(Object.keys(KIND_LABEL) as MaterialKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <input className="grow" aria-label="Tên vật liệu mới" placeholder="Tên, ví dụ VIP 1" value={newName} onChange={(e) => setNewName(e.target.value)} />
      </div>
      <button type="button" className="btn-block" style={{ marginTop: 8 }} disabled={!newName.trim()} onClick={addMaterial}>Thêm vật liệu</button>
      {(Object.keys(KIND_LABEL) as MaterialKind[]).map((k) => (
        <div key={k}>
          <h3>{KIND_LABEL[k]}</h3>
          <ul className="list">{materials.filter((m) => m.kind === k).map((m) => <MaterialRow key={m.id + m.hidden + m.nameVi} m={m} onSaved={loadMaterials} />)}</ul>
          {!materials.some((m) => m.kind === k) && <p className="small muted">Chưa có.</p>}
        </div>
      ))}

      {s && (
        <>
          <h2>Dải size mặc định</h2>
          {s.lines.map((l, i) => (
            <div key={i} className="card" style={{ marginBottom: 8, padding: 10 }}>
              <div className="row wrap">
                <input aria-label={`Tên dòng ${i + 1}`} className="grow" value={l.label.vi} onChange={(e) => setLine(i, { ...l, label: { ...l.label, vi: e.target.value } })} />
                <input aria-label={`Size từ – ${l.label.vi}`} inputMode="numeric" style={{ width: 64 }} value={String(l.sizeFrom)} onChange={(e) => setLine(i, { ...l, sizeFrom: parseInt(e.target.value, 10) || 0 })} />
                <span>–</span>
                <input aria-label={`Size đến – ${l.label.vi}`} inputMode="numeric" style={{ width: 64 }} value={String(l.sizeTo)} onChange={(e) => setLine(i, { ...l, sizeTo: parseInt(e.target.value, 10) || 0 })} />
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <input aria-label={`Tên tiếng Anh – ${l.label.vi}`} placeholder="English" value={l.label.en} onChange={(e) => setLine(i, { ...l, label: { ...l.label, en: e.target.value } })} />
                <input aria-label={`Tên tiếng Khmer – ${l.label.vi}`} placeholder="ខ្មែរ" value={l.label.km} onChange={(e) => setLine(i, { ...l, label: { ...l.label, km: e.target.value } })} />
              </div>
            </div>
          ))}
          <button type="button" className="btn-sm" onClick={() => setS({ ...s, lines: [...s.lines, { key: `dong_${Date.now().toString(36)}`, label: { vi: 'Dòng mới', en: '', km: '' }, sizeFrom: 35, sizeTo: 40 }] })}>+ Thêm dòng size</button>

          <h2>Tin nhắn gửi báo giá</h2>
          <p className="small muted">Dùng {'{code}'} cho mã đơn, {'{total}'} cho tổng tiền, {'{url}'} cho đường link (bắt buộc).</p>
          {LANGS.map((lang) => (
            <div key={lang} className="field">
              <label htmlFor={`qm-${lang}`}>{LANG_NAME[lang]}</label>
              <textarea id={`qm-${lang}`} aria-label={`Tin nhắn báo giá – ${LANG_NAME[lang]}`} value={s.quoteMessage[lang]}
                onChange={(e) => { setMsg(''); setS({ ...s, quoteMessage: { ...s.quoteMessage, [lang]: e.target.value } }); }} />
            </div>
          ))}
          {error && <p className="error">{error}</p>}
          <button type="button" className="btn-primary btn-block" onClick={saveSettings}>Lưu cài đặt</button>
          {msg && <p className="success">{msg}</p>}
        </>
      )}

      <h2>Dữ liệu</h2>
      <a className="btn btn-block" href="/api/export" download>Tải bản sao lưu</a>
      <p className="small muted">File JSON chứa toàn bộ khách, đơn, báo giá, thư viện. Nên tải mỗi tuần và cất vào Google Drive.</p>
      <button type="button" className="btn-block btn-danger" style={{ marginTop: 16 }} onClick={logout}>Đăng xuất</button>
    </main>
  );
}
