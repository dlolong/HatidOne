'use client';
import { useId, useState } from 'react';
export function PasswordField({ autoComplete, minLength, describedBy, invalid = false }: { autoComplete: 'new-password' | 'current-password'; minLength?: number; describedBy?: string; invalid?: boolean }) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return <div className="password-field"><label htmlFor={id}>Password</label><div className="password-control">
    <input id={id} name="password" type={visible ? 'text' : 'password'} required autoComplete={autoComplete} minLength={minLength} aria-describedby={describedBy} aria-invalid={invalid} />
    <button type="button" aria-controls={id} aria-pressed={visible} aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(value => !value)}>{visible ? 'Hide' : 'Show'}</button>
  </div></div>;
}
