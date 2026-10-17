import React from 'react';

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'glass-panel rounded-2xl text-zinc-100 flex flex-col justify-between transition-all duration-200',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'px-5 pt-4 pb-3.5 border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-2.5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        'text-[13px] font-semibold tracking-tight text-zinc-100 flex items-center gap-2',
        className
      )}
      {...props}
    >
      {children}
    </h2>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-[11px] text-zinc-400 font-normal', className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-5 flex-1 flex flex-col gap-3.5', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'px-5 py-3 border-t border-white/[0.07] bg-white/[0.015] rounded-b-2xl flex flex-wrap items-center justify-between gap-2',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type BadgeVariant =
  | 'metallic'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'cyan'
  | 'outline';

export function Badge({
  variant = 'metallic',
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  const styles: Record<BadgeVariant, string> = {
    metallic:
      'metal-badge text-zinc-200',
    emerald:
      'bg-emerald-500/12 text-emerald-300 border border-emerald-400/25 shadow-[inset_0_1px_0_0_rgba(52,211,153,0.18)]',
    amber:
      'bg-amber-500/12 text-amber-300 border border-amber-400/25 shadow-[inset_0_1px_0_0_rgba(251,191,36,0.18)]',
    rose:
      'bg-rose-500/12 text-rose-300 border border-rose-400/25 shadow-[inset_0_1px_0_0_rgba(251,113,133,0.18)]',
    cyan:
      'bg-sky-500/12 text-sky-300 border border-sky-400/25 shadow-[inset_0_1px_0_0_rgba(56,189,248,0.18)]',
    outline:
      'bg-white/[0.02] text-zinc-300 border border-white/[0.09]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-medium tracking-tight backdrop-blur-md',
        styles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function Separator({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      className={cn('h-px w-full bg-white/[0.07]', className)}
    />
  );
}

export function TabsList({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-950/75 border border-white/[0.08] backdrop-blur-xl shadow-inner',
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-1.5',
        active
          ? 'bg-gradient-to-b from-white/[0.15] to-white/[0.06] text-white border border-white/[0.16] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_2px_8px_rgba(0,0,0,0.4)]'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] border border-transparent',
        className
      )}
    >
      {children}
    </button>
  );
}
