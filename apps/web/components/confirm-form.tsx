'use client';
import type { ReactNode } from 'react';
export function ConfirmForm({ action, message, children }: {action:(form:FormData)=>void|Promise<void>;message:string;children:ReactNode}) {return <form action={action} onSubmit={event=>{if(!window.confirm(message))event.preventDefault();}}>{children}</form>;}
