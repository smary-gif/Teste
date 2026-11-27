import type { AtendStatus, AtendTabKey, PatientCase, ShortcutItem } from '../types';

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function nowTime(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function norm(s: string | null | undefined): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function normCmd(s: string | null | undefined): string {
  return norm(s).replace(/\s+/g, '');
}

export function cmdIs(value: string, cmd: string): boolean {
  return normCmd(value) === normCmd(cmd);
}

export function getTodayMeta() {
  const today = new Date();
  const y = today.getFullYear();
  const m = pad(today.getMonth() + 1);
  const d = pad(today.getDate());
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  return {
    today,
    todayKey: `${y}-${m}-${d}`,
    todayBr: `${d}-${m}-${y}`,
    todaySl: `${d}/${m}/${y}`,
    yestSl: `${pad(yest.getDate())}/${pad(yest.getMonth() + 1)}/${yest.getFullYear()}`,
  };
}

export function fmtTs(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function initials(name: string): string {
  return String(name || 'TR')
    .replace(/^Dra?\.\s*/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function deptKey(name: string): string {
  const s = norm(name);
  if (s === 'todos') return 'todos';
  if (s.includes('pos-venda') || s.includes('pos venda')) return s;
  if (s.includes('confirma')) return 'confirmacao';
  if (s.includes('andamento') || s.includes('aguardando') || s === 'consulta medica') return 'andamento';
  if (s.includes('medico') || s.startsWith('acompanhamento')) return 'medicos';
  if (s.includes('reagend')) return 'reagendamento';
  if (s.startsWith('agendamento')) return 'agendamento';
  if (s.includes('geral')) return 'geral';
  return s;
}

export function shortDept(dept: string): string {
  return String(dept).replace('Consulta Médica - ', '');
}

export const ATEND_LIST: Array<{ v: AtendStatus; tone: 'neutral' | 'ok' | 'bad' | 'info' | 'warn' | 'teal' }> = [
  { v: 'Aberto Pelo Clico', tone: 'neutral' },
  { v: 'Indefinido', tone: 'neutral' },
  { v: 'Resolvido', tone: 'ok' },
  { v: 'Aberto', tone: 'bad' },
  { v: 'Fechado', tone: 'info' },
  { v: 'Aguardando', tone: 'warn' },
  { v: 'Em Atendimento', tone: 'teal' },
];

export const ATEND_TAB: Record<AtendStatus, AtendTabKey> = {
  'Aberto Pelo Clico': 'abertos',
  Indefinido: 'abertos',
  Aberto: 'abertos',
  'Em Atendimento': 'abertos',
  Aguardando: 'aguardando',
  Resolvido: 'finalizados',
  Fechado: 'finalizados',
};

export function isConversationClosed(atend: AtendStatus): boolean {
  return atend === 'Resolvido' || atend === 'Fechado';
}

export function isOperatorClosingMessage(text: string, cmd: string | null): boolean {
  if (cmd === '/faltou') return true;
  const n = norm(text).trim();
  if (!n) return false;
  return (
    /\b(encerrando|encerrado|atendimento concluido|finalizando|finalizado|fico a disposicao|estamos a disposicao|qualquer duvida.{0,25}(chamar|disposicao|aqui)|tenha um (otimo|bom|excelente) (dia|atendimento|retorno)|excelente (dia|tarde|noite|semana)|otimo (dia|atendimento)|ate logo|ate mais)\b/i.test(
      n
    ) ||
    (!n.includes('?') &&
      /\b(bom dia|boa tarde|boa noite|tchau|obrigad[oa] pelo contato)\b/i.test(n) &&
      n.length > 18)
  );
}

export function isPatientClosingReply(
  replyText: string,
  isLastScriptedReply: boolean,
  operatorClosed: boolean
): boolean {
  if (operatorClosed) return true;
  const n = norm(replyText).trim();
  if (!n) return false;
  if (isLastScriptedReply && !n.includes('?')) return true;
  return (
    !n.includes('?') &&
    /\b(muito obrigad[oa]|obrigad[oa] pela ajuda|perfeito,?\s*obrigad[oa]|combinado,?\s*obrigad[oa]|certo,?\s*obrigad[oa]|tudo certo,?\s*obrigad[oa]|entendi,?\s*(muito )?obrigad[oa]|vou seguir assim|ate a consulta|ate logo|tchau)\b/i.test(
      n
    )
  );
}

export function fillTemplate(template: string, p: PatientCase): string {
  return String(template || '')
    .replaceAll('{$first_name}', p.first)
    .replaceAll('{first_name}', p.first)
    .replaceAll('{data}', p.data)
    .replaceAll('{hora}', p.hora)
    .replaceAll('{medico}', p.medico)
    .replaceAll('{link}', p.link)
    .replaceAll('{nome}', p.nome);
}

export function findShortcut(atalhos: ShortcutItem[], raw: string): ShortcutItem | undefined {
  return atalhos.find((a) => cmdIs(a.cmd, raw));
}

export function shuffleArray<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function stripHtmlCount(html: string): number {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return (tmp.textContent || '').trim().length;
}

export function sanitizeRichHtml(html: string): string {
  const tpl = document.createElement('template');
  tpl.innerHTML = html || '';
  const allowed = new Set(['B', 'I', 'U', 'UL', 'OL', 'LI', 'BR', 'DIV', 'P', 'STRONG', 'EM']);
  const walk = (node: ParentNode) => {
    Array.from(node.children).forEach((child) => {
      walk(child);
      if (allowed.has(child.tagName)) {
        Array.from(child.attributes).forEach((attr) => child.removeAttribute(attr.name));
      } else {
        child.replaceWith(...Array.from(child.childNodes));
      }
    });
  };
  walk(tpl.content);
  const out = document.createElement('div');
  out.appendChild(tpl.content);
  return out.innerHTML;
}

export function cloneData<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}
