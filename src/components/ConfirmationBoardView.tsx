import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  MessageCircle,
  MessageSquare,
  Phone,
  PhoneCall,
  Search,
  Send,
  User,
  X,
  XCircle,
} from 'lucide-react';
import type { ConsultationRow, PatientCase } from '../types';
import { getTodayMeta, norm, nowTime, pad } from '../utils/helpers';

export type ConfirmColumnKey =
  | 'aguardando_vespera'
  | 'template_vespera'
  | 'nao_confirmou_vespera'
  | 'nao_confirmou_7h'
  | 'nao_confirmou_2h'
  | 'sem_retorno';

interface ConfirmCardItem {
  id: string;
  patient: PatientCase;
  consultaNum: string;
  hora: string;
  dayLabel: string;
  countdownLabel: string;
  urgentCountdown: boolean;
  column: ConfirmColumnKey;
  reminderTag: string;
  anamneseRespondida: boolean;
  attempts: Array<{ id: string; text: string; time: string }>;
  resolvedStatus?: 'Confirmada' | 'Cancelada';
}

interface ConfirmationBoardViewProps {
  patients: PatientCase[];
  consultations: ConsultationRow[];
  onStartCall: (patient: PatientCase) => void;
  onOpenPatientChat: (patientId: string) => void;
  onOpenNegotiation: (patientId: string) => void;
  onForwardToChat: (patientId: string, text: string, label: string) => void;
  onUpdateConsultationStatus: (patientId: string, status: string) => void;
  onToast: (msg: string) => void;
}

const CONFIRM_COLUMNS: Array<{
  key: ConfirmColumnKey;
  title: string;
  headerBg: string;
  iconTone: string;
}> = [
  {
    key: 'aguardando_vespera',
    title: 'Aguardando véspera',
    headerBg: 'bg-[var(--surface)]',
    iconTone: 'text-[var(--muted)]',
  },
  {
    key: 'template_vespera',
    title: 'Template véspera enviado',
    headerBg: 'bg-[var(--surface)]',
    iconTone: 'text-emerald-600',
  },
  {
    key: 'nao_confirmou_vespera',
    title: 'Não confirmou véspera',
    headerBg: 'bg-[var(--surface)]',
    iconTone: 'text-amber-600',
  },
  {
    key: 'nao_confirmou_7h',
    title: 'Não confirmou 7h',
    headerBg: 'bg-[var(--surface)]',
    iconTone: 'text-amber-600',
  },
  {
    key: 'nao_confirmou_2h',
    title: 'Não confirmou 2h',
    headerBg: 'bg-amber-50/90 dark:bg-amber-950/35',
    iconTone: 'text-amber-600',
  },
  {
    key: 'sem_retorno',
    title: 'Sem retorno',
    headerBg: 'bg-rose-50/90 dark:bg-rose-950/35',
    iconTone: 'text-rose-600',
  },
];

function ColumnHeaderIcon({ colKey, className }: { colKey: ConfirmColumnKey; className: string }) {
  if (colKey === 'aguardando_vespera') return <Clock className={`h-4 w-4 ${className}`} />;
  if (colKey === 'template_vespera') return <Send className={`h-4 w-4 ${className}`} />;
  if (colKey === 'nao_confirmou_2h') return <PhoneCall className={`h-4 w-4 ${className}`} />;
  if (colKey === 'sem_retorno') return <XCircle className={`h-4 w-4 ${className}`} />;
  return <AlertCircle className={`h-4 w-4 ${className}`} />;
}

export function ConfirmationBoardView({
  patients,
  consultations,
  onStartCall,
  onOpenPatientChat,
  onOpenNegotiation,
  onForwardToChat,
  onUpdateConsultationStatus,
  onToast,
}: ConfirmationBoardViewProps) {
  const [search, setSearch] = useState('');
  const [bellOpen, setBellOpen] = useState(false);
  const [contatarMenuId, setContatarMenuId] = useState<string | null>(null);
  const [respostaMenuId, setRespostaMenuId] = useState<string | null>(null);
  const [expandedAttemptsId, setExpandedAttemptsId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [cards, setCards] = useState<ConfirmCardItem[]>(() => {
    const { today, todaySl } = getTodayMeta();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDayMonth = `${pad(tomorrow.getDate())}/${pad(tomorrow.getMonth() + 1)}`;
    const todayDayMonth = todaySl;

    const confPatients = patients.filter((p) => p.key === 'confirmacao' && !p.isMed);
    const colCycle: ConfirmColumnKey[] = [
      'nao_confirmou_7h',
      'nao_confirmou_2h',
      'sem_retorno',
      'aguardando_vespera',
      'nao_confirmou_vespera',
      'nao_confirmou_7h',
      'nao_confirmou_2h',
      'sem_retorno',
      'aguardando_vespera',
      'nao_confirmou_vespera',
    ];

    return confPatients.map((p, idx) => {
      const col = colCycle[idx % colCycle.length];
      const isTomorrow = col === 'aguardando_vespera' || col === 'template_vespera';
      const hora = p.hora || `${pad(9 + (idx % 9))}:${idx % 2 === 0 ? '00' : '40'}`;
      const countdown =
        col === 'sem_retorno'
          ? 'em 6 min'
          : col === 'nao_confirmou_2h'
            ? 'em 46 min'
            : col === 'nao_confirmou_7h'
              ? 'em 1h 6min'
              : col === 'nao_confirmou_vespera'
                ? 'em 2h 6min'
                : 'em 24h 6min';

      const initialAttempts =
        col === 'nao_confirmou_2h'
          ? [{ id: `att_${p.id}_1`, text: 'Ligação 1/3 sem atendimento · enviado pedido de contato', time: '08:42' }]
          : col === 'sem_retorno'
            ? [
                { id: `att_${p.id}_1`, text: 'Ligação 1/3 sem retorno', time: '07:45' },
                { id: `att_${p.id}_2`, text: 'Ligação 2/3 caixa postal', time: '08:15' },
                { id: `att_${p.id}_3`, text: 'Ligação 3/3 + pedido de contato WhatsApp', time: '08:40' },
              ]
            : [];

      const reminderTag =
        col === 'aguardando_vespera'
          ? 'Aguardando lembrete'
          : col === 'template_vespera'
            ? 'Template véspera enviado'
            : col === 'nao_confirmou_vespera'
              ? 'Lembrete 7h enviado'
              : col === 'nao_confirmou_7h'
                ? 'Lembrete 2h enviado'
                : `Ligação ${initialAttempts.length}/3`;

      return {
        id: p.id,
        patient: p,
        consultaNum: `Nº ${324100 + idx * 317}`,
        hora,
        dayLabel: isTomorrow ? `Amanhã, ${tomorrowDayMonth}` : `Hoje, ${todayDayMonth}`,
        countdownLabel: countdown,
        urgentCountdown: !isTomorrow,
        column: col,
        reminderTag,
        anamneseRespondida: idx % 3 === 0,
        attempts: initialAttempts,
        resolvedStatus: p.status === 'Confirmada' ? 'Confirmada' : undefined,
      };
    });
  });

  // Support Cmd/Ctrl + K focus shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const baseConfirmedToday = useMemo(
    () => consultations.filter((r) => r.status === 'Confirmada').length,
    [consultations]
  );

  const visibleCards = useMemo(() => {
    const q = norm(search.trim());
    return cards.filter((c) => {
      if (c.resolvedStatus) return false;
      if (!q) return true;
      return norm(`${c.patient.nome} ${c.patient.medico} ${c.consultaNum} ${c.hora}`).includes(q);
    });
  }, [cards, search]);

  const confirmedAdded = useMemo(
    () => cards.filter((c) => c.resolvedStatus === 'Confirmada').length,
    [cards]
  );

  const waitingCount = useMemo(
    () =>
      visibleCards.filter(
        (c) => c.column !== 'nao_confirmou_2h' && c.column !== 'sem_retorno'
      ).length,
    [visibleCards]
  );

  const actionNeededCards = useMemo(
    () =>
      visibleCards.filter(
        (c) => c.column === 'nao_confirmou_2h' || c.column === 'sem_retorno'
      ),
    [visibleCards]
  );

  const handleLogAttempt = (card: ConfirmCardItem, label: string, sendWhatsApp = false) => {
    const nextAttempts = [
      ...card.attempts,
      { id: `att_${Date.now()}`, text: label, time: nowTime() },
    ];
    const shouldMoveNoReturn = nextAttempts.length >= 3;
    setCards((prev) =>
      prev.map((c) =>
        c.id !== card.id
          ? c
          : {
              ...c,
              attempts: nextAttempts,
              column: shouldMoveNoReturn ? 'sem_retorno' : 'nao_confirmou_2h',
              reminderTag: `Ligação ${nextAttempts.length}/3`,
            }
      )
    );
    if (sendWhatsApp) {
      onForwardToChat(
        card.patient.id,
        `Olá, ${card.patient.first}! Tentamos contato telefônico para confirmar sua consulta de hoje às ${card.hora} com ${card.patient.medico}. Está tudo certo para o seu atendimento?`,
        'Pedido de contato (Confirmação 4.4)'
      );
    }
    onToast(
      `Tentativa registrada para ${card.patient.nome} (${nextAttempts.length}/3).`
    );
  };

  const handleConfirmCard = (card: ConfirmCardItem) => {
    setCards((prev) =>
      prev.map((c) => (c.id !== card.id ? c : { ...c, resolvedStatus: 'Confirmada' }))
    );
    onUpdateConsultationStatus(card.patient.id, 'Confirmada');
    onForwardToChat(
      card.patient.id,
      `CONSULTA CONFIRMADA!\nDaqui a pouco estaremos te esperando.\nFique atento ao WhatsApp: 10 minutos antes da consulta, enviaremos seu link de acesso. 💚`,
      'Confirmação registrada (/confirmacao)'
    );
    onToast(`Consulta de ${card.patient.nome} confirmada!`);
  };

  const handleCancelCard = (card: ConfirmCardItem) => {
    setCards((prev) =>
      prev.map((c) => (c.id !== card.id ? c : { ...c, resolvedStatus: 'Cancelada' }))
    );
    onUpdateConsultationStatus(card.patient.id, 'Cancelada');
    onToast(`Consulta de ${card.patient.nome} marcada como cancelada.`);
  };

  return (
    <div className="max-w-[1460px] mx-auto space-y-4">
      {/* Header matching image_39bc5e8d.png */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Confirmação</h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Consultas de hoje e de amanhã que ainda não foram confirmadas
          </p>
        </div>

        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBellOpen((o) => !o)}
            aria-label="Alertas urgentes de confirmação"
            className="relative h-9 w-9 rounded-xl border border-[var(--line)] bg-[var(--surface)] grid place-items-center hover:border-[var(--accent)]"
          >
            <Bell className="h-4 w-4 text-[var(--ink)]" />
            {actionNeededCards.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-[16px] rounded-full bg-amber-500 text-white text-[10px] font-bold px-1 grid place-items-center">
                {actionNeededCards.length}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 top-11 z-40 w-[320px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-[var(--line)]">
                <strong>Consultas que precisam de ação ({actionNeededCards.length})</strong>
                <button
                  type="button"
                  onClick={() => setBellOpen(false)}
                  aria-label="Fechar alertas"
                  className="text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                {actionNeededCards.length ? (
                  actionNeededCards.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-2 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <strong className="block truncate">{c.patient.nome}</strong>
                        <span className="text-[11px] text-rose-600 font-mono-num">
                          {c.hora} · {c.countdownLabel}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setBellOpen(false);
                          onStartCall(c.patient);
                        }}
                        className="rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] px-2.5 py-1 text-[11px] font-semibold shrink-0"
                      >
                        Ligar
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-[var(--muted)] py-3 text-center">
                    Nenhuma pendência crítica no momento.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="relative">
            <Search className="h-3.5 w-3.5 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              aria-label="Buscar paciente ou médico na confirmação"
              className="w-56 rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-8 pr-12 py-2 text-xs focus:outline-none focus:border-[var(--accent)]"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-[var(--line)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-mono-num text-[var(--muted)] pointer-events-none">
              ⌘K
            </span>
          </div>
        </div>
      </div>

      {/* 3 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-4">
          <span className="text-xs text-[var(--muted)] block">Confirmadas hoje</span>
          <strong className="text-3xl font-bold font-mono-num block mt-1">
            {baseConfirmedToday + confirmedAdded}
          </strong>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-4">
          <span className="text-xs text-[var(--muted)] block">Aguardando</span>
          <strong className="text-3xl font-bold font-mono-num block mt-1">{waitingCount}</strong>
        </div>

        <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/30 px-5 py-4">
          <span className="text-xs text-[var(--muted)] block">Precisam de ação</span>
          <strong className="text-3xl font-bold font-mono-num text-amber-600 dark:text-amber-400 block mt-1">
            {actionNeededCards.length}
          </strong>
        </div>
      </div>

      {/* 6 Kanban Columns matching image_39bc5e8d.png & image_837ae3c2.png */}
      <div className="flex gap-3.5 overflow-x-auto pb-4 items-start">
        {CONFIRM_COLUMNS.map((col) => {
          const list = visibleCards.filter((c) => c.column === col.key);
          return (
            <section
              key={col.key}
              className="w-[305px] shrink-0 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] overflow-hidden flex flex-col"
            >
              <div
                className={`px-3.5 py-3 border-b border-[var(--line)] flex items-center gap-2 ${col.headerBg}`}
              >
                <ColumnHeaderIcon colKey={col.key} className={col.iconTone} />
                <strong className="text-xs font-bold truncate">{col.title}</strong>
                <span className="ml-auto inline-flex items-center justify-center rounded-full bg-[var(--surface-2)] border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold font-mono-num text-[var(--muted)]">
                  {list.length}
                </span>
              </div>

              <div className="p-2.5 space-y-2.5 max-h-[640px] overflow-y-auto">
                {list.length ? (
                  list.map((card) => {
                    const p = card.patient;
                    const attemptsExpanded = expandedAttemptsId === card.id;
                    return (
                      <div
                        key={card.id}
                        className="relative rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <strong className="text-xl font-bold font-mono-num leading-none block">
                              {card.hora}
                            </strong>
                            <p className="text-[11px] font-mono-num mt-1">
                              <span className="text-[var(--muted)]">{card.dayLabel} · </span>
                              <span
                                className={
                                  card.urgentCountdown
                                    ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                    : 'text-[var(--muted)]'
                                }
                              >
                                {card.countdownLabel}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 text-[var(--muted)]">
                            <button
                              type="button"
                              onClick={() => onOpenPatientChat(p.id)}
                              title={`Abrir chat de ${p.nome}`}
                              aria-label={`Abrir chat de ${p.nome}`}
                              className="h-7 w-7 rounded-lg hover:bg-[var(--surface-2)] hover:text-[var(--accent)] grid place-items-center"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenNegotiation(p.id)}
                              title={`Abrir ficha e negociação de ${p.nome}`}
                              aria-label={`Abrir ficha de ${p.nome}`}
                              className="h-7 w-7 rounded-lg hover:bg-[var(--surface-2)] hover:text-[var(--accent)] grid place-items-center"
                            >
                              <User className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-0.5 text-xs">
                          <div className="flex items-baseline justify-between gap-2">
                            <strong className="text-[13px] truncate">{p.nome}</strong>
                            <span className="text-[11px] text-[var(--muted)] font-mono-num shrink-0">
                              {card.consultaNum}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--muted)] truncate">
                            Com {p.medico}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              card.reminderTag.startsWith('Ligação')
                                ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                : card.reminderTag === 'Aguardando lembrete'
                                  ? 'bg-[var(--surface-2)] text-[var(--muted)] border-[var(--line)]'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                            }`}
                          >
                            {card.reminderTag}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              card.anamneseRespondida
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                            }`}
                          >
                            • {card.anamneseRespondida ? 'Anamnese respondida' : 'Anamnese pendente'}
                          </span>
                        </div>

                        {/* Contatar + Resposta action buttons */}
                        <div className="grid grid-cols-2 gap-2 relative">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setRespostaMenuId(null);
                                setContatarMenuId((cur) => (cur === card.id ? null : card.id));
                              }}
                              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-xs font-semibold hover:border-[var(--accent)]"
                            >
                              <Phone className="h-3.5 w-3.5 text-[var(--muted)]" />
                              <span>Contatar</span>
                              <ChevronDown className="h-3 w-3 text-[var(--muted)]" />
                            </button>

                            {contatarMenuId === card.id && (
                              <div className="absolute left-0 top-10 z-30 w-[235px] rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xl p-1 text-xs space-y-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setContatarMenuId(null);
                                    onStartCall(p);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)] font-semibold text-left"
                                >
                                  <Phone className="h-3.5 w-3.5 text-[var(--accent)]" />
                                  Ligar pelo discador
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setContatarMenuId(null);
                                    handleLogAttempt(
                                      card,
                                      'Pedido de contato enviado no WhatsApp',
                                      true
                                    );
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[var(--surface-2)] text-left"
                                >
                                  <MessageCircle className="h-3.5 w-3.5 text-[var(--accent)]" />
                                  Enviar pedido de contato (WhatsApp)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setContatarMenuId(null);
                                    onForwardToChat(
                                      p.id,
                                      '⏰ Importante:\nTemos uma tolerância de até 5 minutos de atraso na consulta!\nCaso precise reagendar com menos de 2 horas de antecedência ou falte à consulta, será necessário realizar um novo pagamento. 😉',
                                      'Atalho /importante'
                                    );
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[var(--surface-2)] text-left"
                                >
                                  <Send className="h-3.5 w-3.5 text-[var(--muted)]" />
                                  Enviar /importante no chat
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setContatarMenuId(null);
                                    handleLogAttempt(card, 'Ligação sem atendimento (etapa 4.4)');
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-left"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  Registrar tentativa sem resposta
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setContatarMenuId(null);
                                setRespostaMenuId((cur) => (cur === card.id ? null : card.id));
                              }}
                              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2F7D3E] text-white px-2.5 py-2 text-xs font-semibold hover:brightness-110"
                            >
                              <span>Resposta</span>
                              <ChevronDown className="h-3 w-3" />
                            </button>

                            {respostaMenuId === card.id && (
                              <div className="absolute right-0 top-10 z-30 w-[230px] rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xl p-1 text-xs space-y-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRespostaMenuId(null);
                                    handleConfirmCard(card);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-semibold text-emerald-700 dark:text-emerald-300 text-left"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Confirmou presença (/confirmacao)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRespostaMenuId(null);
                                    onOpenPatientChat(p.id);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[var(--surface-2)] text-left"
                                >
                                  <MessageSquare className="h-3.5 w-3.5 text-[var(--accent)]" />
                                  Quer tirar dúvidas (abrir chat)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRespostaMenuId(null);
                                    onOpenNegotiation(p.id);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[var(--surface-2)] text-left"
                                >
                                  <Calendar className="h-3.5 w-3.5 text-amber-600" />
                                  Solicitou reagendamento
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRespostaMenuId(null);
                                    handleCancelCard(card);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 text-left"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  Cancelou consulta
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[var(--line)] text-[11px] text-[var(--muted)]">
                          {card.attempts.length === 0 ? (
                            <span>Nenhuma tentativa ainda.</span>
                          ) : (
                            <div className="space-y-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedAttemptsId((cur) =>
                                    cur === card.id ? null : card.id
                                  )
                                }
                                className="inline-flex items-center gap-1 font-semibold text-[var(--ink)] hover:underline"
                              >
                                <span>
                                  {card.attempts.length} de 3 tentativas sem resposta
                                </span>
                                <ChevronDown
                                  className={`h-3 w-3 transition-transform ${
                                    attemptsExpanded ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>
                              {attemptsExpanded && (
                                <ul className="space-y-1 rounded-lg bg-[var(--surface-2)] p-2 text-[10px]">
                                  {card.attempts.map((a) => (
                                    <li key={a.id} className="flex items-center justify-between gap-2">
                                      <span className="truncate">{a.text}</span>
                                      <span className="font-mono-num shrink-0">{a.time}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-xs text-[var(--muted)]">
                    Nenhuma consulta
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
