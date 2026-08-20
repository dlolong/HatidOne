'use client';

import { useFormStatus } from 'react-dom';

type SubmitButtonProps = {
  children: string;
  disabled?: boolean;
  pendingLabel: string;
};

export function SubmitButton({ children, disabled = false, pendingLabel }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button className="button button-primary" disabled={pending || disabled} type="submit">
      {pending ? pendingLabel : children}
    </button>
  );
}
