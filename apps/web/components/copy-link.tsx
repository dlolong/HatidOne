'use client';
import { useState } from 'react';
export function CopyLink({ path }: { path: string }) {
  const [message, setMessage] = useState('');
  return <div><button className="button button-secondary" type="button" onClick={async () => { try { await navigator.clipboard.writeText(new URL(path, window.location.origin).href); setMessage('Booking link copied.'); } catch { setMessage('Copy the link shown below.'); } }}>Copy booking link</button><p className="muted" role="status">{message}</p><code className="wrap-anywhere">{path}</code><p className="muted">This URL can be encoded as a QR code. Booking access still requires sign-in.</p></div>;
}
