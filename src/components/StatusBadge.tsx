import React from 'react';

export type BadgeTone = 'ok' | 'warn' | 'bad' | 'info' | 'teal' | 'neutral';

const TONE_CLASSES: Record<BadgeTone, string> = {
  ok: 'bg-[#d2f0da] text-[#116437] dark:bg-[#194328] dark:text-[#6ee097]',
  warn: 'bg-[#fbecd2] text-[#8d5207] dark:bg-[#3a2a10] dark:text-[#f0b354]',
  bad: 'bg-[#f8dcd8] text-[#9b271e] dark:bg-[#3d1b18] dark:text-[#f4978e]',
  info: 'bg-[#dbe8fa] text-[#1a4f94] dark:bg-[#152a45] dark:text-[#86b8f5]',
  teal: 'bg-[#d3f0f2] text-[#0c6269] dark:bg-[#123a3d] dark:text-[#6bd7df]',
  neutral: 'bg-[var(--sunk)] text-[var(--muted)]',
};

export function StatusBadge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap shrink-0 ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function getConsultationTone(status: string): BadgeTone {
  switch (status) {
    case 'Confirmada':
    case 'Realizada':
      return 'ok';
    case 'Em andamento':
      return 'info';
    case 'Aguardando':
    case 'Reagendada':
      return 'warn';
    case 'Faltou':
    case 'Não realizada':
    case 'Cancelada':
      return 'bad';
    default:
      return 'neutral';
  }
}

export function getAtendTone(atend: string): BadgeTone {
  switch (atend) {
    case 'Resolvido':
      return 'ok';
    case 'Aberto':
      return 'bad';
    case 'Fechado':
      return 'info';
    case 'Aguardando':
      return 'warn';
    case 'Em Atendimento':
      return 'teal';
    default:
      return 'neutral';
  }
}
