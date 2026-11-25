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

/** Connect the owner's own Telegram bot: alerts for new orders, edits, accepted quotes, cancellations and sign-ups. */
function TelegramCard() {
  const [st, setSt] = useState<{ connected: boolean; bot: string } | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { api<{ connected: boolean; bot: string }>('GET', '/api/telegram').then(setSt).catch(() => {}); }, []);
  const run = async (f: () => Promise<void>) => {
    setBusy(true); setMsg(''); setError('');
    try { await f(); } catch (e) { setError(e instanceof ApiError ? e.message : 'Không kết nối được, thử lại sau'); } finally { setBusy(false); }
  };
  const connect = () => run(async () => { setSt(await api('POST', '/api/telegram/connect', { token })); setToken(''); setMsg('Đã kết nối. Anh xem Telegram có tin nhắn thử chưa nhé.'); });
  const test = () => run(async () => { await api('POST', '/api/telegram/test'); setMsg('Đã gửi tin thử.'); });
  const off = () => run(async () => { setSt(await api('DELETE', '/api/telegram')); setMsg('Đã ngắt kết nối.'); });
  if (!st) return null;
  return (
    <>
      <h2>Báo đơn qua Telegram</h2>
      <div className="card stack tg-card">
        {st.connected ? (
          <>
            <p style={{ margin: 0 }}><strong>Đang bật</strong> · bot <strong>@{st.bot}</strong></p>
            <p className="small muted" style={{ margin: 0 }}>Có đơn mới, khách sửa đơn, đồng ý báo giá, hủy đơn hoặc khách mới đăng ký là Telegram báo anh ngay.</p>
            <div className="row">
              <button type="button" className="btn-sm" disabled={busy} onClick={test}>Gửi tin thử</button>
              <button type="button" className="btn-sm btn-danger" disabled={busy} onClick={off}>Ngắt kết nối</button>
            </div>
          </>
        ) : (
          <>
            <p className="small muted" style={{ margin: 0 }}>Nhận tin trên điện thoại mỗi khi có đơn mới. Làm một lần, khoảng 2 phút:</p>
            <ol className="tg-steps">
              <li>Mở Telegram, tìm <strong>@BotFather</strong>, bấm Start rồi gửi <code>/newbot</code>.</li>
              <li>Đặt tên bot (ví dụ <em>HLUXURY báo đơn</em>) và tên đăng nhập kết thúc bằng <code>bot</code>. BotFather gửi lại một <strong>mã bot</strong> dạng <code>123456789:ABC…</code></li>
              <li>Bấm vào link bot vừa tạo, bấm <strong>Start</strong>.</li>
              <li>Chép mã bot dán vào ô dưới, bấm <strong>Kết nối</strong>.</li>
            </ol>
            <label htmlFor="tg-token">Mã bot</label>
            <input id="tg-token" autoComplete="off" spellCheck={false} placeholder="123456789:ABC…" value={token} onChange={(e) => setToken(e.target.value)} />
            <button type="button" className="btn-primary" disabled={busy || !token.trim()} onClick={connect}>{busy ? 'Đang kết nối…' : 'Kết nối'}</button>
          </>
        )}
        {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
        {msg && <p className="success" style={{ margin: 0 }}>{msg}</p>}
      </div>
    </>
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
      <ul className="list">
        <li><a className="list-item" href="#/customers"><strong className="grow">Khách hàng</strong><span aria-hidden="true">›</span></a></li>
        <li><a className="list-item" href="#/users"><span className="grow"><strong>Người dùng</strong><span className="small muted" style={{ display: 'block' }}>Tài khoản khách tự đăng ký: khóa, mở khóa, link đặt lại mật khẩu</span></span><span aria-hidden="true">›</span></a></li>
        <li><a className="list-item" href="#/content"><span className="grow"><strong>Trang web</strong><span className="small muted" style={{ display: 'block' }}>Sản phẩm, bộ sưu tập, poster, liên hệ</span></span><span aria-hidden="true">›</span></a></li>
      </ul>

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
          <p className="small muted" style={{ marginTop: -4 }}>Các dòng size để chọn khi nhập đơn và khi khách đặt hàng. Tên tiếng Anh và Khmer hiện cho khách nước ngoài.</p>
          {s.lines.map((l, i) => (
            <div key={l.key} className="card line-setting">
              <div className="row">
                <strong className="grow">{l.label.vi || `Dòng ${i + 1}`}</strong>
                <span className="small muted">Size</span>
                <input aria-label={`Size từ – ${l.label.vi}`} inputMode="numeric" className="num size-box" value={String(l.sizeFrom)} onChange={(e) => setLine(i, { ...l, sizeFrom: parseInt(e.target.value, 10) || 0 })} />
                <span className="small muted">đến</span>
                <input aria-label={`Size đến – ${l.label.vi}`} inputMode="numeric" className="num size-box" value={String(l.sizeTo)} onChange={(e) => setLine(i, { ...l, sizeTo: parseInt(e.target.value, 10) || 0 })} />
              </div>
              {(['vi', 'en', 'km'] as Lang[]).map((lang) => (
                <div key={lang} className="names3-row">
                  <span className="lang-tag" aria-hidden="true">{lang.toUpperCase()}</span>
                  <input lang={lang} aria-label={lang === 'vi' ? `Tên dòng ${i + 1}` : `Tên ${lang === 'en' ? 'tiếng Anh' : 'tiếng Khmer'} – ${l.label.vi}`}
                    placeholder={lang === 'vi' ? 'Tên dòng, ví dụ Nam' : 'trống = dùng tiếng Việt'} value={l.label[lang]}
                    onChange={(e) => setLine(i, { ...l, label: { ...l.label, [lang]: e.target.value } })} />
                </div>
              ))}
            </div>
          ))}
          <button type="button" className="btn-sm" onClick={() => setS({ ...s, lines: [...s.lines, { key: `dong_${Date.now().toString(36)}`, label: { vi: 'Dòng mới', en: '', km: '' }, sizeFrom: 35, sizeTo: 40 }] })}>+ Thêm dòng size</button>

          <h2>Đơn sỉ tối thiểu</h2>
          <div className="card stack">
            <label htmlFor="min-pairs">Số đôi tối thiểu mỗi đơn khách tự đặt</label>
            <input id="min-pairs" inputMode="numeric" className="num" style={{ maxWidth: 160 }} value={String(s.minOrderPairs ?? 10)}
              onChange={(e) => { setMsg(''); setS({ ...s, minOrderPairs: parseInt(e.target.value.replace(/\D/g, '') || '0', 10) }); }} />
            <p className="small muted" style={{ margin: 0 }}>Khách đặt ít hơn số này thì không gửi đơn được (web báo cần thêm bao nhiêu đôi). Đơn anh tự nhập không bị giới hạn. Để 0 nếu muốn nhận mọi đơn.</p>
          </div>

          <h2>Tin nhắn gửi báo giá</h2>
          <p className="small muted" style={{ marginTop: -4 }}>Đoạn tin nhắn có sẵn khi anh bấm "Gửi báo giá", để chép gửi khách qua Zalo. Máy tự điền:</p>
          <div className="row wrap token-help">
            <span><code>{'{code}'}</code> mã đơn</span><span><code>{'{total}'}</code> tổng tiền</span><span><code>{'{url}'}</code> link báo giá (bắt buộc)</span>
          </div>
          <div className="card stack">
            {LANGS.map((lang) => (
              <div key={lang}>
                <label htmlFor={`qm-${lang}`} className="row" style={{ gap: 8 }}><span className="lang-tag lang-tag-sm" aria-hidden="true">{lang.toUpperCase()}</span>{LANG_NAME[lang]}</label>
                <textarea id={`qm-${lang}`} lang={lang} aria-label={`Tin nhắn báo giá – ${LANG_NAME[lang]}`} value={s.quoteMessage[lang]}
                  onChange={(e) => { setMsg(''); setS({ ...s, quoteMessage: { ...s.quoteMessage, [lang]: e.target.value } }); }} />
              </div>
            ))}
          </div>
          {error && <p className="error">{error}</p>}
          <button type="button" className="btn-primary btn-block" style={{ marginTop: 12 }} onClick={saveSettings}>Lưu cài đặt</button>
          {msg && <p className="success">{msg}</p>}
        </>
      )}

      <TelegramCard />

      <h2>Dữ liệu</h2>
      <a className="btn btn-block" href="/api/export" download>Tải bản sao lưu</a>
      <p className="small muted">File JSON chứa toàn bộ khách, đơn, báo giá, thư viện. Nên tải mỗi tuần và cất vào Google Drive.</p>
      <button type="button" className="btn-block btn-danger" style={{ marginTop: 16 }} onClick={logout}>Đăng xuất</button>
    </main>
  );
}
