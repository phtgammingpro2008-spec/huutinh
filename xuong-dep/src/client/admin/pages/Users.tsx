import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { viDate } from '../components/OrderRow';

type UserRow = {
  id: string; name: string; phone: string; email: string; emailVerified: boolean; locked: boolean;
  createdAt: string; customerId: string; orderCount: number;
};

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

function Row({ u, onChange }: { u: UserRow; onChange: (u: UserRow) => void }) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  async function run(fn: () => Promise<void>) {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e instanceof ApiError ? e.message : 'Có lỗi, vui lòng thử lại'); } finally { setBusy(false); }
  }
  const lock = (locked: boolean) => run(async () => {
    if (locked && !window.confirm(`Khóa tài khoản ${u.name}? Khách sẽ bị đăng xuất ngay và không đăng nhập được.`)) return;
    await api('POST', `/api/users/${u.id}/${locked ? 'lock' : 'unlock'}`);
    onChange({ ...u, locked });
  });
  const reset = () => run(async () => {
    setCopied(false);
    setLink((await api<{ url: string }>('POST', `/api/users/${u.id}/reset-link`)).url);
  });
  return (
    <li className="card user-row">
      <div className="row wrap">
        <strong className="grow">{u.name}</strong>
        {u.locked && <span className="badge s-da_huy">Đã khóa</span>}
        <span className={`badge ${u.emailVerified ? 's-khach_dong_y' : 's-cho_bao_gia'}`}>{u.emailVerified ? 'Email đã xác nhận' : 'Email chưa xác nhận'}</span>
      </div>
      <div className="small num">{u.phone} · {u.email}</div>
      <div className="small muted">Đăng ký {viDate(u.createdAt)} · {u.orderCount} đơn</div>
      <div className="row wrap" style={{ marginTop: 8 }}>
        <a className="btn btn-sm" href={`#/customers/${u.customerId}`}>Hồ sơ và đơn</a>
        {u.locked
          ? <button type="button" className="btn-sm" disabled={busy} onClick={() => lock(false)}>Mở khóa</button>
          : <button type="button" className="btn-sm btn-danger" disabled={busy} onClick={() => lock(true)}>Khóa</button>}
        <button type="button" className="btn-sm" disabled={busy || u.locked} onClick={reset}>Tạo link đặt lại mật khẩu</button>
      </div>
      {link && (
        <div className="stack" style={{ marginTop: 8 }}>
          <input readOnly aria-label="Link đặt lại mật khẩu" value={link} onFocus={(e) => e.currentTarget.select()} />
          <p className="small muted" style={{ margin: 0 }}>Gửi link này cho khách qua Zalo. Link dùng được một lần, hết hạn sau 24 giờ.</p>
          <button type="button" className="btn-sm" onClick={async () => setCopied(await copy(link))}>{copied ? 'Đã chép' : 'Chép link'}</button>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </li>
  );
}

type Staff = { id: string; name: string; locked: boolean; createdAt: string };

/** Manager accounts (owner only): create, set a new password, lock. Managers do the daily work but not the owner's settings. */
function StaffSection() {
  const [list, setList] = useState<Staff[] | null>(null);
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const load = () => api<Staff[]>('GET', '/api/staff').then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(''); setMsg('');
    try { await fn(); } catch (e) { setError(e instanceof ApiError ? e.message : 'Có lỗi, vui lòng thử lại'); } finally { setBusy(false); }
  }
  const create = () => run(async () => {
    const s = await api<Staff>('POST', '/api/staff', { name, password: pw });
    setName(''); setPw(''); setMsg(`Đã tạo tài khoản ${s.name}. Đăng nhập bằng tên "${s.name}" và mật khẩu anh vừa đặt.`); load();
  });
  const newPw = (s: Staff) => run(async () => {
    const p = window.prompt(`Mật khẩu mới cho ${s.name} (ít nhất 8 ký tự):`);
    if (!p) return;
    await api('POST', `/api/staff/${s.id}/password`, { password: p });
    setMsg(`Đã đổi mật khẩu cho ${s.name}. Tài khoản này bị đăng xuất khỏi mọi máy.`);
  });
  const lock = (s: Staff, locked: boolean) => run(async () => {
    if (locked && !window.confirm(`Khóa tài khoản ${s.name}? Người này bị đăng xuất ngay và không đăng nhập được.`)) return;
    await api('POST', `/api/staff/${s.id}/${locked ? 'lock' : 'unlock'}`); load();
  });
  return (
    <section className="stack" aria-label="Tài khoản quản lý" style={{ marginBottom: 24 }}>
      <h2 style={{ margin: 0 }}>Tài khoản quản lý</h2>
      <p className="small muted" style={{ margin: 0 }}>Quản lý làm được đơn hàng, báo giá, khách hàng, thư viện, vật liệu và đăng mẫu lên web. Không sửa được cài đặt chung, Telegram, liên hệ, tài khoản và không tải sao lưu.</p>
      {list && list.length > 0 && (
        <ul className="list">
          {list.map((s) => (
            <li key={s.id} className="card user-row">
              <div className="row wrap"><strong className="grow">{s.name}</strong>{s.locked && <span className="badge s-da_huy">Đã khóa</span>}<span className="badge">Quản lý</span></div>
              <div className="small muted">Tạo {viDate(s.createdAt)}</div>
              <div className="row wrap" style={{ marginTop: 8 }}>
                <button type="button" className="btn-sm" disabled={busy} onClick={() => newPw(s)}>Đổi mật khẩu</button>
                {s.locked
                  ? <button type="button" className="btn-sm" disabled={busy} onClick={() => lock(s, false)}>Mở khóa</button>
                  : <button type="button" className="btn-sm btn-danger" disabled={busy} onClick={() => lock(s, true)}>Khóa</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="card stack">
        <strong>Thêm tài khoản quản lý</strong>
        <div><label htmlFor="staff-name">Tên đăng nhập</label>
          <input id="staff-name" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="ví dụ hao" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label htmlFor="staff-pw">Mật khẩu (ít nhất 8 ký tự)</label>
          <input id="staff-pw" type="text" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <button type="button" className="btn-primary" disabled={busy || !name.trim() || pw.length < 8} onClick={create}>Tạo tài khoản quản lý</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {msg && <p className="success" role="status">{msg}</p>}
    </section>
  );
}

/** Customer accounts: search, lock/unlock, password reset links. */
export function Users() {
  const [q, setQ] = useState('');
  const [list, setList] = useState<UserRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const id = setTimeout(() => {
      api<UserRow[]>('GET', `/api/users?q=${encodeURIComponent(q.trim())}`).then(setList).catch((e) => setError(e.message));
    }, 200);
    return () => clearTimeout(id);
  }, [q]);
  return (
    <main className="page">
      <div className="topbar"><h1>Người dùng</h1><a className="btn btn-sm" href="#/settings">Cài đặt</a></div>
      <StaffSection />
      <h2>Tài khoản khách</h2>
      <p className="muted small" style={{ marginTop: -6 }}>Tài khoản khách tự đăng ký trên trang web.</p>
      <input type="search" aria-label="Tìm người dùng" placeholder="Tìm theo tên, số điện thoại, email" value={q} onChange={(e) => setQ(e.target.value)} />
      {error && <p className="error">{error}</p>}
      {!list && !error && <div className="skeleton" style={{ height: 120, marginTop: 12 }} />}
      {list && list.length === 0 && <p className="muted">Chưa có tài khoản nào{q ? ' khớp tìm kiếm' : ''}.</p>}
      {list && list.length > 0 && (
        <ul className="list" style={{ marginTop: 12 }}>
          {list.map((u) => <Row key={u.id} u={u} onChange={(n) => setList((xs) => xs!.map((x) => (x.id === n.id ? n : x)))} />)}
        </ul>
      )}
    </main>
  );
}
