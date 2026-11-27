import React, { useMemo, useState } from 'react';
import {
  Award,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Unlock,
  UserCheck,
  X,
} from 'lucide-react';
import {
  canonicalPersonKey,
  computeReciclagemStatus,
  computeTraineeSummary,
  EMPTY_RECICLAGEM_PROGRESS,
  EMPTY_TRAINEE_PROGRESS,
  EQUIPE,
  RECICLAGEM_MIN,
  TRN_MAXT,
  TRN_MIN,
} from '../data/defaults';
import type {
  AppView,
  CronoRecord,
  ReciclagemPersonProgress,
  TraineeProgressStore,
  TraineeStageKey,
  TrilhaStore,
} from '../types';
import { initials, norm } from '../utils/helpers';
import { StatusBadge } from './StatusBadge';

interface AdminMonitorModalProps {
  open: boolean;
  onClose: () => void;
  activeAdminLabel: string | null;
  collaborators: string[];
  activeCollaborator: string;
  onSelectCollaborator: (name: string) => void;
  traineeByPerson: Record<string, TraineeProgressStore>;
  reciclagemByPerson: Record<string, ReciclagemPersonProgress>;
  trilhaData: Record<string, TrilhaStore>;
  cronoRecords: Record<string, CronoRecord>;
  teamSubsectors: Record<string, string>;
  opsAccessOverrides: Record<string, 'unlocked' | 'locked'>;
  onToggleOpsAccess: (personName: string, nextUnlocked: boolean) => void;
  onRefreshSync: () => Promise<void>;
  onGoView: (view: AppView) => void;
}

const STAGE_META: Array<{ key: TraineeStageKey; label: string; min: number; maxTries: number }> = [
  { key: 'd1', label: 'Dia 1 · Básico', min: TRN_MIN.d1, maxTries: TRN_MAXT.d1 },
  { key: 'd2', label: 'Dia 2 · Intermediário', min: TRN_MIN.d2, maxTries: TRN_MAXT.d2 },
  { key: 'd3', label: 'Dia 3 · Avançado', min: TRN_MIN.d3, maxTries: TRN_MAXT.d3 },
  { key: 'final', label: 'Prova Final Hard', min: TRN_MIN.final, maxTries: TRN_MAXT.final },
];

export function AdminMonitorModal({
  open,
  onClose,
  activeAdminLabel,
  collaborators,
  activeCollaborator,
  onSelectCollaborator,
  traineeByPerson,
  reciclagemByPerson,
  trilhaData,
  cronoRecords,
  teamSubsectors,
  opsAccessOverrides,
  onToggleOpsAccess,
  onRefreshSync,
  onGoView,
}: AdminMonitorModalProps) {
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const getSubsector = (name: string) => {
    const key = canonicalPersonKey(name);
    if (teamSubsectors[key]) return teamSubsectors[key];
    if (teamSubsectors[name]) return teamSubsectors[name];
    const m = EQUIPE.find((item) => canonicalPersonKey(item.nome) === key);
    return m?.subsetor || 'Trainee';
  };

  const getTraineeLockStatus = (personName: string) => {
    const key = canonicalPersonKey(personName);
    const manual = opsAccessOverrides[key];
    const p = traineeByPerson[personName] || EMPTY_TRAINEE_PROGRESS();
    const s = computeTraineeSummary(p, trilhaData[personName]);
    const rec = computeReciclagemStatus(
      reciclagemByPerson[personName] || EMPTY_RECICLAGEM_PROGRESS(personName)
    );
    if (manual === 'locked') return { unlocked: false, reason: 'Bloqueio manual ADM' };
    if (manual === 'unlocked') return { unlocked: true, reason: 'Liberado pela ADM' };
    if (s.trilhaPct >= 100) return { unlocked: true, reason: 'Trilha concluída' };
    if (rec.examPassed || rec.status === 'Aprovada') {
      return { unlocked: true, reason: 'Reciclagem aprovada' };
    }
    if (s.completedStages === 4) return { unlocked: true, reason: 'Provas concluídas' };
    return { unlocked: false, reason: 'Aguardando trilha ou reciclagem' };
  };

  const filteredList = useMemo(() => {
    const q = norm(search.trim());
    if (!q) return collaborators;
    return collaborators.filter((name) => {
      const sub = getSubsector(name);
      return norm(name).includes(q) || norm(sub).includes(q);
    });
  }, [collaborators, search, teamSubsectors]);

  if (!open) return null;

  const selectedName = collaborators.includes(activeCollaborator)
    ? activeCollaborator
    : collaborators[0] || activeCollaborator;
  const selectedProgress = traineeByPerson[selectedName] || EMPTY_TRAINEE_PROGRESS();
  const selectedTrilha = trilhaData[selectedName];
  const selectedSummary = computeTraineeSummary(selectedProgress, selectedTrilha);
  const selectedRecRaw =
    reciclagemByPerson[selectedName] || EMPTY_RECICLAGEM_PROGRESS(selectedName);
  const selectedRec = computeReciclagemStatus(selectedRecRaw);
  const selectedCrono = cronoRecords[selectedName];
  const selectedLock = getTraineeLockStatus(selectedName);
  const selectedSub = getSubsector(selectedName);

  const cronoEntries = selectedCrono ? Object.entries(selectedCrono.subs || {}) : [];
  const dominaCount = cronoEntries.filter(([, v]) => v.nivel === 'Domina').length;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshSync();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      className="no-print fixed inset-0 z-[72] bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 md:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adm-monitor-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[1060px] max-h-[calc(100vh-32px)] rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-3 bg-[var(--surface)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)] block">
                Administração · {activeAdminLabel || 'Liderança'}
              </span>
              <h2 id="adm-monitor-title" className="text-lg font-bold text-[var(--ink)] truncate">
                Escolha a colaboradora para acompanhar e ver notas
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent)] disabled:opacity-60 whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[var(--accent)] ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Atualizando...' : 'Atualizar notas'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar painel da ADM"
              className="h-8 w-8 rounded-lg border border-[var(--line)] grid place-items-center text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Two-column body */}
        <div className="grid grid-cols-1 md:grid-cols-[310px_minmax(0,1fr)] flex-1 min-h-0 overflow-hidden">
          {/* Left: Girl Picker */}
          <div className="border-b md:border-b-0 md:border-r border-[var(--line)] flex flex-col min-h-[220px] max-h-[320px] md:max-h-none bg-[var(--surface-2)]/60">
            <div className="p-3 border-b border-[var(--line)]">
              <label className="relative block">
                <Search className="h-3.5 w-3.5 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar colaboradora ou subsetor..."
                  aria-label="Buscar colaboradora para acompanhar"
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-8 pr-3 py-1.5 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
                />
              </label>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredList.map((name) => {
                const p = traineeByPerson[name] || EMPTY_TRAINEE_PROGRESS();
                const s = computeTraineeSummary(p, trilhaData[name]);
                const recRaw =
                  reciclagemByPerson[name] || EMPTY_RECICLAGEM_PROGRESS(name);
                const rec = computeReciclagemStatus(recRaw);
                const sub = getSubsector(name);
                const isSel = name === selectedName;
                const lockInfo = getTraineeLockStatus(name);

                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      onSelectCollaborator(name);
                      void onRefreshSync();
                    }}
                    className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors flex items-start justify-between gap-2 ${
                      isSel
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                        : 'border-transparent hover:border-[var(--line)] hover:bg-[var(--surface)]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="h-8 w-8 rounded-full bg-[var(--surface)] border border-[var(--line)] text-[var(--accent)] font-bold text-[11px] grid place-items-center shrink-0">
                        {initials(name)}
                      </span>
                      <div className="min-w-0">
                        <strong className="text-xs text-[var(--ink)] block truncate">{name}</strong>
                        <span className="text-[11px] text-[var(--muted)] block truncate">
                          {sub}
                        </span>
                        <span className="text-[10px] font-mono-num text-[var(--muted)] block mt-0.5">
                          Provas {s.completedStages}/4 · Trilha {s.trilhaPct}% · Rec.{' '}
                          {recRaw.examBest !== undefined ? `${recRaw.examBest}%` : rec.status}
                        </span>
                      </div>
                    </div>
                    <span
                      title={lockInfo.reason}
                      className={`mt-0.5 shrink-0 ${
                        lockInfo.unlocked
                          ? 'text-[var(--accent)]'
                          : 'text-amber-600 dark:text-amber-300'
                      }`}
                    >
                      {lockInfo.unlocked ? (
                        <Unlock className="h-3.5 w-3.5" />
                      ) : (
                        <Lock className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                );
              })}

              {filteredList.length === 0 && (
                <p className="text-xs text-[var(--muted)] text-center py-6">
                  Nenhuma colaboradora encontrada.
                </p>
              )}
            </div>
          </div>

          {/* Right: Detailed Performance & Grades */}
          <div className="p-5 overflow-y-auto space-y-4 text-xs">
            <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-3">
                <span className="h-11 w-11 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-bold text-sm grid place-items-center shrink-0">
                  {initials(selectedName)}
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-[var(--ink)]">{selectedName}</h3>
                    <StatusBadge tone="info">{selectedSub}</StatusBadge>
                    <StatusBadge tone={selectedLock.unlocked ? 'ok' : 'warn'}>
                      {selectedLock.unlocked ? 'Trainee Liberado' : 'Trainee com Cadeado'}
                    </StatusBadge>
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    Etapa atual: <strong className="text-[var(--ink)]">{selectedSummary.currentStageLabel}</strong> · {selectedLock.reason}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleOpsAccess(selectedName, !selectedLock.unlocked)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 font-semibold hover:border-[var(--accent)] whitespace-nowrap"
                >
                  {selectedLock.unlocked ? (
                    <>
                      <Lock className="h-3.5 w-3.5 text-amber-600" />
                      Travar cadeado
                    </>
                  ) : (
                    <>
                      <Unlock className="h-3.5 w-3.5 text-[var(--accent)]" />
                      Desbloquear Trainee
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectCollaborator(selectedName);
                    onGoView('trainee');
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-3.5 py-1.5 font-semibold hover:brightness-105 whitespace-nowrap"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Acompanhar no Portal
                </button>
              </div>
            </div>

            {/* 1. Notas das Provas Trainee */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-[var(--ink)] flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-[var(--accent)]" />
                  Notas do Treinamento Trainee (3 Dias + Final Hard)
                </h4>
                <span className="font-mono-num text-[11px] font-bold text-[var(--accent)]">
                  {selectedSummary.completedStages}/4 provas aprovadas
                </span>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {STAGE_META.map((st) => {
                  const score = selectedProgress.best[st.key];
                  const tries = selectedProgress.tries[st.key] || 0;
                  const dt = selectedProgress.date[st.key];
                  const passed = score !== undefined && score >= st.min;
                  return (
                    <div
                      key={st.key}
                      className={`rounded-xl border p-3 space-y-1.5 ${
                        passed
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)]/40'
                          : 'border-[var(--line)] bg-[var(--surface-2)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-[var(--ink)] truncate">{st.label}</span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <strong
                          className={`font-display text-2xl tabular-nums ${
                            score === undefined
                              ? 'text-[var(--muted)]'
                              : passed
                                ? 'text-[var(--accent)]'
                                : 'text-[var(--danger)]'
                          }`}
                        >
                          {score !== undefined ? `${score}%` : '—'}
                        </strong>
                        <StatusBadge
                          tone={score === undefined ? 'neutral' : passed ? 'ok' : 'bad'}
                        >
                          {score === undefined ? 'Pendente' : passed ? 'Aprovada' : 'Reprovada'}
                        </StatusBadge>
                      </div>
                      <p className="text-[11px] text-[var(--muted)] font-mono-num">
                        Mín. {st.min}% · Tent. {tries}/{st.maxTries}
                        {dt ? ` · ${dt}` : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Desempenho Geral: Simulador, Reciclagem, Trilha, Cronograma */}
            <div className="grid sm:grid-cols-2 gap-3">
              {/* Práticas & IA */}
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <strong className="flex items-center gap-1.5 text-[var(--ink)]">
                    <Bot className="h-4 w-4 text-[var(--accent)]" />
                    Práticas & Simulador de IA
                  </strong>
                  <span className="font-mono-num font-bold text-[var(--accent)]">
                    {selectedSummary.practicesDone}/{selectedSummary.totalPractices} práticas
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface)] overflow-hidden border border-[var(--line)]">
                  <div
                    className="h-full bg-[var(--accent)] transition-all"
                    style={{
                      width: `${Math.round(
                        (selectedSummary.practicesDone / Math.max(1, selectedSummary.totalPractices)) *
                          100
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-[var(--muted)]">
                  Casos avaliados pela IA:{' '}
                  <strong className="text-[var(--ink)] font-mono-num">
                    {selectedProgress.aiCasesApproved || 0} aprovados
                  </strong>{' '}
                  de{' '}
                  <strong className="text-[var(--ink)] font-mono-num">
                    {selectedProgress.aiCasesEvaluated || 0} avaliados
                  </strong>
                  .
                </p>
              </div>

              {/* Reciclagem */}
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <strong className="flex items-center gap-1.5 text-[var(--ink)]">
                    <RefreshCw className="h-4 w-4 text-[var(--accent)]" />
                    Reciclagem (Veteranas)
                  </strong>
                  <StatusBadge
                    tone={
                      selectedRec.status === 'Aprovada'
                        ? 'ok'
                        : selectedRec.status === 'Em reciclagem'
                          ? 'info'
                          : 'neutral'
                    }
                  >
                    {selectedRec.status}
                  </StatusBadge>
                </div>
                <div className="flex items-center justify-between font-mono-num text-[11px]">
                  <span className="text-[var(--muted)]">
                    Checklist: {selectedRec.checklistDone}/{selectedRec.checklistTotal} ({selectedRec.pct}%)
                  </span>
                  <span className="font-bold text-[var(--ink)]">
                    Nota: {selectedRecRaw.examBest !== undefined ? `${selectedRecRaw.examBest}%` : '—'} (mín.{' '}
                    {RECICLAGEM_MIN}%)
                  </span>
                </div>
                <p className="text-[11px] text-[var(--muted)]">
                  Tentativas: <strong className="text-[var(--ink)]">{selectedRecRaw.examTries}</strong> ·
                  Calibrações abertas:{' '}
                  <strong className="text-[var(--ink)]">
                    {selectedRecRaw.calibracoes.filter((c) => !c.resolvido).length}
                  </strong>
                </p>
              </div>

              {/* Trilha */}
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <strong className="flex items-center gap-1.5 text-[var(--ink)]">
                    <ClipboardCheck className="h-4 w-4 text-[var(--accent)]" />
                    Trilha de Integração
                  </strong>
                  <span className="font-mono-num font-bold text-[var(--accent)]">
                    {selectedSummary.trilhaPct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface)] overflow-hidden border border-[var(--line)]">
                  <div
                    className="h-full bg-[var(--accent)] transition-all"
                    style={{ width: `${selectedSummary.trilhaPct}%` }}
                  />
                </div>
                <p className="text-[11px] text-[var(--muted)]">
                  {selectedSummary.trilhaPct >= 100
                    ? 'Trilha concluída 100% — Treinamento Trainee liberado automaticamente.'
                    : 'Ao completar 100%, o Treinamento Trainee é liberado automaticamente.'}
                </p>
              </div>

              {/* Cronograma */}
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <strong className="flex items-center gap-1.5 text-[var(--ink)]">
                    <CalendarCheck className="h-4 w-4 text-[var(--accent)]" />
                    Cronograma Semanal
                  </strong>
                  <span className="font-mono-num text-[11px] font-bold text-[var(--ink)]">
                    {dominaCount}/{cronoEntries.length || 7} domina
                  </span>
                </div>
                {cronoEntries.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {cronoEntries.slice(0, 7).map(([subName, val]) => (
                      <span
                        key={subName}
                        className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                          val.nivel === 'Domina'
                            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                            : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'
                        }`}
                      >
                        {subName}: {val.nivel || (val.pratica ? 'Praticou' : 'Em andamento')}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--muted)]">
                    Nenhum registro preenchido no Cronograma Semanal ainda.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--line)]">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSelectCollaborator(selectedName);
                    onGoView('reciclagem');
                    onClose();
                  }}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 font-semibold hover:border-[var(--accent)]"
                >
                  Abrir Reciclagem dela
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectCollaborator(selectedName);
                    onGoView('trilha');
                    onClose();
                  }}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 font-semibold hover:border-[var(--accent)]"
                >
                  Abrir Trilha dela
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectCollaborator(selectedName);
                    onGoView('treinamento');
                    onClose();
                  }}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 font-semibold hover:border-[var(--accent)]"
                >
                  Abrir Cronograma dela
                </button>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent)]" />
                Dados sincronizados em tempo real
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
