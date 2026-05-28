import type { ReactNode } from "react";

interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function AdminPageHeader({ title, subtitle, icon, actions }: AdminPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-6 border-b border-zinc-800 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="shrink-0 text-red-500">{icon}</div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-tighter text-white truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-zinc-500 font-mono mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}
