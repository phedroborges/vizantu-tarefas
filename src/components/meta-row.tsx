import type { ReactNode } from "react";

export function MetaRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="meta-row">
      <span className="meta-row-label">
        {icon}
        {label}
      </span>
      <div className="meta-row-value">{children}</div>
    </div>
  );
}
