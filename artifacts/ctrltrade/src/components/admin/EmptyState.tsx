import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  heading: string;
  subtext?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, heading, subtext, action }: EmptyStateProps) {
  return (
    <div className="py-16 flex flex-col items-center gap-3 text-center">
      {icon && (
        <div className="text-zinc-700 mb-1">{icon}</div>
      )}
      <p className="font-bold text-sm text-zinc-400">{heading}</p>
      {subtext && (
        <p className="text-xs text-zinc-600 font-mono max-w-xs">{subtext}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
