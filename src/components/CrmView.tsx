import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  FolderOpen,
  Loader2,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  Phone,
  RefreshCw,
  RotateCw,
  Search,
  SlidersHorizontal,
  UserX,
  X,
  XCircle,
} from 'lucide-react';
import { MEDS } from '../data/defaults';
import type { PatientCase } from '../types';
import { initials, norm, nowTime } from '../utils/helpers';

export type CrmCardStatus =
  | 'Paciente faltou'
  | 'Concluída'
  | 'Finalizada'
  | 'Não realizada'
  | 'Em andamento'
  | 'Aguardando'
  | 'Aguardando paciente'
  | 'Aguardando médico'
  | 'Ninguém entrou'
  | 'Confirmada'
  | 'Reagendado';

export type CrmColumnId = 'anteriores' | 'em_andamento' | 'proximas';

export type CrmFilterConsultaOption =
  | 'Aguardando'
  | 'Aguardando paciente'
  | 'Aguardando médico'
  | 'Ninguém entrou'
  | 'Em andamento'
  | 'Finalizada'
  | 'Não realizada';

const CONSULTA_FILTER_OPTIONS: CrmFilterConsultaOption[] = [
  'Aguardando',
  'Aguardando paciente',
  'Aguardando médico',
  'Ninguém entrou',
  'Em andamento',
  'Finalizada',
  'Não realizada',
];

interface CrmCardItem {
  id: string;
  patient: PatientCase;
  column: CrmColumnId;
  crmStatus: CrmCardStatus;
  hasRecurrenceBadge?: boolean;
}

interface CrmViewProps {
  patients: PatientCase[];
  onOpenPatientChat: (patientId: string) => void;
  onOpenNegotiation?: (patientId: string) => void;
  onBackToSim: () => void;
  onOpenQuickSim?: (deptKey?: string, patientId?: string) => void;
  onToast?: (msg: string) => void;
}

function getColumnForStatus(status: CrmCardStatus): CrmColumnId {
  if (
    status === 'Paciente faltou' ||
    status === 'Concluída' ||
    status === 'Finalizada' ||
    status === 'Não realizada'
  ) {
    return 'anteriores';
  }
  if (status === 'Confirmada' || status === 'Reagendado') {
    return 'proximas';
  }
  return 'em_andamento';
}

function matchesConsultaFilter(
  cardStatus: CrmCardStatus,
  selected: CrmFilterConsultaOption[]
): boolean {
  if (!selected.length) return true;
  return selected.some((opt) => {
    if (opt === 'Finalizada') {
      return cardStatus === 'Finalizada' || cardStatus === 'Concluída';
    }
    if (opt === 'Não realizada') {
      return cardStatus === 'Não realizada' || cardStatus === 'Paciente faltou';
    }
    return cardStatus === opt;
  });
}

function deriveInitialStatus(p: PatientCase): CrmCardStatus | null {
  if (p.key === 'andamento' && p.crm) {
    if (p.crm === 'Faltou') return 'Paciente faltou';
    if (p.crm === 'Em andamento') return 'Em andamento';
    if (p.sc.id === 'nao_acessa') return 'Aguardando paciente';
    if (p.sc.id === 'atrasado_medico') return 'Aguardando';
    if (p.sc.id === 'quer_remarcar') return 'Aguardando médico';
    return 'Aguardando';
  }
  if (p.key === 'confirmacao') {
    if (p.k % 7 === 0) return 'Concluída';
    if (p.k % 7 === 1) return 'Não realizada';
    if (p.k % 7 === 2) return 'Ninguém entrou';
    if (p.k % 7 === 3) return 'Confirmada';
    if (p.k % 7 === 4) return 'Confirmada';
    if (p.k % 7 === 5) return 'Aguardando médico';
    return 'Confirmada';
  }
  if (p.key === 'reagendamento') {
    if (p.k % 3 === 0) return 'Reagendado';
    if (p.k % 3 === 1) return 'Concluída';
    return null;
  }
  return null;
}

function StatusBadgePill({ status, hora }: { status: CrmCardStatus; hora: string }) {
  switch (status) {
    case 'Paciente faltou':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
          <XCircle className="h-3 w-3 shrink-0" />
          Paciente faltou
        </span>
      );
    case 'Não realizada':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
          <AlertCircle className="h-3 w-3 shrink-0" />
          Não realizada
        </span>
      );
    case 'Concluída':
    case 'Finalizada':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
          <Check className="h-3 w-3 shrink-0" />
          {status}
        </span>
      );
    case 'Em andamento':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
          <Loader2 className="h-3 w-3 shrink-0" />
          Em andamento
        </span>
      );
    case 'Aguardando':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap font-mono-num">
          <Clock className="h-3 w-3 shrink-0" />
          Aguardando · {hora}
        </span>
      );
    case 'Aguardando paciente':
    case 'Aguardando médico':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
          <Clock className="h-3 w-3 shrink-0" />
          {status}
        </span>
      );
    case 'Ninguém entrou':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
          <UserX className="h-3 w-3 shrink-0" />
          Ninguém entrou
        </span>
      );
    case 'Confirmada':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
          <Check className="h-3 w-3 shrink-0" />
          Confirmada
        </span>
      );
    case 'Reagendado':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
          <RotateCw className="h-3 w-3 shrink-0" />
          Reagendado
        </span>
      );
  }
}

function PatientLeadIcon({ status }: { status: CrmCardStatus }) {
  if (
    status === 'Paciente faltou' ||
    status === 'Não realizada' ||
    status === 'Ninguém entrou'
  ) {
    return <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />;
  }
  if (
    status === 'Aguardando' ||
    status === 'Aguardando paciente' ||
    status === 'Aguardando médico'
  ) {
    return <Loader2 className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  }
  return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />;
}

export function CrmView({
  patients,
  onOpenPatientChat,
  onOpenNegotiation,
  onBackToSim,
  onOpenQuickSim,
  onToast,
}: CrmViewProps) {
  const [query, setQuery] = useState('');
  const [moreId, setMoreId] = useState<string | null>(null);
  const [popId, setPopId] = useState<string | null>(null);
  const [medDrawerPatient, setMedDrawerPatient] = useState<PatientCase | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>(() => {
    const now = new Date();
    return now.toLocaleTimeString('pt-BR', { hour12: false });
  });

  // Overrides locais para simular mudanças de status direto nos cards do CRM
  const [statusOverrides, setStatusOverrides] = useState<Record<string, CrmCardStatus>>({});

  // Filtros separados: topo = apenas Médico; ícone da coluna = apenas Consulta
  const [doctorFilterOpen, setDoctorFilterOpen] = useState(false);
  const [consultaFilterCol, setConsultaFilterCol] = useState<CrmColumnId | null>(null);
  const [appliedConsultas, setAppliedConsultas] = useState<CrmFilterConsultaOption[]>([]);
  const [appliedDoctors, setAppliedDoctors] = useState<string[]>([]);
  const [draftConsultas, setDraftConsultas] = useState<CrmFilterConsultaOption[]>([]);
  const [draftDoctors, setDraftDoctors] = useState<string[]>([]);
  const [doctorQuery, setDoctorQuery] = useState('');
  const doctorFilterRef = useRef<HTMLDivElement | null>(null);
  const consultaFilterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!doctorFilterOpen && !consultaFilterCol) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (doctorFilterOpen && doctorFilterRef.current && !doctorFilterRef.current.contains(target)) {
        setDoctorFilterOpen(false);
      }
      if (consultaFilterCol && consultaFilterRef.current && !consultaFilterRef.current.contains(target)) {
        setConsultaFilterCol(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [doctorFilterOpen, consultaFilterCol]);

  const openDoctorFilter = () => {
    setConsultaFilterCol(null);
    setDraftDoctors(appliedDoctors);
    setDoctorFilterOpen((cur) => !cur);
  };

  const openConsultaFilter = (colId: CrmColumnId) => {
    setDoctorFilterOpen(false);
    setDraftConsultas(appliedConsultas);
    setConsultaFilterCol((cur) => (cur === colId ? null : colId));
  };

  const allDoctors = useMemo(() => {
    const set = new Set<string>(MEDS);
    patients.forEach((p) => {
      if (p.medico) set.add(p.medico);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [patients]);

  const filteredDoctorOptions = useMemo(() => {
    const q = norm(doctorQuery.trim());
    if (!q) return allDoctors;
    return allDoctors.filter((d) => norm(d).includes(q));
  }, [allDoctors, doctorQuery]);

  const allCrmCards = useMemo<CrmCardItem[]>(() => {
    const cards: CrmCardItem[] = [];
    patients.forEach((p) => {
      if (p.isMed) return;
      const baseStatus = deriveInitialStatus(p);
      if (!baseStatus) return;
      const crmStatus = statusOverrides[p.id] || baseStatus;
      cards.push({
        id: p.id,
        patient: p,
        column: getColumnForStatus(crmStatus),
        crmStatus,
        hasRecurrenceBadge: p.tipo === 'Recorrência',
      });
    });
    return cards;
  }, [patients, statusOverrides]);

  const filteredCards = useMemo(() => {
    const qNorm = norm(query.trim());
    return allCrmCards.filter((card) => {
      if (
        qNorm &&
        !norm(`${card.patient.nome} ${card.patient.medico} ${card.patient.proc}`).includes(qNorm)
      ) {
        return false;
      }
      if (!matchesConsultaFilter(card.crmStatus, appliedConsultas)) {
        return false;
      }
      if (appliedDoctors.length && !appliedDoctors.includes(card.patient.medico)) {
        return false;
      }
      return true;
    });
  }, [allCrmCards, query, appliedConsultas, appliedDoctors]);

  const activeCount = useMemo(
    () => allCrmCards.filter((c) => c.column !== 'anteriores').length,
    [allCrmCards]
  );
  const closedCount = useMemo(
    () => allCrmCards.filter((c) => c.column === 'anteriores').length,
    [allCrmCards]
  );

  const activeFilterCount = appliedConsultas.length + appliedDoctors.length;

  const handleRefresh = () => {
    const now = new Date();
    setLastUpdated(now.toLocaleTimeString('pt-BR', { hour12: false }));
    onToast?.('Painel CRM atualizado agora.');
  };

  const handleToggleDraftConsulta = (opt: CrmFilterConsultaOption) => {
    setDraftConsultas((prev) =>
      prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
    );
  };

  const handleToggleDraftDoctor = (doc: string) => {
    setDraftDoctors((prev) =>
      prev.includes(doc) ? prev.filter((x) => x !== doc) : [...prev, doc]
    );
  };

  const handleApplyDoctorFilter = () => {
    setAppliedDoctors(draftDoctors);
    setDoctorFilterOpen(false);
  };

  const handleClearDoctorFilter = () => {
    setDraftDoctors([]);
    setAppliedDoctors([]);
    setDoctorQuery('');
  };

  const handleApplyConsultaFilter = () => {
    setAppliedConsultas(draftConsultas);
    setConsultaFilterCol(null);
  };

  const handleClearConsultaFilter = () => {
    setDraftConsultas([]);
    setAppliedConsultas([]);
  };

  const handleClearFilters = () => {
    setDraftConsultas([]);
    setDraftDoctors([]);
    setAppliedConsultas([]);
    setAppliedDoctors([]);
    setDoctorQuery('');
  };

  const handleCardStatusChange = (card: CrmCardItem, nextStatus: CrmCardStatus) => {
    setStatusOverrides((prev) => ({ ...prev, [card.id]: nextStatus }));
    setLastUpdated(new Date().toLocaleTimeString('pt-BR', { hour12: false }));
    onToast?.(`Status de ${card.patient.nome} alterado para "${nextStatus}".`);
  };

  const COLUMNS: Array<{
    id: CrmColumnId;
    title: string;
    pillClass: string;
  }> = [
    {
      id: 'anteriores',
      title: 'Anteriores',
      pillClass:
        'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    },
    {
      id: 'em_andamento',
      title: 'Em andamento',
      pillClass:
        'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    },
    {
      id: 'proximas',
      title: 'Próximas',
      pillClass:
        'bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
    },
  ];

  return (
    <div className="max-w-[1440px] mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--muted)]">
            Home · Consultas · Acompanhamento de consultas
          </p>
          <h1 className="text-2xl font-bold mt-0.5">Acompanhamento de consultas</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenQuickSim && (
            <button
              type="button"
              onClick={() => onOpenQuickSim('andamento')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
            >
              <Bot className="h-3.5 w-3.5 text-[var(--accent)]" />
              Simulador Rápido
            </button>
          )}
          <button
            type="button"
            data-coach="crm-back"
            onClick={onBackToSim}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2 text-xs font-semibold whitespace-nowrap"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Voltar ao chat
          </button>
        </div>
      </div>

      {/* Barra superior fiel ao CRM real */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--ink)] font-mono-num"
            title="Atualizar agendas agora"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Última atualização às {lastUpdated}</span>
          </button>
          <span className="text-[var(--muted)] font-mono-num">
            Agendas hoje · Ativas: <strong className="text-[var(--ink)]">{activeCount}</strong> ·
            Encerradas: <strong className="text-[var(--ink)]">{closedCount}</strong>
          </span>
        </div>

        <div className="relative flex flex-wrap items-center gap-2" ref={doctorFilterRef}>
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar por paciente ou médico"
              aria-label="Pesquisar por paciente ou médico"
              className="w-64 rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <button
            type="button"
            onClick={openDoctorFilter}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              appliedDoctors.length > 0 || doctorFilterOpen
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtrar
            {appliedDoctors.length > 0 && (
              <span className="ml-0.5 rounded-full bg-[var(--accent)] text-[var(--accent-ink)] px-1.5 py-0.2 text-[10px] font-bold">
                {appliedDoctors.length}
              </span>
            )}
          </button>

          {doctorFilterOpen && (
            <div
              role="dialog"
              aria-label="Filtrar por médico"
              className="absolute right-0 top-11 z-40 w-[330px] max-w-[calc(100vw-24px)] rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <strong className="text-base font-bold">Filtrar</strong>
                <button
                  type="button"
                  onClick={() => setDoctorFilterOpen(false)}
                  aria-label="Fechar filtro de médico"
                  className="h-7 w-7 rounded-lg grid place-items-center text-[var(--muted)] hover:bg-[var(--surface-2)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2.5">
                <span className="text-xs font-semibold text-[var(--muted)] block">Médico</span>
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={doctorQuery}
                    onChange={(e) => setDoctorQuery(e.target.value)}
                    placeholder="Pesquise por um médico"
                    aria-label="Pesquise por um médico"
                    className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div className="space-y-1 max-h-[240px] overflow-y-auto pr-1">
                  {filteredDoctorOptions.length ? (
                    filteredDoctorOptions.map((doc) => {
                      const checked = draftDoctors.includes(doc);
                      return (
                        <label
                          key={doc}
                          className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-xs cursor-pointer hover:bg-[var(--surface-2)]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleDraftDoctor(doc)}
                            className="h-4 w-4 rounded border-[var(--line)] accent-[var(--accent)] shrink-0"
                          />
                          <span className="h-7 w-7 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-bold text-[10px] grid place-items-center shrink-0">
                            {initials(doc)}
                          </span>
                          <span className="truncate">{doc}</span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-xs text-[var(--muted)] py-3 text-center">
                      Nenhum médico encontrado.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={handleClearDoctorFilter}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--accent)] hover:border-[var(--accent)]"
                >
                  Limpar tudo
                </button>
                <button
                  type="button"
                  onClick={handleApplyDoctorFilter}
                  className="rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-3 py-2 text-xs font-semibold hover:opacity-95"
                >
                  Aplicar filtro
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[var(--muted)]">Filtros ativos:</span>
          {appliedConsultas.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() =>
                setAppliedConsultas((prev) => prev.filter((item) => item !== c))
              }
              className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] px-2.5 py-1 font-semibold"
            >
              Consulta: {c}
              <X className="h-3 w-3" />
            </button>
          ))}
          {appliedDoctors.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() =>
                setAppliedDoctors((prev) => prev.filter((item) => item !== d))
              }
              className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] px-2.5 py-1 font-semibold"
            >
              {d}
              <X className="h-3 w-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs font-semibold text-[var(--muted)] underline ml-1"
          >
            Limpar tudo
          </button>
        </div>
      )}

      {/* 3 Colunas fiéis ao CRM real: Anteriores | Em andamento | Próximas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {COLUMNS.map((col) => {
          const list = filteredCards.filter((c) => c.column === col.id);
          return (
            <section
              key={col.id}
              className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-3 space-y-2.5 min-h-[320px]"
            >
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${col.pillClass}`}
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    {col.title}
                  </span>
                  <span className="inline-flex items-center justify-center rounded-md bg-[var(--surface)] border border-[var(--line)] px-2 py-0.5 text-xs font-semibold font-mono-num text-[var(--muted)]">
                    {list.length}
                  </span>
                </div>

                <div
                  className="relative"
                  ref={consultaFilterCol === col.id ? consultaFilterRef : undefined}
                >
                  <button
                    type="button"
                    onClick={() => openConsultaFilter(col.id)}
                    title={`Filtrar consultas em ${col.title}`}
                    aria-label={`Filtrar consultas em ${col.title}`}
                    className={`h-7 w-7 rounded-lg grid place-items-center transition-colors ${
                      consultaFilterCol === col.id || appliedConsultas.length > 0
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                  </button>

                  {consultaFilterCol === col.id && (
                    <div
                      role="dialog"
                      aria-label="Filtrar status da consulta"
                      className="absolute right-0 top-9 z-40 w-[260px] max-w-[calc(100vw-32px)] rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-base font-bold">Filtrar</strong>
                        <button
                          type="button"
                          onClick={() => setConsultaFilterCol(null)}
                          aria-label="Fechar filtro de consulta"
                          className="h-7 w-7 rounded-lg grid place-items-center text-[var(--muted)] hover:bg-[var(--surface-2)]"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-[var(--muted)] block pb-1">
                          Consulta
                        </span>
                        <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
                          {CONSULTA_FILTER_OPTIONS.map((opt) => {
                            const checked = draftConsultas.includes(opt);
                            return (
                              <label
                                key={opt}
                                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs cursor-pointer hover:bg-[var(--surface-2)]"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handleToggleDraftConsulta(opt)}
                                  className="h-4 w-4 rounded border-[var(--line)] accent-[var(--accent)]"
                                />
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--line)]">
                        <button
                          type="button"
                          onClick={handleClearConsultaFilter}
                          className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
                        >
                          Limpar tudo
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyConsultaFilter}
                          className="rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-3 py-2 text-xs font-semibold hover:opacity-95"
                        >
                          Aplicar filtro
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-0.5">
                {list.length ? (
                  list.map((card) => {
                    const p = card.patient;
                    const isExpanded = moreId === card.id;
                    return (
                      <div
                        key={card.id}
                        className="relative rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-[var(--muted)]">Paciente</span>
                          <StatusBadgePill status={card.crmStatus} hora={p.hora} />
                        </div>

                        <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                          <PatientLeadIcon status={card.crmStatus} />
                          <span className="truncate">{p.nome}</span>
                          {card.hasRecurrenceBadge && (
                            <span
                              title="Paciente de recorrência"
                              className="inline-flex items-center justify-center rounded bg-[var(--surface-2)] border border-[var(--line)] px-1 py-0.5 text-[10px] text-[var(--muted)] shrink-0"
                            >
                              Rec
                            </span>
                          )}
                        </div>

                        <div className="space-y-0.5 pt-0.5">
                          <span className="text-[11px] text-[var(--muted)] block">
                            Médico responsável
                          </span>
                          <div className="flex items-center gap-1.5 text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">{p.medico}</span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="rounded-lg bg-[var(--surface-2)] border border-[var(--line)] p-2.5 text-[11px] space-y-2">
                            <div className="text-[var(--muted)] font-mono-num space-y-0.5">
                              <div>
                                {p.proc} · {p.tipo} · {p.data.replaceAll('-', '/')} às {p.hora}
                              </div>
                              <div>
                                {p.tel} · Atendimento: {p.atend}
                              </div>
                            </div>
                            <label className="block space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block">
                                Atualizar status da consulta
                              </span>
                              <select
                                value={card.crmStatus}
                                onChange={(e) =>
                                  handleCardStatusChange(card, e.target.value as CrmCardStatus)
                                }
                                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs"
                              >
                                <option value="Aguardando">Aguardando</option>
                                <option value="Aguardando paciente">Aguardando paciente</option>
                                <option value="Aguardando médico">Aguardando médico</option>
                                <option value="Ninguém entrou">Ninguém entrou</option>
                                <option value="Em andamento">Em andamento</option>
                                <option value="Confirmada">Confirmada</option>
                                <option value="Reagendado">Reagendado</option>
                                <option value="Finalizada">Finalizada</option>
                                <option value="Concluída">Concluída</option>
                                <option value="Não realizada">Não realizada</option>
                                <option value="Paciente faltou">Paciente faltou</option>
                              </select>
                            </label>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 mt-1 border-t border-[var(--line)]">
                          <button
                            type="button"
                            onClick={() =>
                              setMoreId((cur) => (cur === card.id ? null : card.id))
                            }
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
                          >
                            Ver mais
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onOpenPatientChat(p.id)}
                              title={`Abrir chat de ${p.nome}`}
                              aria-label={`Abrir chat de ${p.nome}`}
                              className="h-7 w-7 rounded-lg grid place-items-center text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--accent)]"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onToast?.(
                                  `Tentativa de ligação registrada para ${p.nome} (${p.tel}) às ${nowTime()}.`
                                )
                              }
                              title={`Ligar para ${p.nome}`}
                              aria-label={`Ligar para ${p.nome}`}
                              className="h-7 w-7 rounded-lg grid place-items-center text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--accent)]"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              data-coach={`crm-msg-${p.id}`}
                              onClick={() =>
                                setPopId((cur) => (cur === card.id ? null : card.id))
                              }
                              aria-label={`Ações e mensagens de ${p.nome}`}
                              className="h-7 w-7 rounded-lg grid place-items-center text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {popId === card.id && (
                          <div className="absolute right-2 bottom-10 z-20 min-w-[205px] rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xl p-1 text-xs">
                            <button
                              type="button"
                              data-coach={`crm-pac-${p.id}`}
                              onClick={() => {
                                setPopId(null);
                                onOpenPatientChat(p.id);
                              }}
                              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)] font-semibold"
                            >
                              Chat do paciente
                            </button>
                            {onOpenNegotiation && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPopId(null);
                                  onOpenNegotiation(p.id);
                                }}
                                className="w-full flex items-center gap-1.5 text-left px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)]"
                              >
                                <FolderOpen className="h-3.5 w-3.5 text-[var(--accent)]" />
                                Abrir Negociação (Consultas)
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setPopId(null);
                                setMedDrawerPatient(p);
                              }}
                              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)]"
                            >
                              Chat com o médico
                            </button>
                            {onOpenQuickSim && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPopId(null);
                                  onOpenQuickSim(p.key, p.id);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
                              >
                                Simular aqui
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--line)] p-6 text-center text-xs text-[var(--muted)]">
                    Nenhum card encontrado nesta coluna
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {medDrawerPatient && (
        <div
          className="fixed inset-0 z-40 bg-[rgba(6,20,12,0.45)] flex justify-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMedDrawerPatient(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Chat com o médico"
        >
          <aside className="bg-[var(--surface)] w-full max-w-[460px] h-full flex flex-col shadow-2xl border-l border-[var(--line)]">
            <div className="p-4 border-b border-[var(--line)] flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[var(--sunk)] text-[var(--accent)] font-bold text-xs grid place-items-center shrink-0">
                {initials(medDrawerPatient.medico)}
              </div>
              <div className="min-w-0 flex-1">
                <strong className="text-sm block truncate">{medDrawerPatient.medico}</strong>
                <span className="text-xs text-[var(--muted)] block truncate">
                  Chat com o médico · paciente {medDrawerPatient.nome}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMedDrawerPatient(null)}
                aria-label="Fechar"
                className="h-8 w-8 rounded-lg border border-[var(--line)] grid place-items-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-[var(--surface-2)]">
              {(medDrawerPatient.medMsgs.length
                ? medDrawerPatient.medMsgs
                : ['Agenda acompanhada pela equipe de atendimento. Caso o paciente não entre em 5 minutos, sinalizar por aqui.']
              ).map((t, i) => (
                <div
                  key={i}
                  className="max-w-[85%] rounded-xl border border-[var(--line)] bg-[var(--bubble-in)] p-3 text-xs space-y-1"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] block">
                    {medDrawerPatient.medico}
                  </span>
                  <p>{t}</p>
                </div>
              ))}
              <div className="rounded-xl bg-[var(--info-soft)] text-[var(--info)] p-3 text-xs">
                Use "Chat do paciente" para falar com o paciente. Este painel exibe os recados do
                médico para a consulta.
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
