import Link from 'next/link';
import type { ReactNode } from 'react';
import { SubmitButton } from './submit-button';

type AuthFormProps = {
  title: string;
  description: string;
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  submitLabel: string;
  pendingLabel: string;
  alternateText: string;
  alternateHref: string;
  alternateLabel: string;
  error?: string;
  message?: string;
  submitDisabled?: boolean;
  afterForm?: ReactNode;
};

export function AuthForm(props: AuthFormProps) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="brand" href="/">HatidOne</Link>
        <h1>{props.title}</h1>
        <p className="muted">{props.description}</p>
        {props.error ? <p className="notice notice-error" role="alert" id="auth-error">{props.error}</p> : null}
        {props.message ? <p className="notice notice-success" role="status">{props.message}</p> : null}
        <form action={props.action} className="form-stack" aria-describedby={props.error ? "auth-error" : undefined}>
          {props.children}
          <SubmitButton disabled={props.submitDisabled} pendingLabel={props.pendingLabel}>{props.submitLabel}</SubmitButton>
        </form>
        {props.afterForm}
        <p className="auth-alternate">
          {props.alternateText} <Link href={props.alternateHref}>{props.alternateLabel}</Link>
        </p>
        <div className="auth-role-links"><p>Want to drive with HatidOne? <Link href="/signup?intent=driver">Apply to drive</Link></p><details><summary>Arranging business rides?</summary><Link href="/organizations">Fleet, hotel or corporate accounts</Link></details></div>
      </section>
    </main>
  );
}
