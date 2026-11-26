import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api';

export type Me = { id: string; name: string; role?: 'admin' | 'staff' | 'worker' | 'customer' };

export function Login({ needsSetup, onDone }: { needsSetup: boolean; onDone: (me: Me) => void }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const me = await api<Me>('POST', needsSetup ? '/api/setup' : '/api/login', { name, password });
      onDone(me);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Có lỗi, vui lòng thử lại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <img className="logo" src="/icons/icon-192.png" alt="" />
      <h1>{needsSetup ? 'Tạo tài khoản quản trị' : 'Xưởng dép'}</h1>
      <p className="muted">{needsSetup ? 'Lần đầu dùng: tạo tài khoản để đăng nhập trên điện thoại.' : 'Đăng nhập để quản lý đơn hàng.'}</p>
      <form onSubmit={submit} className="stack" style={{ marginTop: 20 }}>
        <div>
          <label htmlFor="login-name">Tên đăng nhập</label>
          <input id="login-name" autoComplete="username" autoCapitalize="none" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="login-pw">Mật khẩu</label>
          <input id="login-pw" type="password" autoComplete={needsSetup ? 'new-password' : 'current-password'}
            value={password} onChange={(e) => setPassword(e.target.value)} required minLength={needsSetup ? 8 : undefined} />
          {needsSetup && <p className="muted small">Ít nhất 8 ký tự.</p>}
        </div>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn-primary btn-block btn-lg" type="submit" disabled={busy}>
          {needsSetup ? 'Tạo tài khoản' : 'Đăng nhập'}
        </button>
      </form>
    </main>
  );
}
