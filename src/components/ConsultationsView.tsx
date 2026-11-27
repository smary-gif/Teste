import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Bot,
  Calendar,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Copy,
  CreditCard,
  FileText,
  History,
  Home,
  LayoutGrid,
  MessageSquare,
  MoreVertical,
  Receipt,
  Repeat,
  Settings,
  SlidersHorizontal,
  Stethoscope,
  UserCog,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { MEDS } from '../data/defaults';
import type { AppView, ConsultationRow } from '../types';
import { getTodayMeta, initials, norm, nowTime, pad } from '../utils/helpers';
import {
  buildConsultationLinks,
  CancelConsultationModal,
  ChangeDoctorModal,
  ChangeStatusModal,
  type ChatTargetOption,
  ForwardLinkModal,
  getDoctorSlotsForDate,
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
  | 'prontuarios'
  | 'anamnese'
  | 'dashboard'
  | 'medicos'
  | 'cms'
  | 'financeiro';

export type ConsultTipoFilter = 'todos' | 'primeira' | 'recorrente' | 'gratuita';

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
    breadcrumb: 'Home / Resumo Operacional',
    title: 'Início · Painel de Consultas',
    subtitle: 'Visão geral do expediente médico, anamneses pendentes e acessos rápidos.',
  },
  todas: {
    breadcrumb: 'Home / Consultas / Todas as consultas',
    title: 'Consultas',
    subtitle: 'Gerencie todas as consultas, seus status e dados referentes aos agendamentos.',
  },
  acompanhar: {
    breadcrumb: 'Home / Consultas / Acompanhar',
    title: 'Acompanhar Consultas em Tempo Real',
    subtitle: 'Monitore pacientes confirmados, anamneses pendentes e acessos à sala médica.',
  },
  agendadas: {
    breadcrumb: 'Home / Consultas / Consultas Agendadas',
    title: 'Consultas Agendadas',
    subtitle: 'Agenda de consultas confirmadas e reagendadas para acompanhamento ativo (4.1 a 4.4).',
  },
  historico: {
    breadcrumb: 'Home / Consultas / Histórico de consultas',
    title: 'Histórico de Consultas',
    subtitle: 'Consultas realizadas, não realizadas (faltas) e reagendamentos concluídos.',
  },
  prontuarios: {
    breadcrumb: 'Home / Consultas / Prontuários',
    title: 'Prontuários e Registros Clínicos',
    subtitle: 'Verifique preenchimento clínico pré-consulta e registros do paciente.',
  },
  anamnese: {
    breadcrumb: 'Home / Consultas / Anamnese',
    title: 'Anamnese Pré-Consulta',
    subtitle: 'Monitore e valide preenchimentos de primeira anamnese e recorrência antes da sala.',
  },
  dashboard: {
    breadcrumb: 'Home / Dashboard',
    title: 'Dashboard de Consultas',
    subtitle: 'Indicadores por médico, tipo de consulta (Primeira vez vs Recorrente) e status.',
  },
  medicos: {
    breadcrumb: 'Home / Médicos',
    title: 'Agenda dos Médicos',
    subtitle: 'Consulte horários livres de hoje e filtre atendimentos por médico responsável.',
  },
  cms: {
    breadcrumb: 'Home / CMS',
    title: 'CMS · Modelos de Mensagem e Lembretes',
    subtitle: 'Templates operacionais para confirmação, links de sala e orientações de anamnese.',
  },
  financeiro: {
    breadcrumb: 'Home / Financeiro',
    title: 'Financeiro · Notas Fiscais e Consultas',
    subtitle: 'Emita, copie e encaminhe Notas Fiscais (NFS-e) de consultas pagas e gratuitas.',
  },
};

function matchesTipoFilter(rowTipo: string, filter: ConsultTipoFilter): boolean {
  if (filter === 'todos') return true;
  const t = norm(rowTipo);
  if (filter === 'primeira') return t.includes('primeir');
  if (filter === 'recorrente') {
    return t.includes('recorr') || t.includes('retorn') || t.includes('consulta medica');
  }
  if (filter === 'gratuita') return t.includes('gratuit');
  return true;
}

function getTipoDisplay(rowTipo: string): {
  main: string;
  sub: string;
  kind: 'primeira' | 'recorrente' | 'gratuita';
} {
  const t = norm(rowTipo);
  if (t.includes('primeir')) {
    return { main: 'Primeira', sub: '1ª vez', kind: 'primeira' };
  }
  if (t.includes('gratuit')) {
    return { main: 'Gratuita', sub: 'Cortesia', kind: 'gratuita' };
  }
  return { main: 'Recorrência', sub: '2ª vez', kind: 'recorrente' };
}

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
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [doctorFilter, setDoctorFilter] = useState<string>('todos');
  const [tipoFilter, setTipoFilter] = useState<ConsultTipoFilter>('todos');
  const [anamneseFilter, setAnamneseFilter] = useState<'todos' | 'ok' | 'pendente'>('todos');
  const [filterOpen, setFilterOpen] = useState(false);

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

  const [agendaModalOpen, setAgendaModalOpen] = useState(false);
  const [agendaDoc, setAgendaDoc] = useState<string>(MEDS[0]);
  const [card4Mode, setCard4Mode] = useState<'Não realizada' | 'Cancelada' | 'Pendente'>(
    'Não realizada'
  );
  const [card4DropdownOpen, setCard4DropdownOpen] = useState(false);

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

  const [acompanharFilter, setAcompanharFilter] = useState<'todos' | 'sem_anamnese' | 'com_chat'>(
    'todos'
  );
  const [historicoFilter, setHistoricoFilter] = useState<
    'todos' | 'Realizada' | 'Não realizada' | 'Reagendada' | 'Cancelada'
  >('todos');
  const [prontuarioId, setProntuarioId] = useState<string | null>(rows[0]?.id || null);
  const [checkedAnamnese, setCheckedAnamnese] = useState<Record<string, boolean>>({});

  const qNorm = norm(query.trim());

  const allDoctors = useMemo(() => {
    const set = new Set<string>(MEDS);
    rows.forEach((r) => {
      if (r.medico?.trim()) set.add(r.medico.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [rows]);

  const getEffectiveAnamnese = (r: ConsultationRow) =>
    checkedAnamnese[r.id] !== undefined ? checkedAnamnese[r.id] : r.anamnese;

  const baseRowsForMenu = useMemo(() => {
    const applyCommonFilters = (list: ConsultationRow[]) =>
      list.filter((r) => {
        if (doctorFilter !== 'todos' && r.medico !== doctorFilter) return false;
        if (!matchesTipoFilter(r.tipo, tipoFilter)) return false;
        if (anamneseFilter === 'ok' && !getEffectiveAnamnese(r)) return false;
        if (anamneseFilter === 'pendente' && getEffectiveAnamnese(r)) return false;
        if (
          applied &&
          !(r.dateKey === applied.day && r.hora >= applied.start && r.hora <= applied.end)
        ) {
          return false;
        }
        return true;
      });

    if (activeMenu === 'todas') {
      return applyCommonFilters(
        rows.filter((r) => {
          if (statusFilter !== 'todos') return r.status === statusFilter;
          if (tagStatus) return r.status === 'Confirmada';
          return true;
        })
      );
    }
    if (activeMenu === 'acompanhar') {
      return applyCommonFilters(
        rows.filter((r) => {
          if (r.status !== 'Confirmada' && r.status !== 'Reagendada') return false;
          if (acompanharFilter === 'sem_anamnese') return !getEffectiveAnamnese(r);
          if (acompanharFilter === 'com_chat') return Boolean(r.pid);
          return true;
        })
      );
    }
    if (activeMenu === 'agendadas') {
      return applyCommonFilters(
        rows
          .filter((r) => r.status === 'Confirmada' || r.status === 'Reagendada')
          .slice()
          .sort((a, b) => `${a.dateKey} ${a.hora}`.localeCompare(`${b.dateKey} ${b.hora}`))
      );
    }
    if (activeMenu === 'historico') {
      return applyCommonFilters(
        rows.filter((r) => {
          const isHist =
            r.status === 'Realizada' ||
            r.status === 'Não realizada' ||
            r.status === 'Reagendada' ||
            r.status === 'Cancelada';
          if (!isHist) return false;
          if (historicoFilter !== 'todos') return r.status === historicoFilter;
          return true;
        })
      );
    }
    if (activeMenu === 'anamnese' || activeMenu === 'prontuarios' || activeMenu === 'financeiro') {
      return applyCommonFilters(rows);
    }
    return applyCommonFilters(rows);
  }, [
    rows,
    activeMenu,
    tagStatus,
    statusFilter,
    doctorFilter,
    tipoFilter,
    anamneseFilter,
    applied,
    acompanharFilter,
    historicoFilter,
    checkedAnamnese,
  ]);

  const filteredRows = useMemo(
    () =>
      baseRowsForMenu.filter(
        (r) =>
          !qNorm ||
          norm(r.nome).includes(qNorm) ||
          norm(r.medico).includes(qNorm) ||
          norm(r.proc).includes(qNorm)
      ),
    [baseRowsForMenu, qNorm]
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const stats = useMemo(() => {
    const freeSlots = allDoctors.reduce(
      (sum, m) => sum + getDoctorSlotsForDate(m, todayKey).slots.length,
      0
    );
    return {
      freeSlots,
      conf: rows.filter((r) => r.status === 'Confirmada' || r.status === 'Reagendada').length,
      reag: rows.filter((r) => r.status === 'Reagendada').length,
      real: rows.filter((r) => r.status === 'Realizada').length,
      nao: rows.filter((r) => r.status === 'Não realizada').length,
      canc: rows.filter((r) => r.status === 'Cancelada').length,
      pend: rows.filter((r) => r.status === 'Pendente').length,
      semAnamnese: rows.filter((r) => !getEffectiveAnamnese(r)).length,
    };
  }, [allDoctors, rows, todayKey, checkedAnamnese]);

  const activeFilterCount =
    (tagStatus && statusFilter === 'todos' ? 1 : 0) +
    (statusFilter !== 'todos' ? 1 : 0) +
    (doctorFilter !== 'todos' ? 1 : 0) +
    (tipoFilter !== 'todos' ? 1 : 0) +
    (anamneseFilter !== 'todos' ? 1 : 0) +
    (applied ? 1 : 0);

  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  const selectMenu = (menu: ConsultMenuKey) => {
    setActiveMenu(menu);
    setPage(1);
    setRowMenuId(null);
    setFilterOpen(false);
    setPanelOpen(false);
    if (
      menu === 'todas' ||
      menu === 'acompanhar' ||
      menu === 'agendadas' ||
      menu === 'historico' ||
      menu === 'prontuarios' ||
      menu === 'anamnese'
    ) {
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

  const clearAllFilters = () => {
    setTagStatus(false);
    setStatusFilter('todos');
    setDoctorFilter('todos');
    setTipoFilter('todos');
    setAnamneseFilter('todos');
    setApplied(null);
    setPage(1);
  };

  const jumpToFilteredTodas = (opts: {
    status?: string;
    doctor?: string;
    tipo?: ConsultTipoFilter;
    anam?: 'todos' | 'ok' | 'pendente';
  }) => {
    setActiveMenu('todas');
    setConsultasOpen(true);
    setTagStatus(false);
    setStatusFilter(opts.status ?? 'todos');
    if (opts.doctor !== undefined) setDoctorFilter(opts.doctor);
    if (opts.tipo !== undefined) setTipoFilter(opts.tipo);
    if (opts.anam !== undefined) setAnamneseFilter(opts.anam);
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

  const isTableView =
    activeMenu === 'todas' ||
    activeMenu === 'acompanhar' ||
    activeMenu === 'agendadas' ||
    activeMenu === 'historico';

  return (
    <div className="max-w-[1460px] mx-auto space-y-4">
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden grid grid-cols-1 lg:grid-cols-[228px_minmax(0,1fr)] shadow-xs">
        {/* Left Navigation matching ClickCannabis Consultas ERP */}
        <nav
          aria-label="Menu interno de consultas"
          className="border-b lg:border-b-0 lg:border-r border-[var(--line)] p-3 flex flex-col gap-0.5 text-xs bg-[var(--surface)]"
        >
          <button
            type="button"
            onClick={() => selectMenu('home')}
            className={`flex items-center gap-2.5 text-left px-3 py-2 rounded-lg font-medium transition-colors ${
              activeMenu === 'home'
                ? 'bg-[var(--accent-soft)] font-bold text-[var(--ink)]'
                : 'hover:bg-[var(--surface-2)] text-[var(--ink)]'
            }`}
          >
            <Home className="h-3.5 w-3.5 text-[var(--muted)]" />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => setConsultasOpen((o) => !o)}
            aria-expanded={consultasOpen}
            className={`flex items-center justify-between px-3 py-2 rounded-lg font-bold transition-colors ${
              ['todas', 'acompanhar', 'agendadas', 'historico', 'prontuarios', 'anamnese'].includes(
                activeMenu
              )
                ? 'bg-[var(--surface-2)] text-[var(--ink)]'
                : 'hover:bg-[var(--surface-2)]'
            }`}
          >
            <span className="inline-flex items-center gap-2.5">
              <FileText className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>Consultas</span>
            </span>
            {consultasOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>

          {consultasOpen && (
            <div className="ml-3 pl-2.5 border-l border-[var(--line)] flex flex-col gap-0.5 my-1">
              {(
                [
                  ['todas', 'Todas as consultas', 'todas-consultas'],
                  ['acompanhar', 'Acompanhar', undefined],
                  ['agendadas', 'Consultas Agendadas', undefined],
                  ['historico', 'Histórico de consultas', undefined],
                  ['prontuarios', 'Prontuários', undefined],
                  ['anamnese', 'Anamnese', undefined],
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
            onClick={() => selectMenu('dashboard')}
            className={`flex items-center gap-2.5 text-left px-3 py-2 rounded-lg font-medium transition-colors ${
              activeMenu === 'dashboard'
                ? 'bg-[var(--accent-soft)] font-bold text-[var(--ink)]'
                : 'hover:bg-[var(--surface-2)] text-[var(--ink)]'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5 text-[var(--muted)]" />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => selectMenu('medicos')}
            className={`flex items-center gap-2.5 text-left px-3 py-2 rounded-lg font-medium transition-colors ${
              activeMenu === 'medicos'
                ? 'bg-[var(--accent-soft)] font-bold text-[var(--ink)]'
                : 'hover:bg-[var(--surface-2)] text-[var(--ink)]'
            }`}
          >
            <Stethoscope className="h-3.5 w-3.5 text-[var(--muted)]" />
            <span>Médicos</span>
          </button>

          <button
            type="button"
            onClick={() => onGoView('crm')}
            className="flex items-center gap-2.5 text-left px-3 py-2 rounded-lg hover:bg-[var(--surface-2)] font-medium"
          >
            <LayoutGrid className="h-3.5 w-3.5 text-[var(--muted)]" />
            <span>CRM</span>
          </button>

          <button
            type="button"
            onClick={() => selectMenu('cms')}
            className={`flex items-center gap-2.5 text-left px-3 py-2 rounded-lg font-medium transition-colors ${
              activeMenu === 'cms'
                ? 'bg-[var(--accent-soft)] font-bold text-[var(--ink)]'
                : 'hover:bg-[var(--surface-2)] text-[var(--ink)]'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5 text-[var(--muted)]" />
            <span>CMS</span>
          </button>

          <button
            type="button"
            onClick={() => selectMenu('financeiro')}
            className={`flex items-center gap-2.5 text-left px-3 py-2 rounded-lg font-medium transition-colors ${
              activeMenu === 'financeiro'
                ? 'bg-[var(--accent-soft)] font-bold text-[var(--ink)]'
                : 'hover:bg-[var(--surface-2)] text-[var(--ink)]'
            }`}
          >
            <CreditCard className="h-3.5 w-3.5 text-[var(--muted)]" />
            <span>Financeiro</span>
          </button>

          <div className="mt-3 pt-3 border-t border-[var(--line)] space-y-1">
            {onOpenQuickSim && (
              <button
                type="button"
                onClick={() => onOpenQuickSim('confirmacao')}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--accent)] font-semibold text-left"
              >
                <Bot className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                <span>Simular Confirmação</span>
              </button>
            )}
            <button
              type="button"
              onClick={onStartConfirmTour}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] font-semibold text-left hover:brightness-105"
            >
              <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
              <span>Passo a passo Confirmação</span>
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <section className="p-4 md:p-6 space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[var(--muted)]">{meta.breadcrumb}</p>
            <div className="flex items-center gap-2 flex-wrap">
              {activeMenu !== 'todas' && (
                <button
                  type="button"
                  onClick={() => selectMenu('todas')}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
                >
                  Ir para Todas as consultas
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setAgendaDoc(doctorFilter !== 'todos' ? doctorFilter : allDoctors[0] || MEDS[0]);
                  setAgendaModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:border-[var(--accent)] whitespace-nowrap"
              >
                <Settings className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span>Configurar agenda</span>
              </button>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-[var(--ink)]">{meta.title}</h1>
            <p className="text-xs text-[var(--muted)] mt-0.5">{meta.subtitle}</p>
          </div>

          {/* 4 Clickable KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => selectMenu('medicos')}
              title="Ver horários livres de todos os médicos"
              className="text-left rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 hover:border-[var(--accent)] transition-colors"
            >
              <strong className="font-display text-2xl tabular-nums block text-[var(--ink)]">
                {stats.freeSlots}
              </strong>
              <span className="text-xs font-medium text-[var(--muted)] block mt-0.5">
                Horários livres
              </span>
              <span className="text-[11px] text-[var(--muted)] block font-mono-num mt-1">
                Atualizado às {nowTime()}
              </span>
            </button>

            <button
              type="button"
              onClick={() => jumpToFilteredTodas({ status: 'Confirmada' })}
              title="Filtrar consultas confirmadas"
              className="text-left rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 hover:border-[var(--accent)] transition-colors"
            >
              <strong className="font-display text-2xl tabular-nums block text-[var(--ink)]">
                {stats.conf}
              </strong>
              <span className="text-xs font-medium text-[var(--muted)] block mt-0.5">
                Confirmadas / Reagendadas{' '}
                <span className="text-[11px] font-mono-num">({stats.reag} reagendadas)</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => jumpToFilteredTodas({ status: 'Realizada' })}
              title="Filtrar consultas realizadas"
              className="text-left rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 hover:border-[var(--accent)] transition-colors"
            >
              <strong className="font-display text-2xl tabular-nums block text-[var(--ink)]">
                {stats.real}
              </strong>
              <span className="text-xs font-medium text-[var(--muted)] block mt-0.5">
                Realizadas
              </span>
            </button>

            <div className="relative rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 hover:border-[var(--accent)] transition-colors">
              <button
                type="button"
                onClick={() => jumpToFilteredTodas({ status: card4Mode })}
                className="w-full text-left"
              >
                <strong className="font-display text-2xl tabular-nums block text-[var(--ink)]">
                  {card4Mode === 'Não realizada'
                    ? stats.nao
                    : card4Mode === 'Cancelada'
                      ? stats.canc
                      : stats.pend}
                </strong>
              </button>
              <div className="flex items-center justify-between gap-1 mt-0.5">
                <button
                  type="button"
                  onClick={() => setCard4DropdownOpen((o) => !o)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  <span>
                    {card4Mode === 'Não realizada'
                      ? 'Não realizadas'
                      : card4Mode === 'Cancelada'
                        ? 'Canceladas'
                        : 'Pendentes'}
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              {card4DropdownOpen && (
                <div className="absolute right-2 top-full mt-1 z-30 w-40 rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xl p-1 text-xs">
                  {(['Não realizada', 'Cancelada', 'Pendente'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        setCard4Mode(st);
                        setCard4DropdownOpen(false);
                        jumpToFilteredTodas({ status: st });
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[var(--accent-soft)] font-medium"
                    >
                      {st === 'Não realizada'
                        ? `Não realizadas (${stats.nao})`
                        : st === 'Cancelada'
                          ? `Canceladas (${stats.canc})`
                          : `Pendentes (${stats.pend})`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* HOME SUBVIEW */}
          {activeMenu === 'home' && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(
                  [
                    ['todas', 'Todas as consultas', 'Filtrar médico, tipo e abrir chats', Home],
                    ['acompanhar', 'Acompanhar', 'Monitorar acessos e anamneses pendentes', Clock],
                    ['agendadas', 'Consultas Agendadas', 'Confirmar rotina 4.1 a 4.4', Calendar],
                    ['anamnese', 'Anamnese', 'Checar preenchimento clínico', FileText],
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
                      <button
                        type="button"
                        onClick={() => setActiveModal({ type: 'historico', rowId: r.id })}
                        className="flex items-center gap-2.5 min-w-[200px] text-left hover:opacity-80"
                      >
                        <span className="h-8 w-8 rounded-full bg-[var(--sunk)] text-[var(--accent)] font-bold text-[10px] grid place-items-center shrink-0">
                          {initials(r.nome)}
                        </span>
                        <div>
                          <strong className="block">{r.nome}</strong>
                          <span className="text-[11px] text-[var(--muted)]">
                            {r.medico} · {r.dataBr} às {r.hora}
                          </span>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setActiveModal({ type: 'status', rowId: r.id })}
                        >
                          <StatusBadge tone={getConsultationTone(r.status)}>{r.status}</StatusBadge>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setProntuarioId(r.id);
                            selectMenu('prontuarios');
                          }}
                        >
                          <StatusBadge tone={getEffectiveAnamnese(r) ? 'ok' : 'bad'}>
                            {getEffectiveAnamnese(r) ? 'Anamnese OK' : 'Sem anamnese'}
                          </StatusBadge>
                        </button>
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

          {/* PRONTUÁRIOS & ANAMNESE SUBVIEWS */}
          {(activeMenu === 'prontuarios' || activeMenu === 'anamnese') && (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
              <div className="space-y-3 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold">
                    {activeMenu === 'anamnese'
                      ? 'Controle de Anamnese Pré-Consulta'
                      : 'Prontuários de pacientes'}
                  </h3>
                  <div className="flex-1" />
                  <select
                    value={anamneseFilter}
                    onChange={(e) => {
                      setAnamneseFilter(e.target.value as 'todos' | 'ok' | 'pendente');
                      setPage(1);
                    }}
                    aria-label="Filtrar por status da anamnese"
                    className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs"
                  >
                    <option value="todos">Todas anamneses</option>
                    <option value="ok">Preenchidas</option>
                    <option value="pendente">Pendentes</option>
                  </select>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Pesquisar paciente ou médico"
                    aria-label="Pesquisar prontuários"
                    className="w-56 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
                  <table className="w-full min-w-[600px] text-xs border-collapse">
                    <thead>
                      <tr className="bg-[var(--surface-2)] text-[var(--muted)] uppercase tracking-wider text-[10px] border-b border-[var(--line)]">
                        <th className="text-left px-3 py-2.5">Paciente</th>
                        <th className="text-left px-3 py-2.5">Médico</th>
                        <th className="text-left px-3 py-2.5">Tipo</th>
                        <th className="text-left px-3 py-2.5">Anamnese</th>
                        <th className="text-right px-3 py-2.5">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {slice.map((r) => {
                        const anamOk = getEffectiveAnamnese(r);
                        const isSel = selectedProntuario?.id === r.id;
                        const tipoInfo = getTipoDisplay(r.tipo);
                        return (
                          <tr
                            key={r.id}
                            onClick={() => setProntuarioId(r.id)}
                            className={`cursor-pointer ${
                              isSel ? 'bg-[var(--accent-soft)]/50' : 'hover:bg-[var(--surface-2)]'
                            }`}
                          >
                            <td className="px-3 py-2.5">
                              <strong className="block">{r.nome}</strong>
                              <span className="text-[11px] text-[var(--muted)] font-mono-num">
                                {r.proc}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">{r.medico}</td>
                            <td className="px-3 py-2.5">{tipoInfo.main}</td>
                            <td className="px-3 py-2.5">
                              <StatusBadge tone={anamOk ? 'ok' : 'bad'}>
                                {anamOk ? 'Preenchida' : 'Não preenchida'}
                              </StatusBadge>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProntuarioId(r.id);
                                }}
                                className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 font-semibold hover:border-[var(--accent)] whitespace-nowrap"
                              >
                                Abrir ficha
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
                      {getEffectiveAnamnese(selectedProntuario) ? 'Preenchida' : 'Pendente'}
                    </StatusBadge>
                  </div>

                  <div className="space-y-1.5">
                    <p>
                      <strong className="text-[var(--muted)]">Médico:</strong>{' '}
                      {selectedProntuario.medico}
                    </p>
                    <p>
                      <strong className="text-[var(--muted)]">Tipo de consulta:</strong>{' '}
                      {getTipoDisplay(selectedProntuario.tipo).main} (
                      {getTipoDisplay(selectedProntuario.tipo).sub})
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

          {/* DASHBOARD SUBVIEW */}
          {activeMenu === 'dashboard' && (
            <div className="space-y-4 text-xs">
              <div className="grid md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => jumpToFilteredTodas({ tipo: 'primeira' })}
                  className="text-left rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4 hover:border-[var(--accent)]"
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Primeira vez
                  </span>
                  <strong className="font-display text-2xl block mt-1">
                    {rows.filter((r) => matchesTipoFilter(r.tipo, 'primeira')).length}
                  </strong>
                  <span className="text-[11px] text-[var(--accent)] font-semibold mt-1 inline-block">
                    Clique para filtrar →
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => jumpToFilteredTodas({ tipo: 'recorrente' })}
                  className="text-left rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4 hover:border-[var(--accent)]"
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Recorrente (2ª vez+)
                  </span>
                  <strong className="font-display text-2xl block mt-1">
                    {rows.filter((r) => matchesTipoFilter(r.tipo, 'recorrente')).length}
                  </strong>
                  <span className="text-[11px] text-[var(--accent)] font-semibold mt-1 inline-block">
                    Clique para filtrar →
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => jumpToFilteredTodas({ anam: 'pendente' })}
                  className="text-left rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4 hover:border-[var(--accent)]"
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Anamnese pendente
                  </span>
                  <strong className="font-display text-2xl block mt-1 text-amber-600 dark:text-amber-300">
                    {stats.semAnamnese}
                  </strong>
                  <span className="text-[11px] text-[var(--accent)] font-semibold mt-1 inline-block">
                    Clique para filtrar →
                  </span>
                </button>
              </div>

              <div className="rounded-xl border border-[var(--line)] overflow-hidden">
                <div className="px-4 py-2.5 bg-[var(--surface-2)] border-b border-[var(--line)] font-bold uppercase tracking-wider text-[10px] text-[var(--muted)]">
                  Volume por Médico (clique para filtrar em Todas as consultas)
                </div>
                <div className="divide-y divide-[var(--line)]">
                  {allDoctors.map((doc) => {
                    const docRows = rows.filter((r) => r.medico === doc);
                    const prim = docRows.filter((r) => matchesTipoFilter(r.tipo, 'primeira')).length;
                    const rec = docRows.filter((r) => matchesTipoFilter(r.tipo, 'recorrente')).length;
                    return (
                      <button
                        key={doc}
                        type="button"
                        onClick={() => jumpToFilteredTodas({ doctor: doc })}
                        className="w-full px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-[var(--surface-2)] text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="h-7 w-7 rounded-full bg-[var(--sunk)] text-[var(--accent)] font-bold text-[10px] grid place-items-center shrink-0">
                            {initials(doc)}
                          </span>
                          <strong className="text-[var(--ink)]">{doc}</strong>
                        </div>
                        <div className="flex items-center gap-3 font-mono-num text-[11px] text-[var(--muted)]">
                          <span>{prim} primeira</span>
                          <span>·</span>
                          <span>{rec} recorrente</span>
                          <span className="font-bold text-[var(--accent)]">
                            {docRows.length} total →
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* MÉDICOS SUBVIEW */}
          {activeMenu === 'medicos' && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {allDoctors.map((doc) => {
                const docSlots = getDoctorSlotsForDate(doc, todayKey);
                const docCount = rows.filter((r) => r.medico === doc).length;
                return (
                  <div
                    key={doc}
                    className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="h-8 w-8 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-bold text-[11px] grid place-items-center shrink-0">
                          {initials(doc)}
                        </span>
                        <div className="min-w-0">
                          <strong className="block truncate text-[var(--ink)]">{doc}</strong>
                          <span className="text-[11px] text-[var(--muted)]">
                            {docCount} consultas · {docSlots.slots.length} horários hoje
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {docSlots.slots.slice(0, 6).map((s) => (
                        <span
                          key={s}
                          className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 font-mono-num text-[11px]"
                        >
                          {s}
                        </span>
                      ))}
                      {docSlots.slots.length > 6 && (
                        <span className="text-[11px] text-[var(--muted)] px-1">
                          +{docSlots.slots.length - 6}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => jumpToFilteredTodas({ doctor: doc })}
                        className="flex-1 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] py-1.5 font-semibold hover:brightness-105"
                      >
                        Filtrar consultas
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAgendaDoc(doc);
                          setAgendaModalOpen(true);
                        }}
                        className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 font-semibold hover:border-[var(--accent)]"
                      >
                        Agenda
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* CMS SUBVIEW */}
          {activeMenu === 'cms' && (
            <div className="grid md:grid-cols-2 gap-3 text-xs">
              {[
                {
                  title: 'Confirmação (Lembrete 07:00)',
                  text: 'Olá! Passando para confirmar sua consulta hoje na ClickCannabis. Responda SIM para confirmar sua presença.',
                },
                {
                  title: 'Link de Acesso (10 min antes)',
                  text: 'Sua consulta começa em 10 minutos! Acesse o link da sala com câmera e microfone liberados (tolerância de 5 min).',
                },
                {
                  title: 'Anamnese Pendente',
                  text: 'Identificamos que sua anamnese pré-consulta ainda está pendente. Preencha pelo link enviado para o médico avaliar seu caso.',
                },
                {
                  title: 'Regra das 2 horas (/importante)',
                  text: 'Reagendamentos sem custo podem ser solicitados com pelo menos 2h de antecedência. Tolerância de entrada na sala: 5 minutos.',
                },
              ].map((tpl) => (
                <div
                  key={tpl.title}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm text-[var(--ink)]">{tpl.title}</strong>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(tpl.text).catch(() => {});
                        onToast(`Template "${tpl.title}" copiado.`);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 font-semibold hover:border-[var(--accent)]"
                    >
                      <Copy className="h-3 w-3" />
                      Copiar
                    </button>
                  </div>
                  <p className="text-[var(--muted)] leading-relaxed">{tpl.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* FINANCEIRO SUBVIEW */}
          {activeMenu === 'financeiro' && (
            <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
              <table className="w-full min-w-[640px] text-xs border-collapse">
                <thead>
                  <tr className="bg-[var(--surface-2)] text-[var(--muted)] uppercase tracking-wider text-[10px] border-b border-[var(--line)]">
                    <th className="text-left px-3 py-2.5">Paciente</th>
                    <th className="text-left px-3 py-2.5">Médico</th>
                    <th className="text-left px-3 py-2.5">Tipo</th>
                    <th className="text-left px-3 py-2.5">Valor</th>
                    <th className="text-right px-3 py-2.5">Nota Fiscal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {slice.map((r) => {
                    const isFree = norm(r.tipo).includes('gratuit');
                    return (
                      <tr key={r.id} className="hover:bg-[var(--surface-2)]">
                        <td className="px-3 py-2.5">
                          <strong className="block">{r.nome}</strong>
                          <span className="text-[11px] text-[var(--muted)] font-mono-num">
                            {r.proc}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">{r.medico}</td>
                        <td className="px-3 py-2.5">{getTipoDisplay(r.tipo).main}</td>
                        <td className="px-3 py-2.5 font-mono-num font-semibold">
                          {isFree ? 'R$ 0,00' : 'R$ 89,00'}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => setActiveModal({ type: 'nf', rowId: r.id })}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 font-semibold hover:border-[var(--accent)]"
                          >
                            <Receipt className="h-3.5 w-3.5 text-[var(--accent)]" />
                            Emitir / Enviar NF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TABLE VIEWS: TODAS / ACOMPANHAR / AGENDADAS / HISTORICO */}
          {isTableView && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--ink)]">
                  {activeMenu === 'todas' ? 'Todas as consultas' : meta.title}
                </h3>
                <div className="flex-1" />

                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Pesquise pacientes ou médico"
                  aria-label="Pesquise pacientes"
                  className="w-56 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--accent)]"
                />

                {/* FILTER POPOVER: MÉDICO + TIPO DE CONSULTA + STATUS */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterOpen((o) => !o);
                      setPanelOpen(false);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      filterOpen || doctorFilter !== 'todos' || tipoFilter !== 'todos'
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--accent)]'
                    }`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Filtrar</span>
                    {activeFilterCount > 0 && (
                      <span className="rounded-full bg-[var(--accent)] text-[var(--accent-ink)] px-1.5 py-0.2 text-[10px] font-bold">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  {filterOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setFilterOpen(false)}
                      />
                      <div className="absolute right-0 top-full mt-2 w-[330px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl p-4 z-30 space-y-3.5 text-xs">
                        <div className="flex items-center justify-between">
                          <strong className="text-sm">Filtrar consultas</strong>
                          <button
                            type="button"
                            onClick={() => setFilterOpen(false)}
                            aria-label="Fechar filtros"
                            className="h-7 w-7 rounded-lg border border-[var(--line)] grid place-items-center"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          <label htmlFor="flt-medico" className="block font-bold text-[var(--ink)]">
                            Médico
                          </label>
                          <select
                            id="flt-medico"
                            value={doctorFilter}
                            onChange={(e) => {
                              setDoctorFilter(e.target.value);
                              setPage(1);
                            }}
                            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
                          >
                            <option value="todos">Todos os médicos</option>
                            {allDoctors.map((doc) => (
                              <option key={doc} value={doc}>
                                {doc}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <span className="block font-bold text-[var(--ink)]">Tipo de consulta</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(
                              [
                                ['todos', 'Todos os tipos'],
                                ['primeira', 'Primeira vez'],
                                ['recorrente', 'Recorrente'],
                                ['gratuita', 'Gratuita'],
                              ] as Array<[ConsultTipoFilter, string]>
                            ).map(([key, label]) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => {
                                  setTipoFilter(key);
                                  setPage(1);
                                }}
                                className={`rounded-lg border px-2.5 py-1.5 font-semibold text-left transition-colors ${
                                  tipoFilter === key
                                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                                    : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] hover:border-[var(--accent)]'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {activeMenu === 'todas' && (
                          <div className="space-y-1.5">
                            <label htmlFor="flt-status" className="block font-bold text-[var(--ink)]">
                              Status
                            </label>
                            <select
                              id="flt-status"
                              value={
                                statusFilter !== 'todos'
                                  ? statusFilter
                                  : tagStatus
                                    ? 'Confirmada'
                                    : 'todos'
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                setTagStatus(false);
                                setStatusFilter(val);
                                setPage(1);
                              }}
                              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink)]"
                            >
                              <option value="todos">Todos os status</option>
                              <option value="Confirmada">Confirmada</option>
                              <option value="Pendente">Pendente</option>
                              <option value="Reagendada">Reagendada</option>
                              <option value="Realizada">Realizada</option>
                              <option value="Não realizada">Não realizada</option>
                              <option value="Cancelada">Cancelada</option>
                            </select>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <span className="block font-bold text-[var(--ink)]">Anamnese</span>
                          <div className="flex gap-1.5">
                            {(
                              [
                                ['todos', 'Todas'],
                                ['ok', 'Preenchida'],
                                ['pendente', 'Não preenchida'],
                              ] as const
                            ).map(([k, lbl]) => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => {
                                  setAnamneseFilter(k);
                                  setPage(1);
                                }}
                                className={`flex-1 rounded-lg border px-2 py-1.5 font-semibold ${
                                  anamneseFilter === k
                                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                                    : 'border-[var(--line)] bg-[var(--surface-2)]'
                                }`}
                              >
                                {lbl}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              clearAllFilters();
                              setFilterOpen(false);
                            }}
                            className="flex-1 rounded-xl border border-[var(--line)] py-2 font-semibold hover:border-[var(--accent)]"
                          >
                            Limpar tudo
                          </button>
                          <button
                            type="button"
                            onClick={() => setFilterOpen(false)}
                            className="flex-1 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] py-2 font-semibold"
                          >
                            Aplicar
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* CALENDAR DATE FILTER BUTTON */}
                <div className="relative">
                  <button
                    type="button"
                    data-coach="btn-data"
                    onClick={() => {
                      setPanelOpen((o) => !o);
                      setFilterOpen(false);
                    }}
                    aria-label="Filtrar por data e horário"
                    className={`h-8 w-8 rounded-xl border grid place-items-center transition-colors ${
                      applied
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]'
                    }`}
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
              </div>

              {/* ACTIVE FILTER CHIPS */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {activeMenu === 'todas' && tagStatus && statusFilter === 'todos' && (
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
                {activeMenu === 'todas' && statusFilter !== 'todos' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 font-semibold">
                    Status: {statusFilter}
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter('todos');
                        setPage(1);
                      }}
                      aria-label="Remover filtro de status"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
                {doctorFilter !== 'todos' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 font-semibold">
                    Médico: {doctorFilter}
                    <button
                      type="button"
                      onClick={() => {
                        setDoctorFilter('todos');
                        setPage(1);
                      }}
                      aria-label="Remover filtro de médico"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
                {tipoFilter !== 'todos' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 font-semibold">
                    Tipo:{' '}
                    {tipoFilter === 'primeira'
                      ? 'Primeira vez'
                      : tipoFilter === 'recorrente'
                        ? 'Recorrente'
                        : 'Gratuita'}
                    <button
                      type="button"
                      onClick={() => {
                        setTipoFilter('todos');
                        setPage(1);
                      }}
                      aria-label="Remover filtro de tipo de consulta"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
                {anamneseFilter !== 'todos' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 font-semibold">
                    Anamnese: {anamneseFilter === 'ok' ? 'Preenchida' : 'Pendente'}
                    <button
                      type="button"
                      onClick={() => {
                        setAnamneseFilter('todos');
                        setPage(1);
                      }}
                      aria-label="Remover filtro de anamnese"
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
                {activeFilterCount === 0 && (
                  <span className="text-[var(--muted)]">
                    Exibindo todas ({filteredRows.length}) — clique em Filtrar para médico ou tipo
                  </span>
                )}
              </div>

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
                  {(
                    ['todos', 'Realizada', 'Não realizada', 'Reagendada', 'Cancelada'] as const
                  ).map((k) => (
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

              {/* MAIN TABLE MATCHING SCREENSHOT & FULL CLICKABILITY */}
              <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
                <table className="w-full min-w-[780px] text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-2)] text-[var(--muted)] border-b border-[var(--line)] font-semibold">
                      <th className="text-left px-3 py-2.5">Paciente</th>
                      <th className="text-left px-3 py-2.5">Médico</th>
                      <th className="text-left px-3 py-2.5">Tipo de consulta</th>
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
                        const tipoInfo = getTipoDisplay(r.tipo);
                        return (
                          <tr key={r.id} className="hover:bg-[var(--surface-2)]/70">
                            <td className="px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => setActiveModal({ type: 'historico', rowId: r.id })}
                                title="Ver histórico e detalhes do paciente"
                                className="flex items-center gap-2.5 text-left group"
                              >
                                <span className="h-7 w-7 rounded-full bg-[var(--sunk)] text-[var(--accent)] font-bold text-[10px] grid place-items-center shrink-0">
                                  {initials(r.nome)}
                                </span>
                                <div>
                                  <strong className="block group-hover:text-[var(--accent)] transition-colors">
                                    {r.nome}
                                  </strong>
                                  <span className="text-[11px] text-[var(--muted)] font-mono-num">
                                    {r.proc}
                                  </span>
                                </div>
                              </button>
                            </td>

                            <td className="px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => setActiveModal({ type: 'medico', rowId: r.id })}
                                title="Clique para alterar ou consultar médico"
                                className="flex items-center gap-2 text-left hover:text-[var(--accent)] transition-colors"
                              >
                                <span className="h-6 w-6 rounded-full bg-[var(--surface-2)] border border-[var(--line)] text-[var(--muted)] font-bold text-[10px] grid place-items-center shrink-0">
                                  {initials(r.medico)}
                                </span>
                                <span className="truncate max-w-[175px]">{r.medico}</span>
                              </button>
                            </td>

                            <td className="px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextTipo: ConsultTipoFilter =
                                    tipoFilter === tipoInfo.kind ? 'todos' : tipoInfo.kind;
                                  setTipoFilter(nextTipo);
                                  setPage(1);
                                }}
                                title="Clique para filtrar por este tipo de consulta"
                                className="inline-flex items-center gap-1.5 text-left hover:text-[var(--accent)] transition-colors"
                              >
                                {tipoInfo.kind === 'primeira' ? (
                                  <UserPlus className="h-3.5 w-3.5 text-[var(--muted)] shrink-0" />
                                ) : (
                                  <Repeat className="h-3.5 w-3.5 text-[var(--muted)] shrink-0" />
                                )}
                                <span>
                                  <span className="font-medium block">{tipoInfo.main}</span>
                                  <span className="text-[10px] text-[var(--muted)] block">
                                    {tipoInfo.sub}
                                  </span>
                                </span>
                              </button>
                            </td>

                            <td className="px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => setActiveModal({ type: 'status', rowId: r.id })}
                                title="Clique para alterar o status"
                                className="hover:opacity-85 transition-opacity"
                              >
                                <StatusBadge tone={getConsultationTone(r.status)}>
                                  {r.status}
                                </StatusBadge>
                              </button>
                            </td>

                            <td className="px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => setActiveModal({ type: 'reagendar', rowId: r.id })}
                                title="Clique para reagendar horário"
                                className="font-mono-num hover:text-[var(--accent)] transition-colors whitespace-nowrap"
                              >
                                {r.dataBr} às {r.hora}
                              </button>
                            </td>

                            <td className="px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setProntuarioId(r.id);
                                  selectMenu('anamnese');
                                }}
                                title="Abrir ficha de anamnese"
                                className="hover:opacity-85 transition-opacity"
                              >
                                <StatusBadge tone={anamOk ? 'ok' : 'bad'}>
                                  {anamOk ? 'Preenchida' : 'Não preenchida'}
                                </StatusBadge>
                              </button>
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
                                            'Esta consulta não possui chat ativo vinculado — use Simulador para praticar.'
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
                                        selectMenu('anamnese');
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
                                          navigator.clipboard.writeText(medLink).catch(() => {});
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

      {/* CONFIGURAR AGENDA MODAL */}
      {agendaModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[rgba(6,20,12,0.52)] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAgendaModalOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Configurar agenda médica"
        >
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl w-full max-w-[540px] overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 border-b border-[var(--line)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center shrink-0">
                  <Settings className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Configurar agenda médica</h3>
                  <p className="text-xs text-[var(--muted)]">
                    A agenda abre no dia (Hoje). Datas futuras dependem de liberação da Liderança.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAgendaModalOpen(false)}
                aria-label="Fechar modal"
                className="h-8 w-8 rounded-lg border border-[var(--line)] grid place-items-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label htmlFor="cfg-agenda-doc" className="block font-bold">
                  Selecionar médico
                </label>
                <select
                  id="cfg-agenda-doc"
                  value={agendaDoc}
                  onChange={(e) => setAgendaDoc(e.target.value)}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink)]"
                >
                  {allDoctors.map((doc) => (
                    <option key={doc} value={doc}>
                      {doc}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <span className="block font-bold">Horários livres hoje ({agendaDoc})</span>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {getDoctorSlotsForDate(agendaDoc, todayKey).slots.map((slot) => (
                    <span
                      key={slot}
                      className="rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] py-1.5 text-center font-mono-num font-semibold"
                    >
                      {slot}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-[var(--line)] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAgendaModalOpen(false);
                  jumpToFilteredTodas({ doctor: agendaDoc });
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-4 py-2 text-xs font-semibold hover:border-[var(--accent)]"
              >
                <Users className="h-3.5 w-3.5" />
                Ver consultas de {agendaDoc.split(' ')[0]}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAgendaModalOpen(false);
                  onToast(`Agenda de ${agendaDoc} verificada.`);
                }}
                className="rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2 text-xs font-semibold"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

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
            selectMenu('anamnese');
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
