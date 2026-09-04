"use client";

// Primitivas do Design System Vizantu.
//
// Toda peça daqui é uma casca fina sobre as classes vz-* de vizantu.css. O
// componente existe pra travar a API (variant/size/tone) — a aparência mora
// no CSS, que é o que a migração do app inteiro vai reaproveitar.

import * as React from "react";

export type Tone = "violet" | "green" | "amber" | "red" | "blue" | "pink" | "teal" | "slate";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Ações ---------- */

export function Button({
  variant = "secondary",
  size = "md",
  pill,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "success" | "success-soft" | "secondary" | "soft" | "ghost" | "danger" | "contrast";
  size?: "sm" | "md" | "lg";
  pill?: boolean;
}) {
  return (
    <button
      className={cx("vz-btn", `vz-btn--${variant}`, size !== "md" && `vz-btn--${size}`, pill && "vz-btn--pill", className)}
      {...props}
    />
  );
}

export function IconButton({
  size = "md",
  bare,
  round,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "sm" | "md" | "lg";
  bare?: boolean;
  round?: boolean;
}) {
  return (
    <button
      className={cx("vz-icon-btn", size !== "md" && `vz-icon-btn--${size}`, bare && "vz-icon-btn--bare", round && "vz-icon-btn--round", className)}
      {...props}
    />
  );
}

/* ---------- Sinalização ---------- */

export function Tag({
  tone,
  solid,
  outline,
  size = "md",
  icon,
  children,
  className,
}: {
  tone?: Tone;
  solid?: boolean;
  outline?: boolean;
  size?: "md" | "lg";
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cx("vz-tag", tone && `vz-tag--${tone}`, solid && "vz-tag--solid", outline && "vz-tag--outline", size === "lg" && "vz-tag--lg", className)}>
      {icon}
      <span>{children}</span>
    </span>
  );
}

export function Dot({ tone }: { tone?: Tone }) {
  return <i className={cx("vz-dot", tone && `vz-dot--${tone}`)} />;
}

export function Count({ children, variant }: { children: React.ReactNode; variant?: "brand" | "danger" }) {
  return <span className={cx("vz-count", variant && `vz-count--${variant}`)}>{children}</span>;
}

export function Delta({ direction = "up", children }: { direction?: "up" | "down" | "flat"; children: React.ReactNode }) {
  return <span className={cx("vz-delta", direction !== "up" && `vz-delta--${direction}`)}>{children}</span>;
}

// O avatar é a FOTO do membro. A inicial é o fallback de quem ainda não subiu
// foto — e é só isso: um fallback. Iniciais como identidade principal quebram
// em nome composto, em nome de uma palavra só e em qualquer tamanho pequeno.
export function Avatar({
  name,
  src,
  size = "md",
  square,
  presence,
}: {
  name: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  square?: boolean;
  presence?: "on" | "away" | "off";
}) {
  const palavras = name.trim().split(/\s+/).filter(Boolean);
  const initials = (palavras.length > 1 ? palavras[0][0] + palavras[palavras.length - 1][0] : palavras[0]?.slice(0, 2) ?? "?");
  const slot = (name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6) + 1;
  const avatar = (
    <span
      className={cx("vz-avatar", !src && `vz-avatar--c${slot}`, size !== "md" && `vz-avatar--${size}`, square && "vz-avatar--square")}
      title={name}
    >
      {src ? <img src={src} alt={name} /> : <span>{initials}</span>}
    </span>
  );
  if (!presence) return avatar;
  return (
    <span className="vz-avatar-wrap">
      {avatar}
      <i className={cx("vz-presence", presence !== "on" && `vz-presence--${presence}`)} />
    </span>
  );
}

export function AvatarStack({
  people,
  max = 3,
  size = "sm",
}: {
  people: { name: string; src?: string | null }[];
  max?: number;
  size?: "xs" | "sm" | "md";
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="vz-avatar-stack">
      {shown.map((person) => <Avatar key={person.name} name={person.name} src={person.src} size={size} />)}
      {rest > 0 && <span className={cx("vz-avatar", "vz-avatar--more", `vz-avatar--${size}`)}><span>+{rest}</span></span>}
    </span>
  );
}

export function Progress({
  value,
  total,
  label,
  tone,
  thin,
}: {
  value: number;
  total?: number;
  label?: string;
  tone?: "green" | "amber" | "red";
  thin?: boolean;
}) {
  const pct = total ? Math.round((value / total) * 100) : value;
  return (
    <div className={cx("vz-progress", tone && `vz-progress--${tone}`, thin && "vz-progress--thin")}>
      {(label || total) && (
        <div className="vz-progress__head">
          <span>{label ?? "Progresso"}</span>
          <b>{total ? `${value}/${total}` : `${pct}%`}</b>
        </div>
      )}
      <div className="vz-progress__track">
        <div className="vz-progress__fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
    </div>
  );
}

// Anel de progresso. O traço é desenhado com stroke-dasharray sobre um círculo
// girado -90°, então 0% começa no topo e não às 3 horas.
export function ProgressRing({ value, size = 116, label }: { value: number; size?: number; label?: React.ReactNode }) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <span className="vz-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--vz-bg-sunken)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="var(--vz-brand)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(1, Math.max(0, value / 100)))}
        />
      </svg>
      <span className="vz-ring__label">{label ?? <><b>{value}%</b></>}</span>
    </span>
  );
}

/* ---------- Campos ---------- */

export function Field({ label, hint, error, children }: { label?: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="vz-field">
      {label && <span className="vz-label">{label}</span>}
      {children}
      {(error || hint) && <span className={cx("vz-hint", error && "vz-hint--error")}>{error ?? hint}</span>}
    </label>
  );
}

export function Input({ size = "md", className, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: "sm" | "md" | "lg" }) {
  return <input className={cx("vz-input", size !== "md" && `vz-input--${size}`, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("vz-textarea", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx("vz-select", className)} {...props} />;
}

export function SearchInput({
  shortcut = "⌘K",
  size = "md",
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & { shortcut?: string | null; size?: "sm" | "md" | "lg" }) {
  const miudo = size === "sm";
  return (
    <div className={cx("vz-input-group", miudo && "vz-input-group--sm")}>
      <span className="vz-input-group__icon">
        <svg width={miudo ? 13 : 15} height={miudo ? 13 : 15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </span>
      <input className={cx("vz-input", size !== "md" && `vz-input--${size}`)} {...props} />
      {shortcut && <span className="vz-input-group__end"><kbd className="vz-kbd">{shortcut}</kbd></span>}
    </div>
  );
}

export function Check({ label, type = "checkbox", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="vz-check">
      <input type={type} {...props} />
      {label}
    </label>
  );
}

export function Switch({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="vz-switch">
      <input type="checkbox" {...props} />
      {label}
    </label>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className={cx("vz-segmented", size === "sm" && "vz-segmented--sm")}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Superfícies ---------- */

export function Card({ className, tint, flat, interactive, ...props }: React.HTMLAttributes<HTMLDivElement> & { tint?: boolean; flat?: boolean; interactive?: boolean }) {
  return <div className={cx("vz-card", tint && "vz-card--tint", flat && "vz-card--flat", interactive && "vz-card--interactive", className)} {...props} />;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("vz-page-head", className)}>
      <div className="vz-page-head__copy">
        {eyebrow && <span className="vz-eyebrow">{eyebrow}</span>}
        <h1 className="vz-h1">{title}</h1>
        {description && <p className="vz-body">{description}</p>}
      </div>
      {actions && <div className="vz-page-head__actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, description, actions, className }: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("vz-empty", className)}>
      {icon && <span className="vz-empty__icon">{icon}</span>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {actions}
    </div>
  );
}

export function Toolbar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("vz-toolbar", className)} {...props} />;
}

export function Callout({ tone = "info", icon, children }: { tone?: "info" | "success" | "warning" | "danger" | "brand"; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={cx("vz-callout", tone !== "info" && `vz-callout--${tone}`)}>
      {icon}
      <div>{children}</div>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="vz-tabs" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.value} role="tab" aria-selected={value === tab.value} onClick={() => onChange(tab.value)}>
          {tab.label}
          {tab.count !== undefined && <span className="vz-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
