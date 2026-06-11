import { useEffect, useRef, type ReactNode } from 'react';
import type { CardDef } from '../domain/cards';

export function SectionPanel(props: {
  label: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <h2 className="panel-label">
        {props.label}
        {props.extra != null && <span className="label-extra">{props.extra}</span>}
      </h2>
      {props.children}
    </section>
  );
}

export function Chip(props: {
  label: string;
  color?: string;
  selected?: boolean;
  disabled?: boolean;
  eliminated?: boolean;
  onClick?: () => void;
  sub?: string;
}) {
  return (
    <button
      type="button"
      className={
        'chip' +
        (props.selected ? ' selected' : '') +
        (props.eliminated ? ' eliminated' : '')
      }
      disabled={props.disabled}
      onClick={props.onClick}
      aria-pressed={props.selected}
    >
      {props.color && <span className="dot" style={{ background: props.color }} />}
      <span>
        {props.label}
        {props.sub ? <span className="fine"> · {props.sub}</span> : null}
      </span>
    </button>
  );
}

export function CardTile(props: {
  card: CardDef;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  sub?: string;
}) {
  return (
    <button
      type="button"
      className={`tile tile-${props.card.category}` + (props.selected ? ' selected' : '')}
      disabled={props.disabled}
      onClick={props.onClick}
      aria-pressed={props.selected}
    >
      <span>{props.card.name}</span>
      {props.sub ? <span className="tile-sub">{props.sub}</span> : null}
    </button>
  );
}

export function Stepper(props: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  const min = props.min ?? 0;
  const max = props.max ?? 18;
  return (
    <span className="stepper" role="group" aria-label={props.label}>
      <button
        type="button"
        className="icon-btn"
        aria-label={`Decrease ${props.label}`}
        disabled={props.value <= min}
        onClick={() => props.onChange(props.value - 1)}
      >
        −
      </button>
      <span className="stepper-val" aria-live="polite">
        {props.value}
      </span>
      <button
        type="button"
        className="icon-btn"
        aria-label={`Increase ${props.label}`}
        disabled={props.value >= max}
        onClick={() => props.onChange(props.value + 1)}
      >
        +
      </button>
    </span>
  );
}

export function pct(v: number): string {
  if (v > 0 && v < 0.01) return '<1%';
  if (v > 0.99 && v < 1) return '>99%';
  return `${Math.round(v * 100)}%`;
}

export function ProbBar(props: { label: string; value: number; faded?: boolean }) {
  return (
    <div className={'probrow' + (props.faded ? ' faded' : '')}>
      <span className="prob-name">{props.label}</span>
      <span className="prob-track" aria-hidden="true">
        <span className="prob-fill" style={{ width: `${Math.max(0, props.value) * 100}%` }} />
      </span>
      <span className="prob-pct">{pct(props.value)}</span>
    </div>
  );
}

export function Stamp(props: { children: ReactNode; animate?: boolean; small?: boolean }) {
  return (
    <span
      className={
        'stamp' + (props.animate ? ' stamp-animate' : '') + (props.small ? ' stamp-small' : '')
      }
    >
      {props.children}
    </span>
  );
}

export function Sheet(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!props.open) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.open, props.onClose]);

  if (!props.open) return null;
  return (
    <>
      <div className="scrim" onClick={props.onClose} aria-hidden="true" />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="sheet-head">
          <span className="sheet-title">{props.title}</span>
          <button type="button" className="sheet-close" onClick={props.onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {props.children}
      </div>
    </>
  );
}

export function Confirm(props: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={props.open} title={props.title} onClose={props.onClose}>
      <p className="hint" style={{ fontSize: 14.5 }}>
        {props.body}
      </p>
      <div className="sheet-actions">
        <button type="button" className="btn" onClick={props.onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={'btn ' + (props.danger ? 'btn-danger' : 'btn-primary')}
          onClick={() => {
            props.onConfirm();
            props.onClose();
          }}
        >
          {props.confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

export function Crumbs(props: {
  items: { label: string; state: 'done' | 'active' | 'todo'; onClick?: () => void }[];
}) {
  return (
    <div className="crumbs">
      {props.items.map((c, i) => (
        <button
          key={i}
          type="button"
          className={
            'crumb' +
            (c.state === 'done' ? ' crumb-done' : '') +
            (c.state === 'active' ? ' crumb-active' : '')
          }
          onClick={c.onClick}
          disabled={!c.onClick}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
