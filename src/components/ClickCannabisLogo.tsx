import React from 'react';

interface ClickCannabisLogoProps {
  compact?: boolean;
  onDark?: boolean;
  subtitle?: string;
  className?: string;
}

export function ClickCannabisLogo({
  compact = false,
  onDark = false,
  subtitle,
  className = '',
}: ClickCannabisLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 min-w-0 ${className}`}>
      <img
        src="/assets/aistudio/image_0531d91f.png"
        alt="Logo ClickCannabis"
        className="h-9 w-9 rounded-xl object-cover shrink-0 border border-[rgba(255,255,255,0.14)]"
      />

      {!compact && (
        <div className="min-w-0 leading-tight">
          <div className="flex items-baseline gap-0.5 font-display font-bold text-[15px] tracking-tight whitespace-nowrap">
            <span className={onDark ? 'text-[#ffffff]' : 'text-[var(--ink)]'}>
              Click
            </span>
            <span className={onDark ? 'text-[#8fe89c]' : 'text-[var(--accent)]'}>
              Cannabis
            </span>
          </div>
          {subtitle && (
            <p
              className={`text-[11px] truncate ${
                onDark ? 'text-[var(--nav-muted)]' : 'text-[var(--muted)]'
              }`}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
