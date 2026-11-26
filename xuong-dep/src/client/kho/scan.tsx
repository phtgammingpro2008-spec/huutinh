import jsQR from 'jsqr';
import { Camera, CameraOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { normalizeBagCode } from '../../shared/ri';
import { B, t2 } from './i18n';

declare const BarcodeDetector: undefined | (new (o: { formats: string[] }) => { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> });

let audio: AudioContext | null = null;
/** Short beep: high for a good scan, low for a refused one. */
export function beep(ok: boolean) {
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = ok ? 880 : 220;
    g.gain.value = 0.08;
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + (ok ? 0.08 : 0.25));
  } catch { /* no sound on this device */ }
}

/** Scan box: a USB scanner types the code and Enter into the always-focused field; hand typing works the same;
 * the camera button reads QR codes from the phone or webcam. The same code within 2 s is ignored. */
export function ScanBox({ onCode, busy }: { onCode: (code: string) => Promise<void> | void; busy?: boolean }) {
  const [text, setText] = useState('');
  const [cam, setCam] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const last = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  // scans are handled one after another: a fast scanner must not let an older answer overwrite a newer one
  const queue = useRef<Promise<void>>(Promise.resolve());
  const take = (raw: string) => { queue.current = queue.current.then(() => handle(raw)); return queue.current; };

  async function handle(raw: string) {
    const code = normalizeBagCode(raw);
    if (!code) { beep(false); setMsg({ ok: false, text: t2('wrong') }); return; }
    const now = Date.now();
    if (last.current.code === code && now - last.current.at < 2000) return;
    last.current = { code, at: now };
    try {
      await onCode(code);
      beep(true);
      setMsg({ ok: true, text: code });
    } catch (e) {
      beep(false);
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
    input.current?.focus();
  }

  useEffect(() => {
    if (!cam) return;
    let stop = false;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const detector = typeof BarcodeDetector !== 'undefined' ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        while (!stop) {
          let found: string | null = null;
          if (detector) {
            found = (await detector.detect(v).catch(() => []))[0]?.rawValue ?? null;
          } else if (v.videoWidth) {
            canvas.width = v.videoWidth; canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            found = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data ?? null;
          }
          if (found) await take(found);
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        setMsg({ ok: false, text: t2('noCamera') });
        setCam(false);
      }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam]);

  return (
    <div className="scanbox">
      <form className="scan-row" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { take(text); setText(''); } }}>
        <label htmlFor="scan-code" className="visually-hidden">{t2('code')}</label>
        <input id="scan-code" ref={input} autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={busy}
          placeholder="HLX-XXXXX-XXXXX" value={text} onChange={(e) => setText(e.target.value)} aria-label={t2('code')} />
        <button type="button" className="btn kho-cam-btn" onClick={() => setCam((c) => !c)} aria-pressed={cam}>
          {cam ? <CameraOff size={20} aria-hidden="true" /> : <Camera size={20} aria-hidden="true" />}<B k={cam ? 'cameraOff' : 'camera'} />
        </button>
      </form>
      {cam && <video ref={video} className="scan-video" playsInline muted />}
      {msg && <p className={`scan-msg ${msg.ok ? 'ok' : 'bad'}`} role="status">{msg.ok ? '✓ ' : '✕ '}{msg.text}</p>}
    </div>
  );
}
