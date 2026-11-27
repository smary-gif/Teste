import React, { useState } from 'react';
import {
  Bot,
  Calendar,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Copy,
  FileText,
  History,
  Home,
  MessageSquare,
  MoreVertical,
  Receipt,
  UserCog,
  X,
  XCircle,
} from 'lucide-react';
import type { AppView, ConsultationRow } from '../types';
import { getTodayMeta, initials, norm, nowTime, pad } from '../utils/helpers';
import {
  buildConsultationLinks,
  CancelConsultationModal,
  ChangeDoctorModal,
  ChangeStatusModal,
  type ChatTargetOption,
  ForwardLinkModal,
  HistoryModal,
  InvoiceModal,
  ReagendarModal,
} from './ConsultationModals';
import { getConsultationTone, StatusBadge } from './StatusBadge';

export type ConsultMenuKey =
  | 'home'
  | 'todas'
  | 'acompanhar'
  | 'agendadas'
  | 'historico'
  | 'prontuarios';

interface ConsultationsViewProps {
  rows: ConsultationRow[];
  chatTargets?: ChatTargetOption[];
  onUpdateRow?: (
    rowId: string,
    patch: Partial<ConsultationRow>,
    opts?: {
      evtText?: string;
      markPractice?: string;
      chatMessage?: { patientId: string; text: string; label: string };
    }
  ) => void;
  onForwardToChat?: (
    patientId: string,
    text: string,
    label: string,
    openChat?: boolean
  ) => void;
  onStartConfirmTour: () => void;
  onAccessChat: (patientId: string) => void;
  onGoView: (view: AppView) => void;
  onOpenQuickSim?: (deptKey?: string, patientId?: string) => void;
  onToast: (msg: string) => void;
}

const MENU_META: Record<
  ConsultMenuKey,
  { breadcrumb: string; title: string; subtitle: string }
> = {
  home: {
    breadcrumb: 'Home · Resumo Operacional',
    title: 'Início · Painel de Consultas',
    subtitle: 'Visão geral do expediente médico, anamneses pendentes e acessos rápidos.',
  },
  todas: {
    breadcrumb: 'Home · Consultas · Todas as consultas',
    title: 'Consultas',
    subtitle: 'Gerencie todas as consultas, seus status e dados referentes aos agendamentos.',
  },
  acompanhar: {
    breadcrumb: 'Home · Consultas · Acompanhar',
    title: 'Acompanhar Consultas em Tempo Real',
    subtitle: 'Monitore pacientes confirmados, anamneses pendentes e acessos à sala médica.',
  },
  agendadas: {
    breadcrumb: 'Home · Consultas · Consultas Agendadas',
    title: 'Consultas Agendadas',
    subtitle: 'Agenda de consultas confirmadas e reagendadas para acompanhamento ativo (4.1 a 4.4).',
  },
  historico: {
    breadcrumb: 'Home · Consultas · Histórico de consultas',
    title: 'Histórico de Consultas',
    subtitle: 'Consultas realizadas, não realizadas (faltas) e reagendamentos concluídos.',
  },
  prontuarios: {
    breadcrumb: 'Home · Consultas · Prontuários',
    title: 'Prontuários e Anamneses',
    subtitle: 'Verifique preenchimento da anamnese pré-consulta e registros clínicos do paciente.',
  },
};

export function ConsultationsView({
  rows,
  chatTargets = [],
  onUpdateRow,
  onForwardToChat,
  onStartConfirmTour,
  onAccessChat,
  onGoView,
  onOpenQuickSim,
  onToast,
}: ConsultationsViewProps) {
  const { today, todayKey } = getTodayMeta();
  const [activeMenu, setActiveMenu] = useState<ConsultMenuKey>('todas');
  const [consultasOpen, setConsultasOpen] = useState(true);

  const [tagStatus, setTagStatus] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [applied, setApplied] = useState<{ day: string; start: string; end: string } | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 24 });
  const [query, setQuery] = useState('');

  type ModalKind =
    | 'reagendar'
    | 'medico'
    | 'status'
    | 'link_consulta'
    | 'link_convidado'
    | 'nf'
    | 'historico'
    | 'cancelar';
  const [activeModal, setActiveModal] = useState<{ type: ModalKind; rowId: string } | null>(null);

  // Sub-filters for the other internal tabs
  const [acompanharFilter, setAcompanharFilter] = useState<'todos' | 'sem_anamnese' | 'com_chat'>('todos');
  const [historicoFilter, setHistoricoFilter] = useState<
    'todos' | 'Realizada' | 'Não realizada' | 'Reagendada' | 'Cancelada'
  >('todos');
  const [prontuarioId, setProntuarioId] = useState<string | null>(rows[0]?.id || null);
  const [checkedAnamnese, setCheckedAnamnese] = useState<Record<string, boolean>>({});

  const qNorm = norm(query.trim());

  const getEffectiveAnamnese = (r: ConsultationRow) =>
    checkedAnamnese[r.id] !== undefined ? checkedAnamnese[r.id] : r.anamnese;

  const baseRowsForMenu = (() => {
    if (activeMenu === 'todas') {
      return rows.filter(
        (r) =>
          (!tagStatus || r.status === 'Confirmada') &&
          (!applied || (r.dateKey === applied.day && r.hora >= applied.start && r.hora <= applied.end))
      );
    }
    if (activeMenu === 'acompanhar') {
      return rows.filter((r) => {
        if (r.status !== 'Confirmada' && r.status !== 'Reagendada') return false;
        if (acompanharFilter === 'sem_anamnese') return !getEffectiveAnamnese(r);
        if (acompanharFilter === 'com_chat') return Boolean(r.pid);
        return true;
      });
    }
    if (activeMenu === 'agendadas') {
      return rows
        .filter((r) => r.status === 'Confirmada' || r.status === 'Reagendada')
        .slice()
        .sort((a, b) => `${a.dateKey} ${a.hora}`.localeCompare(`${b.dateKey} ${b.hora}`));
    }
    if (activeMenu === 'historico') {
      return rows.filter((r) => {
        const isHist =
          r.status === 'Realizada' ||
          r.status === 'Não realizada' ||
          r.status === 'Reagendada' ||
          r.status === 'Cancelada';
        if (!isHist) return false;
        if (historicoFilter !== 'todos') return r.status === historicoFilter;
        return true;
      });
    }
    return rows;
  })();

  const filteredRows = baseRowsForMenu.filter((r) => !qNorm || norm(r.nome).includes(qNorm) || norm(r.medico).includes(qNorm));

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const stats = {
    conf: rows.filter((r) => r.status === 'Confirmada' || r.status === 'Reagendada').length,
    reag: rows.filter((r) => r.status === 'Reagendada').length,
    real: rows.filter((r) => r.status === 'Realizada').length,
    nao: rows.filter((r) => r.status === 'Não realizada').length,
    semAnamnese: rows.filter((r) => !getEffectiveAnamnese(r)).length,
  };

  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

  const selectMenu = (menu: ConsultMenuKey) => {
    setActiveMenu(menu);
    setPage(1);
    setRowMenuId(null);
    if (menu !== 'home') {
      setConsultasOpen(true);
    }
  };

  const handleApplyDate = () => {
    if (!day || !start || !end) {
      onToast('Escolha o dia e os dois horários.');
      return;
    }
    setApplied({ day, start, end });
    setPanelOpen(false);
    setPage(1);
  };

  const selectedProntuario =
    filteredRows.find((r) => r.id === prontuarioId) || filteredRows[0] || rows[0] || null;
  const modalRow = activeModal ? rows.find((r) => r.id === activeModal.rowId) || null : null;

  const openRowMenu = (rowId: string, btnEl: HTMLButtonElement) => {
    if (rowMenuId === rowId) {
      setRowMenuId(null);
      return;
    }
    const rect = btnEl.getBoundingClientRect();
    const estMenuHeight = 365;
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const top =
      spaceBelow >= estMenuHeight
        ? rect.bottom + 6
        : Math.max(12, rect.top - estMenuHeight - 6);
    const right = Math.max(12, window.innerWidth - rect.right);
    setMenuPos({ top, right });
    setRowMenuId(rowId);
  };

  const meta = MENU_META[activeMenu];

  return (
    <div className="max-w-[1440px] mx-auto space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--muted)]">Ambiente de treino · Dados fictícios</p>
          <h1 className="text-2xl font-bold mt-0.5">Sistema de Consultas</h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Réplica operacional da tela de consultas usada no passo a passo de Confirmação.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenQuickSim && (
            <button
              type="button"
              onClick={() => onOpenQuickSim('confirmacao')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
            >
              <Bot className="h-3.5 w-3.5 text-[var(--accent)]" />
              Simular Confirmação
            </button>
          )}
          <button
            type="button"
            onClick={onStartConfirmTour}
            className="rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2 text-xs font-semibold whitespace-nowrap hover:brightness-105"
          >
            Iniciar passo a passo: Confirmação
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[225px_minmax(0,1fr)] rounded-2xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
        <nav
          aria-label="Menu interno de consultas"
          className="border-b lg:border-b-0 lg:border-r border-[var(--line)] p-3 flex flex-col gap-0.5 text-xs"
        >
          <button
            type="button"
            onClick={() => selectMenu('home')}
            className={`text-left px-3 py-2 rounded-lg font-medium transition-colors ${
              activeMenu === 'home'
                ? 'bg-[var(--accent-soft)] font-bold text-[var(--ink)]'
                : 'hover:bg-[var(--surface-2)] text-[var(--ink)]'
            }`}
          >
            Home
          </button>

          <button
            type="button"
            onClick={() => setConsultasOpen((o) => !o)}
            aria-expanded={consultasOpen}
            className={`flex items-center justify-between px-3 py-2 rounded-lg font-bold transition-colors ${
              activeMenu !== 'home' ? 'bg-[var(--surface-2)] text-[var(--ink)]' : 'hover:bg-[var(--surface-2)]'
            }`}
          >
            <span>Consultas</span>
            {consultasOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>

          {consultasOpen && (
            <div className="ml-3 pl-2 border-l border-[var(--line)] flex flex-col gap-0.5 my-1">
              {(
                [
                  ['todas', 'Todas as consultas', 'todas-consultas'],
                  ['acompanhar', 'Acompanhar', undefined],
                  ['agendadas', 'Consultas Agendadas', undefined],
                  ['historico', 'Histórico de consultas', undefined],
                  ['prontuarios', 'Prontuários', undefined],
                ] as Array<[ConsultMenuKey, string, string | undefined]>
              ).map(([key, label, coachId]) => {
                const isActive = activeMenu === key;
                return (
                  <button
                    key={key}
                    type="button"
                    data-coach={coachId}
                    onClick={() => selectMenu(key)}
                    className={`text-left px-2.5 py-1.5 rounded-r-lg transition-colors ${
                      isActive
                        ? 'bg-[var(--accent-soft)] font-bold text-[var(--ink)]'
                        : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => onGoView('crm')}
            className="text-left px-3 py-2 rounded-lg hover:bg-[var(--surface-2)] font-medium"
          >
            CRM
          </button>
          <button
            type="button"
            onClick={() => onGoView('simulacao')}
            className="text-left px-3 py-2 rounded-lg hover:bg-[var(--surface-2)] font-medium"
          >
            Chat (Simulador)
          </button>
        </nav>

        <section className="p-4 md:p-5 space-y-4 min-w-0">
          <p className="text-xs text-[var(--muted)]">{meta.breadcrumb}</p>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">{meta.title}</h2>
              <p className="text-xs text-[var(--muted)]">{meta.subtitle}</p>
            </div>
            {activeMenu !== 'todas' && (
              <button
                type="button"
                onClick={() => selectMenu('todas')}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
              >
                Ir para Todas as consultas
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-[var(--line)] p-3">
              <span className="text-xs text-[var(--muted)] block">Horários livres</span>
              <strong className="font-display text-2xl tabular-nums">6</strong>
              <span className="text-[11px] text-[var(--muted)] block font-mono-num">
                Atualizado às {nowTime()}
              </span>
            </div>
            <div className="rounded-xl border border-[var(--ink)] p-3">
              <span className="text-xs text-[var(--muted)] block">Confirmadas / Reagendadas</span>
              <strong className="font-display text-2xl tabular-nums">{stats.conf}</strong>
              <span className="text-[11px] text-[var(--muted)] block tabular-nums">
                {stats.reag} reagendadas
              </span>
            </div>
            <div className="rounded-xl border border-[var(--line)] p-3">
              <span className="text-xs text-[var(--muted)] block">Realizadas</span>
              <strong className="font-display text-2xl tabular-nums">{stats.real}</strong>
            </div>
            <div className="rounded-xl border border-[var(--line)] p-3">
              <span className="text-xs text-[var(--muted)] block">
                {activeMenu === 'prontuarios' || activeMenu === 'home'
                  ? 'Anamneses pendentes'
                  : 'Não realizadas'}
              </span>
              <strong className="font-display text-2xl tabular-nums">
                {activeMenu === 'prontuarios' || activeMenu === 'home' ? stats.semAnamnese : stats.nao}
              </strong>
            </div>
          </div>

          {/* HOME SUBVIEW */}
          {activeMenu === 'home' && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(
                  [
                    ['todas', 'Todas as consultas', 'Filtrar agenda completa e abrir chats', Home],
                    ['acompanhar', 'Acompanhar', 'Monitorar acessos e anamneses pendentes', Clock],
                    ['agendadas', 'Consultas Agendadas', 'Confirmar rotina 4.1 a 4.4', Calendar],
                    ['prontuarios', 'Prontuários', 'Checar preenchimento clínico', FileText],
                  ] as Array<[ConsultMenuKey, string, string, typeof Home]>
                ).map(([target, label, desc, Icon]) => (
                  <button
                    key={target}
                    type="button"
                    onClick={() => selectMenu(target)}
                    className="text-left rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5 hover:border-[var(--accent)] transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <Icon className="h-4 w-4 text-[var(--accent)]" />
                      <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)]" />
                    </div>
                    <strong className="text-sm block">{label}</strong>
                    <span className="text-xs text-[var(--muted)] block">{desc}</span>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-[var(--line)] overflow-hidden">
                <div className="px-4 py-2.5 bg-[var(--surface-2)] border-b border-[var(--line)] flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                    Próximos atendimentos & pendências de hoje
                  </h3>
                  <span className="text-xs font-mono-num text-[var(--muted)]">
                    {rows.filter((r) => r.status === 'Confirmada').length} confirmadas
                  </span>
                </div>
                <div className="divide-y divide-[var(--line)]">
                  {rows.slice(0, 6).map((r) => (
                    <div
                      key={r.id}
                      className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-[200px]">
                        <span className="h-8 w-8 rounded-full bg-[var(--sunk)] text-[var(--accent)] font-bold text-[10px] grid place-items-center shrink-0">
                          {initials(r.nome)}
                        </span>
                        <div>
                          <strong className="block">{r.nome}</strong>
                          <span className="text-[11px] text-[var(--muted)]">
                            {r.medico} · {r.dataBr} às {r.hora}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge tone={getConsultationTone(r.status)}>{r.status}</StatusBadge>
                        <StatusBadge tone={getEffectiveAnamnese(r) ? 'ok' : 'bad'}>
                          {getEffectiveAnamnese(r) ? 'Anamnese OK' : 'Sem anamnese'}
                        </StatusBadge>
                        {r.pid ? (
                          <button
                            type="button"
                            onClick={() => onAccessChat(r.pid!)}
                            className="rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] px-2.5 py-1 font-semibold hover:brightness-95"
                          >
                            Acessar chat
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setProntuarioId(r.id);
                              selectMenu('prontuarios');
                            }}
                            className="rounded-lg border border-[var(--line)] px-2.5 py-1 font-semibold hover:border-[var(--accent)]"
                          >
                            Ver prontuário
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PRONTUÁRIOS SUBVIEW */}
          {activeMenu === 'prontuarios' && (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
              <div className="space-y-3 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold">Prontuários de pacientes</h3>
                  <div className="flex-1" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Pesquisar paciente ou médico"
                    aria-label="Pesquisar prontuários"
                    className="w-60 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
                  <table className="w-full min-w-[600px] text-xs border-collapse">
                    <thead>
                      <tr className="bg-[var(--surface-2)] text-[var(--muted)] uppercase tracking-wider text-[10px] border-b border-[var(--line)]">
                        <th className="text-left px-3 py-2.5">Paciente</th>
                        <th className="text-left px-3 py-2.5">Médico</th>
                        <th className="text-left px-3 py-2.5">Anamnese</th>
                        <th className="text-right px-3 py-2.5">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {slice.map((r) => {
                        const anamOk = getEffectiveAnamnese(r);
                        const isSel = selectedProntuario?.id === r.id;
                        return (
                          <tr
                            key={r.id}
                            className={isSel ? 'bg-[var(--accent-soft)]/50' : 'hover:bg-[var(--surface-2)]'}
                          >
                            <td className="px-3 py-2.5">
                              <strong className="block">{r.nome}</strong>
                              <span className="text-[11px] text-[var(--muted)] font-mono-num">
                                {r.proc} · {r.tipo}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">{r.medico}</td>
                            <td className="px-3 py-2.5">
                              <StatusBadge tone={anamOk ? 'ok' : 'bad'}>
                                {anamOk ? 'Preenchida' : 'Não preenchida'}
                              </StatusBadge>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => setProntuarioId(r.id)}
                                className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 font-semibold hover:border-[var(--accent)] whitespace-nowrap"
                              >
                                Abrir prontuário
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedProntuario && (
                <aside className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4 space-y-3 text-xs">
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-[var(--line)]">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                        Prontuário Digital · ClickCannabis
                      </span>
                      <h3 className="text-base font-bold mt-0.5">{selectedProntuario.nome}</h3>
                      <p className="text-[11px] text-[var(--muted)] font-mono-num">
                        Prontuário {selectedProntuario.proc}
                      </p>
                    </div>
                    <StatusBadge tone={getEffectiveAnamnese(selectedProntuario) ? 'ok' : 'bad'}>
                      {getEffectiveAnamnese(selectedProntuario) ? 'Anamnese OK' : 'Pendente'}
                    </StatusBadge>
                  </div>

                  <div className="space-y-1.5">
                    <p>
                      <strong className="text-[var(--muted)]">Médico:</strong>{' '}
                      {selectedProntuario.medico}
                    </p>
                    <p>
                      <strong className="text-[var(--muted)]">Tipo de consulta:</strong>{' '}
                      {selectedProntuario.tipo}
                    </p>
                    <p>
                      <strong className="text-[var(--muted)]">Agenda:</strong>{' '}
                      <span className="font-mono-num">
                        {selectedProntuario.dataBr} às {selectedProntuario.hora}
                      </span>
                    </p>
                    <p>
                      <strong className="text-[var(--muted)]">Status atual:</strong>{' '}
                      {selectedProntuario.status}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 space-y-1">
                    <strong className="block">Checklist pré-consulta</strong>
                    <p className="text-[var(--muted)] leading-relaxed">
                      {getEffectiveAnamnese(selectedProntuario)
                        ? 'Anamnese preenchida e disponível para avaliação médica antes da entrada em sala.'
                        : 'Anamnese ainda não preenchida. Envie orientação de preenchimento antes do início da consulta.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = !getEffectiveAnamnese(selectedProntuario);
                        setCheckedAnamnese((prev) => ({
                          ...prev,
                          [selectedProntuario.id]: nextVal,
                        }));
                        onToast(
                          nextVal
                            ? `Anamnese de ${selectedProntuario.nome} marcada como preenchida.`
                            : `Anamnese de ${selectedProntuario.nome} marcada como pendente.`
                        );
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 font-semibold hover:border-[var(--accent)]"
                    >
                      <ClipboardCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
                      {getEffectiveAnamnese(selectedProntuario)
                        ? 'Marcar pendente'
                        : 'Validar anamnese'}
                    </button>

                    {selectedProntuario.pid ? (
                      <button
                        type="button"
                        onClick={() => onAccessChat(selectedProntuario.pid!)}
                        className="rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] px-3 py-1.5 font-semibold"
                      >
                        Acessar chat
                      </button>
                    ) : (
                      onOpenQuickSim && (
                        <button
                          type="button"
                          onClick={() => onOpenQuickSim('solicitacoes')}
                          className="rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] px-3 py-1.5 font-semibold"
                        >
                          Simular caso clínico
                        </button>
                      )
                    )}
                  </div>
                </aside>
              )}
            </div>
          )}

          {/* TABLE VIEWS: TODAS / ACOMPANHAR / AGENDADAS / HISTORICO */}
          {activeMenu !== 'home' && activeMenu !== 'prontuarios' && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold">{meta.title}</h3>
                <div className="flex-1" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Pesquisar pacientes"
                  aria-label="Pesquisar pacientes"
                  className="w-52 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--accent)]"
                />
                {activeMenu === 'todas' && (
                  <div className="relative">
                    <button
                      type="button"
                      data-coach="btn-data"
                      onClick={() => setPanelOpen((o) => !o)}
                      aria-label="Filtrar por data e horário"
                      className="h-8 w-8 rounded-lg border border-[var(--line)] grid place-items-center hover:border-[var(--accent)]"
                    >
                      <Calendar className="h-4 w-4" />
                    </button>

                    {panelOpen && (
                      <div className="absolute right-0 top-full mt-2 w-[300px] rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl p-3.5 z-30 space-y-3">
                        <p className="text-xs font-bold">
                          {monthNames[month]} {year}
                        </p>
                        <div className="grid grid-cols-7 gap-1 text-center text-xs">
                          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, idx) => (
                            <span key={idx} className="text-[10px] font-bold text-[var(--muted)]">
                              {d}
                            </span>
                          ))}
                          {Array.from({ length: firstDow }).map((_, idx) => (
                            <span key={`empty-${idx}`} />
                          ))}
                          {Array.from({ length: daysInMonth }).map((_, idx) => {
                            const dNum = idx + 1;
                            const key = `${year}-${pad(month + 1)}-${pad(dNum)}`;
                            const isToday = key === todayKey;
                            const isSel = day === key;
                            return (
                              <button
                                key={key}
                                type="button"
                                data-coach={isToday ? 'cal-today' : undefined}
                                onClick={() => setDay(key)}
                                className={`rounded-lg py-1.5 font-mono-num text-xs ${
                                  isSel
                                    ? 'bg-[var(--accent)] text-[var(--accent-ink)] font-bold'
                                    : isToday
                                      ? 'border border-[var(--accent)] font-bold'
                                      : 'hover:bg-[var(--surface-2)]'
                                }`}
                              >
                                {dNum}
                              </button>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[11px] font-semibold text-[var(--muted)] space-y-1">
                            <span>Horário inicial</span>
                            <input
                              id="f-start"
                              type="time"
                              value={start}
                              onChange={(e) => setStart(e.target.value)}
                              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--ink)]"
                            />
                          </label>
                          <label className="text-[11px] font-semibold text-[var(--muted)] space-y-1">
                            <span>Horário final</span>
                            <input
                              id="f-end"
                              type="time"
                              value={end}
                              onChange={(e) => setEnd(e.target.value)}
                              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--ink)]"
                            />
                          </label>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setPanelOpen(false)}
                            className="flex-1 rounded-lg border border-[var(--line)] py-1.5 text-xs font-semibold"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            data-coach="aplicar"
                            onClick={handleApplyDate}
                            className="flex-1 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] py-1.5 text-xs font-semibold"
                          >
                            Aplicar filtro
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {activeMenu === 'todas' && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {tagStatus && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 font-semibold">
                      Status: Confirmadas
                      <button
                        type="button"
                        data-coach="tag-x"
                        onClick={() => {
                          setTagStatus(false);
                          setPage(1);
                        }}
                        aria-label="Remover filtro Status: Confirmadas"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                  {applied && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 font-semibold font-mono-num">
                      Data: {applied.day.split('-').reverse().join('/')} · {applied.start} às{' '}
                      {applied.end}
                      <button
                        type="button"
                        onClick={() => setApplied(null)}
                        aria-label="Remover filtro de data"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                  {!tagStatus && !applied && (
                    <span className="text-[var(--muted)]">Sem filtros aplicados</span>
                  )}
                </div>
              )}

              {activeMenu === 'acompanhar' && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {(
                    [
                      ['todos', 'Todos em acompanhamento'],
                      ['sem_anamnese', 'Anamnese pendente'],
                      ['com_chat', 'Com chat vinculado'],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setAcompanharFilter(k);
                        setPage(1);
                      }}
                      className={`rounded-lg border px-3 py-1 font-semibold ${
                        acompanharFilter === k
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                          : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {activeMenu === 'historico' && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {(['todos', 'Realizada', 'Não realizada', 'Reagendada', 'Cancelada'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setHistoricoFilter(k);
                        setPage(1);
                      }}
                      className={`rounded-lg border px-3 py-1 font-semibold ${
                        historicoFilter === k
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                          : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)]'
                      }`}
                    >
                      {k === 'todos' ? 'Todo histórico' : k}
                    </button>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
                <table className="w-full min-w-[760px] text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-2)] text-[var(--muted)] uppercase tracking-wider text-[10px] border-b border-[var(--line)]">
                      <th className="text-left px-3 py-2.5">Paciente</th>
                      <th className="text-left px-3 py-2.5">Médico</th>
                      <th className="text-left px-3 py-2.5">Tipo</th>
                      <th className="text-left px-3 py-2.5">Status</th>
                      <th className="text-left px-3 py-2.5">Data e hora</th>
                      <th className="text-left px-3 py-2.5">Anamnese</th>
                      <th className="px-3 py-2.5"></th>
                      <th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {slice.length ? (
                      slice.map((r) => {
                        const isTarget = r.id === 'rconfirmacao6';
                        const anamOk = getEffectiveAnamnese(r);
                        return (
                          <tr key={r.id} className="hover:bg-[var(--surface-2)]">
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="h-7 w-7 rounded-full bg-[var(--sunk)] text-[var(--accent)] font-bold text-[10px] grid place-items-center shrink-0">
                                  {initials(r.nome)}
                                </span>
                                <div>
                                  <strong className="block">{r.nome}</strong>
                                  <span className="text-[11px] text-[var(--muted)] font-mono-num">
                                    {r.proc}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">{r.medico}</td>
                            <td className="px-3 py-2.5">{r.tipo}</td>
                            <td className="px-3 py-2.5">
                              <StatusBadge tone={getConsultationTone(r.status)}>
                                {r.status}
                              </StatusBadge>
                            </td>
                            <td className="px-3 py-2.5 font-mono-num">
                              {r.dataBr} às {r.hora}
                            </td>
                            <td className="px-3 py-2.5">
                              <StatusBadge tone={anamOk ? 'ok' : 'bad'}>
                                {anamOk ? 'Preenchida' : 'Não preenchida'}
                              </StatusBadge>
                            </td>
                            <td className="px-3 py-2.5">
                              {activeMenu === 'acompanhar' && r.pid ? (
                                <button
                                  type="button"
                                  onClick={() => onAccessChat(r.pid!)}
                                  className="text-[var(--accent)] font-semibold hover:underline whitespace-nowrap"
                                >
                                  Acessar chat
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setActiveModal({ type: 'reagendar', rowId: r.id })}
                                  className="text-[var(--accent)] font-semibold hover:underline whitespace-nowrap"
                                >
                                  Reagendar
                                </button>
                              )}
                            </td>
                            <td className="px-3 py-2.5 relative">
                              <button
                                type="button"
                                data-coach={isTarget ? 'row-menu' : undefined}
                                onClick={(e) => openRowMenu(r.id, e.currentTarget)}
                                aria-label="Mais ações"
                                className="h-7 w-7 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] grid place-items-center hover:border-[var(--accent)]"
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </button>

                              {rowMenuId === r.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-30"
                                    onClick={() => setRowMenuId(null)}
                                  />
                                  <div
                                    style={{ top: menuPos.top, right: menuPos.right }}
                                    className="fixed z-40 w-[236px] rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl p-1.5 text-xs space-y-0.5"
                                  >
                                    <button
                                      type="button"
                                      data-coach={isTarget ? 'acessar-chat' : undefined}
                                      onClick={() => {
                                        setRowMenuId(null);
                                        if (!r.pid) {
                                          onToast(
                                            'Esta consulta não faz parte da simulação de chat.'
                                          );
                                          return;
                                        }
                                        onAccessChat(r.pid);
                                      }}
                                      className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)] font-semibold"
                                    >
                                      <span className="inline-flex items-center gap-2">
                                        <MessageSquare className="h-3.5 w-3.5 text-[var(--muted)]" />
                                        Acessar chat
                                      </span>
                                      <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)]" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRowMenuId(null);
                                        setProntuarioId(r.id);
                                        selectMenu('prontuarios');
                                      }}
                                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)]"
                                    >
                                      <FileText className="h-3.5 w-3.5 text-[var(--muted)]" />
                                      Ver anamnese
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRowMenuId(null);
                                        setActiveModal({ type: 'historico', rowId: r.id });
                                      }}
                                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)]"
                                    >
                                      <History className="h-3.5 w-3.5 text-[var(--muted)]" />
                                      Ver histórico
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRowMenuId(null);
                                        setActiveModal({ type: 'link_consulta', rowId: r.id });
                                      }}
                                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)]"
                                    >
                                      <Copy className="h-3.5 w-3.5 text-[var(--muted)]" />
                                      Link de consulta
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRowMenuId(null);
                                        setActiveModal({ type: 'link_convidado', rowId: r.id });
                                      }}
                                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)]"
                                    >
                                      <Copy className="h-3.5 w-3.5 text-[var(--muted)]" />
                                      Link de convidado
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRowMenuId(null);
                                        const medLink = buildConsultationLinks(r.proc).medico;
                                        if (navigator.clipboard?.writeText) {
                                          navigator.clipboard
                                            .writeText(medLink)
                                            .catch(() => {});
                                        }
                                        onToast(`Link do médico copiado: ${medLink}`);
                                      }}
                                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)]"
                                    >
                                      <Copy className="h-3.5 w-3.5 text-[var(--muted)]" />
                                      Copiar link do médico
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRowMenuId(null);
                                        setActiveModal({ type: 'status', rowId: r.id });
                                      }}
                                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)]"
                                    >
                                      <Clock className="h-3.5 w-3.5 text-[var(--muted)]" />
                                      Alterar status da consulta
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRowMenuId(null);
                                        setActiveModal({ type: 'medico', rowId: r.id });
                                      }}
                                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)]"
                                    >
                                      <UserCog className="h-3.5 w-3.5 text-[var(--muted)]" />
                                      Alterar médico
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRowMenuId(null);
                                        setActiveModal({ type: 'nf', rowId: r.id });
                                      }}
                                      className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)]"
                                    >
                                      <span className="inline-flex items-center gap-2">
                                        <Receipt className="h-3.5 w-3.5 text-[var(--muted)]" />
                                        Nota fiscal
                                      </span>
                                      <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)]" />
                                    </button>

                                    <div className="my-1 border-t border-[var(--line)]" />

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRowMenuId(null);
                                        setActiveModal({ type: 'cancelar', rowId: r.id });
                                      }}
                                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-[var(--danger-soft)] text-[var(--danger)] font-semibold"
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                      Cancelar consulta
                                    </button>
                                  </div>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-[var(--muted)]">
                          Nenhuma consulta encontrada com os filtros atuais.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 text-xs text-[var(--muted)]">
                <label htmlFor="page-size">Linhas por página</label>
                <select
                  id="page-size"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--ink)]"
                >
                  {[10, 15, 20, 25, 50].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span className="font-mono-num">
                  {filteredRows.length ? (safePage - 1) * pageSize + 1 : 0}–
                  {Math.min(filteredRows.length, safePage * pageSize)} de {filteredRows.length}
                </span>
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-[var(--line)] px-2.5 py-1 font-semibold disabled:opacity-45"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-[var(--line)] px-2.5 py-1 font-semibold disabled:opacity-45"
                >
                  Próxima
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {activeModal?.type === 'reagendar' && modalRow && (
        <ReagendarModal
          row={modalRow}
          chatTargets={chatTargets}
          onClose={() => setActiveModal(null)}
          onRequestLeadership={(info) => {
            onUpdateRow?.(
              modalRow.id,
              {},
              {
                evtText: `Solicitação enviada à Liderança (Katlen Pfeifer / Stephanye / Iris) para abrir agenda de ${info.medico} em ${info.dataBr}: ${info.motivo}`,
              }
            );
            onToast(
              `Solicitação enviada à Liderança (Katlen Pfeifer / Stephanye / Iris) para liberar ${info.medico} em ${info.dataBr}.`
            );
          }}
          onConfirm={(payload) => {
            const changedDoc = payload.medico !== modalRow.medico;
            const confirmMsg = `Consulta reagendada para ${payload.dataBr} às ${payload.hora} com ${payload.medico}. (${payload.regra})${payload.obs ? `\nObs.: ${payload.obs}` : ''}`;
            onUpdateRow?.(
              modalRow.id,
              {
                dateKey: payload.dateKey,
                dataBr: payload.dataBr,
                hora: payload.hora,
                medico: payload.medico,
                status: 'Reagendada',
              },
              {
                evtText: `Reagendada para ${payload.dataBr} às ${payload.hora}${changedDoc ? ` · ${payload.medico}` : ''}`,
                markPractice: 'd1_2',
                chatMessage: payload.sendToChat
                  ? {
                      patientId: payload.targetChatId,
                      text: confirmMsg,
                      label: 'Reagendamento confirmado',
                    }
                  : undefined,
              }
            );
            setActiveModal(null);
            onToast(
              `Consulta de ${modalRow.nome} reagendada para ${payload.dataBr} às ${payload.hora}.`
            );
          }}
        />
      )}

      {activeModal?.type === 'medico' && modalRow && (
        <ChangeDoctorModal
          row={modalRow}
          chatTargets={chatTargets}
          onClose={() => setActiveModal(null)}
          onConfirm={(payload) => {
            onUpdateRow?.(
              modalRow.id,
              { medico: payload.medico },
              {
                evtText: `Médico alterado para ${payload.medico} (${payload.motivo})`,
                chatMessage: payload.sendToChat
                  ? {
                      patientId: payload.targetChatId,
                      text: `Informamos que sua consulta de ${modalRow.dataBr} às ${modalRow.hora} foi transferida para ${payload.medico}. Qualquer dúvida estamos à disposição!`,
                      label: 'Alteração de médico',
                    }
                  : undefined,
              }
            );
            setActiveModal(null);
            onToast(`Médico de ${modalRow.nome} alterado para ${payload.medico}.`);
          }}
        />
      )}

      {activeModal?.type === 'status' && modalRow && (
        <ChangeStatusModal
          row={modalRow}
          onClose={() => setActiveModal(null)}
          onConfirm={(nextStatus) => {
            onUpdateRow?.(
              modalRow.id,
              { status: nextStatus },
              { evtText: `Status da consulta alterado para "${nextStatus}"` }
            );
            setActiveModal(null);
            onToast(`Status atualizado para ${nextStatus}.`);
          }}
        />
      )}

      {(activeModal?.type === 'link_consulta' || activeModal?.type === 'link_convidado') &&
        modalRow && (
          <ForwardLinkModal
            row={modalRow}
            kind={activeModal.type === 'link_consulta' ? 'consulta' : 'convidado'}
            chatTargets={chatTargets}
            onClose={() => setActiveModal(null)}
            onToast={onToast}
            onForward={(patientId, text, label, openChat) => {
              onForwardToChat?.(patientId, text, label, openChat);
              setActiveModal(null);
            }}
          />
        )}

      {activeModal?.type === 'nf' && modalRow && (
        <InvoiceModal
          row={modalRow}
          chatTargets={chatTargets}
          onClose={() => setActiveModal(null)}
          onToast={onToast}
          onForward={(patientId, text, label, openChat) => {
            onForwardToChat?.(patientId, text, label, openChat);
            setActiveModal(null);
          }}
        />
      )}

      {activeModal?.type === 'historico' && modalRow && (
        <HistoryModal
          row={modalRow}
          allRows={rows}
          onClose={() => setActiveModal(null)}
          onOpenAnamnese={() => {
            setProntuarioId(modalRow.id);
            setActiveModal(null);
            selectMenu('prontuarios');
          }}
          onOpenReagendar={() => setActiveModal({ type: 'reagendar', rowId: modalRow.id })}
        />
      )}

      {activeModal?.type === 'cancelar' && modalRow && (
        <CancelConsultationModal
          row={modalRow}
          onClose={() => setActiveModal(null)}
          onConfirm={(motivo) => {
            onUpdateRow?.(
              modalRow.id,
              { status: 'Cancelada' },
              { evtText: `Consulta cancelada: ${motivo}` }
            );
            setActiveModal(null);
            onToast(`Consulta de ${modalRow.nome} cancelada.`);
          }}
        />
      )}
    </div>
  );
}
