import Image from "next/image";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <Image src="/brand/vizantu-dark.svg" width={1518} height={296} alt="Vizantu" className="auth-logo" priority />
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
