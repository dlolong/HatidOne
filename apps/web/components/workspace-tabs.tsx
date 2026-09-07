'use client';
import { useEffect, useId, useState, type ReactNode, type KeyboardEvent } from 'react';

export function WorkspaceTabs({ sections, label = 'Workspace sections' }: { sections: { id: string; label: string; content: ReactNode }[]; label?: string }) {
  const [active, setActive] = useState(sections[0]?.id);
  const prefix = useId();
  useEffect(() => {
    function selectHash() {
      let requested = window.location.hash.slice(1);
      if (!requested) { try { requested = sessionStorage.getItem(`hatidone-section:${window.location.pathname}`) ?? ''; } catch { /* Browser storage can be disabled. */ } }
      if (sections.some(section => section.id === requested)) setActive(requested);
    }
    selectHash();
    window.addEventListener('hashchange', selectHash);
    return () => window.removeEventListener('hashchange', selectHash);
  }, [sections]);
  function select(id: string) { setActive(id); try { sessionStorage.setItem(`hatidone-section:${window.location.pathname}`, id); } catch { /* Selection still works without browser storage. */ } window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${id}`); }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | undefined;
    if (event.key === 'ArrowRight') next = (index + 1) % sections.length;
    if (event.key === 'ArrowLeft') next = (index + sections.length - 1) % sections.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = sections.length - 1;
    if (next === undefined) return;
    event.preventDefault(); select(sections[next].id); document.getElementById(`${prefix}-tab-${next}`)?.focus();
  }
  return <div className="workspace-tabs dashboard-wide">
    <div className="section-tabs" role="tablist" aria-label={label}>{sections.map((section, index) => <button type="button" role="tab" key={section.id}
      id={`${prefix}-tab-${index}`} aria-controls={`${prefix}-panel-${index}`} aria-selected={active === section.id} tabIndex={active === section.id ? 0 : -1}
      onKeyDown={event => navigate(event, index)} onClick={() => select(section.id)}>{section.label}</button>)}</div>
    {sections.map((section, index) => <div key={section.id} role="tabpanel" id={`${prefix}-panel-${index}`} aria-labelledby={`${prefix}-tab-${index}`}
      hidden={active !== section.id} tabIndex={0} className="workspace-panel">{section.content}</div>)}
  </div>;
}
