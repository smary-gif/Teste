import React, { useEffect, useState } from 'react';
import {
  Award,
  Bot,
  CheckCircle2,
  Clock,
  Lock,
  Play,
  Printer,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Unlock,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  computeTraineeSummary,
  DEFAULT_LEADERSHIP,
  EMPTY_TRAINEE_PROGRESS,
  TRAINEE_DAYS,
  TRAINEE_INTEGRATED_POOL,
  TRN_DAY_TIME_SECONDS,
  TRN_FINAL_TIME_SECONDS,
  TRN_MAXT,
  TRN_MIN,
} from '../data/defaults';
import type {
  AppView,
  PortalConfig,
  TraineeProgressStore,
  TraineeQuestionRaw,
  TraineeQuestionShuffled,
  TraineeStageKey,
} from '../types';
import { pad, shuffleArray } from '../utils/helpers';
import { ClickCannabisLogo } from './ClickCannabisLogo';
import type { TrilhaStore } from './IntegrationTrackView';
import { StatusBadge } from './StatusBadge';

interface TraineeViewProps {
  cfg: PortalConfig;
  progress: TraineeProgressStore;
  allProgressByPerson: Record<string, TraineeProgressStore>;
  collaborators: string[];
  trilhaData: Record<string, TrilhaStore>;
  activeCollaborator: string;
  googleLinked?: boolean;
  onChangeCollaborator: (name: string) => void;
  onAddCollaborator: (name: string) => void;
  onUpdateProgress: (next: TraineeProgressStore) => void;
  isAdmin: boolean;
  onLaunchPractice: (deptKey?: string) => void;
  onOpenQuickSim: (deptKey?: string, patientId?: string) => void;
  onGoView: (view: AppView) => void;
  onToast: (msg: string) => void;
}

interface QuizSession {
  questions: TraineeQuestionShuffled[];
  answers: Record<number, number | number[]>;
  result: { pct: number; ok: number; total: number } | null;
  startedAt: number | null;
}

type TraineeTab = 'visao' | 'equipe' | TraineeStageKey;

function shuffleQuestion(raw: TraineeQuestionRaw): TraineeQuestionShuffled {
  const indices = shuffleArray(raw.o.map((_, idx) => idx));
  const correctArr = Array.isArray(raw.c) ? raw.c : [raw.c];
  const mappedCorrect = indices
    .map((origIdx, newIdx) => (correctArr.includes(origIdx) ? newIdx : -1))
    .filter((idx) => idx >= 0);

  return {
    q: raw.q,
    o: indices.map((idx) => raw.o[idx]),
    c: mappedCorrect,
    m: Array.isArray(raw.c),
    w: raw.w,
  };
}

function buildQuizSet(stage: TraineeStageKey): TraineeQuestionShuffled[] {
  if (stage === 'final') {
    const pool = [
      ...shuffleArray(TRAINEE_DAYS[0].pool).slice(0, 8),
      ...shuffleArray(TRAINEE_DAYS[1].pool).slice(0, 8),
      ...shuffleArray(TRAINEE_DAYS[2].pool).slice(0, 8),
      ...shuffleArray(TRAINEE_INTEGRATED_POOL).slice(0, 6),
    ];
    return shuffleArray(pool).map(shuffleQuestion);
  }
  const dayIndex = Number(stage[1]) - 1;
  return shuffleArray(TRAINEE_DAYS[dayIndex].pool)
    .slice(0, 10)
    .map(shuffleQuestion);
}

const STAGE_NAMES: Record<TraineeStageKey, string> = {
  d1: 'Dia 1 · Básico',
  d2: 'Dia 2 · Intermediário',
  d3: 'Dia 3 · Avançado',
  final: 'Prova Final Hard',
};

const SUB_TO_DEPT: Record<string, string> = {
  'Chat geral': 'geral',
  Agendamento: 'agendamento',
  Reagendamento: 'reagendamento',
  'Confirmação (4.1 a 4.4)': 'confirmacao',
  'Suporte aos pacientes (em andamento, aguardando, faltou)': 'andamento',
  'Suporte aos médicos': 'medicos',
  'Solicitações (5 colunas)': 'solicitacoes',
  'Rotina de turno e auditoria de qualidade': 'solicitacoes',
};

export function TraineeView({
  cfg,
  progress,
  allProgressByPerson,
  collaborators,
  trilhaData,
  activeCollaborator,
  googleLinked = false,
  onChangeCollaborator,
  onAddCollaborator,
  onUpdateProgress,
  isAdmin,
  onLaunchPractice,
  onOpenQuickSim,
  onGoView,
  onToast,
}: TraineeViewProps) {
  const leadership = cfg.lideranca || DEFAULT_LEADERSHIP;
  const [tab, setTab] = useState<TraineeTab>('visao');
  const [newCollabName, setNewCollabName] = useState('');
  const [sessions, setSessions] = useState<Partial<Record<TraineeStageKey, QuizSession>>>({});
  const [remainingSecs, setRemainingSecs] = useState<number>(TRN_DAY_TIME_SECONDS);

  useEffect(() => {
    setSessions({});
  }, [activeCollaborator]);

  const isPassed = (k: TraineeStageKey) => {
    const best = progress.best[k];
    return best !== undefined && best >= TRN_MIN[k];
  };

  const isUnlocked = (k: TraineeStageKey) => {
    if (k === 'd1') return true;
    if (k === 'd2') return isPassed('d1');
    if (k === 'd3') return isPassed('d2');
    return isPassed('d1') && isPassed('d2') && isPassed('d3');
  };

  const triesOf = (k: TraineeStageKey) => progress.tries[k] || 0;
  const maxTimeFor = (k: TraineeStageKey) =>
    k === 'final' ? TRN_FINAL_TIME_SECONDS : TRN_DAY_TIME_SECONDS;

  useEffect(() => {
    if (tab !== 'visao' && tab !== 'equipe' && isUnlocked(tab)) {
      const dayDef = TRAINEE_DAYS.find((d) => d.k === tab);
      const pracReady = dayDef
        ? dayDef.prat.every((task) => progress.prac[task.id])
        : true;
      if (pracReady && !sessions[tab]) {
        const created: QuizSession = {
          questions: buildQuizSet(tab),
          answers: {},
          result: null,
          startedAt: Date.now(),
        };
        setSessions((prev) => ({ ...prev, [tab]: created }));
        setRemainingSecs(maxTimeFor(tab));
      }
    }
  }, [tab, progress.prac, activeCollaborator]);

  const gradeQuiz = (k: TraineeStageKey, forcedTimeout = false) => {
    const session = sessions[k];
    if (!session || session.result) return;

    let okCount = 0;
    session.questions.forEach((q, qi) => {
      const rawAns = session.answers[qi];
      const chosen = (Array.isArray(rawAns) ? rawAns : rawAns !== undefined ? [rawAns] : [])
        .slice()
        .sort((a, b) => a - b);
      const expected = q.c.slice().sort((a, b) => a - b);
      if (
        chosen.length === expected.length &&
        chosen.every((val, idx) => val === expected[idx])
      ) {
        okCount++;
      }
    });

    const pct = Math.round((okCount / session.questions.length) * 100);
    const nextResult = { pct, ok: okCount, total: session.questions.length };

    setSessions((prev) => ({
      ...prev,
      [k]: { ...session, result: nextResult },
    }));

    const prevBest = progress.best[k] || 0;
    const nextProgress: TraineeProgressStore = {
      ...progress,
      best: { ...progress.best, [k]: Math.max(prevBest, pct) },
      tries: { ...progress.tries, [k]: triesOf(k) + 1 },
      date: { ...progress.date, [k]: new Date().toLocaleDateString('pt-BR') },
    };
    onUpdateProgress(nextProgress);

    if (forcedTimeout) {
      onToast(`Tempo esgotado! Prova de ${activeCollaborator} corrigida: ${pct}%.`);
    } else if (pct >= TRN_MIN[k]) {
      onToast(`${activeCollaborator} aprovada com ${pct}%! Próxima etapa liberada.`);
    } else {
      onToast(`Nota ${pct}%. Mínimo exigido para esta prova difícil: ${TRN_MIN[k]}%.`);
    }
  };

  useEffect(() => {
    if (tab === 'visao' || tab === 'equipe') return;
    const activeSession = sessions[tab];
    if (!activeSession || activeSession.result || !activeSession.startedAt) {
      return;
    }

    const limit = maxTimeFor(tab);
    const tick = () => {
      const elapsed = Math.floor((Date.now() - (activeSession.startedAt || Date.now())) / 1000);
      const rem = Math.max(0, limit - elapsed);
      setRemainingSecs(rem);
      if (rem <= 0) {
        gradeQuiz(tab, true);
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [tab, sessions]);

  const togglePractice = (taskId: string) => {
    onUpdateProgress({
      ...progress,
      prac: { ...progress.prac, [taskId]: !progress.prac[taskId] },
    });
  };

  const handleSelectAnswer = (k: TraineeStageKey, qi: number, oi: number, isMulti: boolean) => {
    const session = sessions[k];
    if (!session || session.result) return;

    const current = session.answers[qi];
    let updated: number | number[];
    if (isMulti) {
      const arr = Array.isArray(current) ? current : current !== undefined ? [current] : [];
      updated = arr.includes(oi) ? arr.filter((x) => x !== oi) : [...arr, oi];
    } else {
      updated = oi;
    }

    setSessions((prev) => ({
      ...prev,
      [k]: {
        ...session,
        answers: { ...session.answers, [qi]: updated },
      },
    }));
  };

  const handleRetry = (k: TraineeStageKey) => {
    const fresh: QuizSession = {
      questions: buildQuizSet(k),
      answers: {},
      result: null,
      startedAt: Date.now(),
    };
    setRemainingSecs(maxTimeFor(k));
    setSessions((prev) => ({ ...prev, [k]: fresh }));
  };

  const handleUnlockTries = (k: TraineeStageKey) => {
    onUpdateProgress({
      ...progress,
      tries: { ...progress.tries, [k]: 0 },
    });
    handleRetry(k);
    onToast(`Novas tentativas liberadas para ${activeCollaborator} em ${STAGE_NAMES[k]}.`);
  };

  const handleResetPerson = () => {
    onUpdateProgress(EMPTY_TRAINEE_PROGRESS());
    setSessions({});
    setTab('visao');
    onToast(`Processo individual de ${activeCollaborator} reiniciado.`);
  };

  const stageKeys: TraineeStageKey[] = ['d1', 'd2', 'd3', 'final'];
  const allApproved = stageKeys.every(isPassed);
  const completedCount = stageKeys.filter(isPassed).length;

  const renderQuizBlock = (k: TraineeStageKey) => {
    const session = sessions[k];
    const tries = triesOf(k);
    const remainingTries = TRN_MAXT[k] - tries;
    const exhaustedWithoutPass = !isPassed(k) && remainingTries <= 0 && !session?.result;

    if (exhaustedWithoutPass) {
      return (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-[var(--danger)] shrink-0 mt-0.5" />
            <div className="space-y-3">
              <h2 className="text-lg font-bold">Tentativas esgotadas — {activeCollaborator}</h2>
              <p className="text-sm text-[var(--muted)]">
                Foram utilizadas todas as {TRN_MAXT[k]} tentativas desta prova difícil. Revise os
                casos no Simulador Rápido ou solicite liberação da instrutora.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onOpenQuickSim(k === 'd2' ? 'confirmacao' : k === 'd3' ? 'solicitacoes' : 'geral')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
                >
                  <Bot className="h-3.5 w-3.5 text-[var(--accent)]" />
                  Treinar no Simulador antes
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleUnlockTries(k)}
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2 text-xs font-semibold whitespace-nowrap"
                  >
                    <Unlock className="h-4 w-4" />
                    Liberar nova tentativa (Instrutora)
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (!session) {
      return (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
          Preparando caderno cronometrado...
        </section>
      );
    }

    const answeredCount = session.questions.filter((_, idx) => {
      const a = session.answers[idx];
      return Array.isArray(a) ? a.length > 0 : a !== undefined;
    }).length;
    const allAnswered = answeredCount === session.questions.length;
    const isUrgentTime = remainingSecs < 120;

    return (
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 md:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
          <div>
            <h2 className="text-lg font-bold">
              {k === 'final'
                ? 'Prova Final Hard · 30 questões cronometradas'
                : `Prova Hard do Dia · 10 questões cronometradas`}
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Candidata: <strong className="text-[var(--ink)]">{activeCollaborator}</strong> · Nota
              mínima: <strong className="text-[var(--ink)]">{TRN_MIN[k]}%</strong> · Múltipla
              escolha vale tudo ou nada · Sem consulta
            </p>
          </div>

          {!session.result && (
            <div
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-bold font-mono-num ${
                isUrgentTime
                  ? 'border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]'
                  : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)]'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>
                {pad(Math.floor(remainingSecs / 60))}:{pad(remainingSecs % 60)}
              </span>
            </div>
          )}
        </div>

        <div className="divide-y divide-[var(--line)]">
          {session.questions.map((q, qi) => {
            const rawAns = session.answers[qi];
            const selectedArr = Array.isArray(rawAns)
              ? rawAns
              : rawAns !== undefined
                ? [rawAns]
                : [];

            return (
              <div key={qi} className="py-4 first:pt-1 space-y-2.5">
                <p className="text-sm font-semibold leading-relaxed">
                  <span className="font-mono-num text-[var(--accent)] mr-1.5">{qi + 1}.</span>
                  {q.q}
                  {q.m && (
                    <span className="ml-2 inline-block rounded-md bg-[var(--info-soft)] text-[var(--info)] px-2 py-0.5 text-[11px] font-bold">
                      múltipla escolha — marque todas as corretas
                    </span>
                  )}
                </p>

                <div className="grid gap-2">
                  {q.o.map((opt, oi) => {
                    const isSelected = selectedArr.includes(oi);
                    const isCorrect = q.c.includes(oi);

                    let cls =
                      'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)] text-[var(--ink)]';
                    if (session.result) {
                      if (isCorrect) {
                        cls =
                          'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)] font-semibold';
                      } else if (isSelected && !isCorrect) {
                        cls =
                          'border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)] line-through';
                      } else {
                        cls = 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)]';
                      }
                    } else if (isSelected) {
                      cls =
                        'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)] font-medium';
                    }

                    return (
                      <button
                        key={oi}
                        type="button"
                        disabled={Boolean(session.result)}
                        onClick={() => handleSelectAnswer(k, qi, oi, q.m)}
                        className={`w-full text-left rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${cls}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {session.result && (
                  <p className="text-xs text-[var(--muted)] bg-[var(--surface-2)] rounded-lg px-3 py-2">
                    <strong className="text-[var(--ink)]">Critério ClickCannabis:</strong> {q.w}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-[var(--line)] flex flex-wrap items-center gap-3">
          {!session.result ? (
            <button
              type="button"
              disabled={!allAnswered}
              onClick={() => gradeQuiz(k)}
              className="rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-5 py-2.5 text-sm font-semibold disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Corrigir prova ({answeredCount}/{session.questions.length})
            </button>
          ) : (
            <>
              <div
                className={`rounded-xl px-4 py-2.5 text-sm font-bold tabular-nums ${
                  session.result.pct >= TRN_MIN[k]
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'bg-[var(--danger-soft)] text-[var(--danger)]'
                }`}
              >
                {session.result.pct}% ({session.result.ok} de {session.result.total}) ·{' '}
                {session.result.pct >= TRN_MIN[k]
                  ? 'Aprovada'
                  : `Reprovada (mín. ${TRN_MIN[k]}%)`}
              </div>

              {session.result.pct < TRN_MIN[k] &&
                (TRN_MAXT[k] - triesOf(k) > 0 ? (
                  <button
                    type="button"
                    onClick={() => handleRetry(k)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2.5 text-sm font-semibold whitespace-nowrap"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Tentar novamente ({TRN_MAXT[k] - triesOf(k)} restante
                    {TRN_MAXT[k] - triesOf(k) > 1 ? 's' : ''})
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs text-[var(--muted)]">
                      Tentativas esgotadas para {activeCollaborator}.
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleUnlockTries(k)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold hover:border-[var(--accent)]"
                      >
                        <Unlock className="h-3.5 w-3.5" />
                        Liberar nova tentativa
                      </button>
                    )}
                  </div>
                ))}

              {session.result.pct >= TRN_MIN[k] && k !== 'final' && (
                <button
                  type="button"
                  onClick={() => setTab(k === 'd1' ? 'd2' : k === 'd2' ? 'd3' : 'final')}
                  className="rounded-xl border border-[var(--accent)] text-[var(--accent)] px-4 py-2 text-sm font-semibold hover:bg-[var(--accent-soft)] whitespace-nowrap"
                >
                  Avançar para a próxima etapa →
                </button>
              )}
            </>
          )}
        </div>
      </section>
    );
  };

  const renderDayTab = (dayKey: 'd1' | 'd2' | 'd3') => {
    if (!isUnlocked(dayKey)) {
      return (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-[var(--muted)] shrink-0" />
            <div>
              <h2 className="text-base font-bold">Módulo bloqueado para {activeCollaborator}</h2>
              <p className="text-sm text-[var(--muted)]">
                Conclua as práticas e atinja pelo menos {TRN_MIN[dayKey === 'd2' ? 'd1' : 'd2']}% na
                prova do dia anterior para liberar esta etapa.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenQuickSim(dayKey === 'd2' ? 'geral' : 'confirmacao')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-3.5 py-2 text-xs font-semibold whitespace-nowrap"
          >
            <Bot className="h-3.5 w-3.5" />
            Praticar no Simulador
          </button>
        </section>
      );
    }

    const day = TRAINEE_DAYS.find((d) => d.k === dayKey)!;
    const allPracDone = day.prat.every((task) => progress.prac[task.id]);

    return (
      <div className="space-y-4">
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 md:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                Nível {day.nivel} · Processo de {activeCollaborator}
              </span>
              <h2 className="text-xl font-bold mt-0.5">{day.titulo}</h2>
            </div>
            <StatusBadge tone={isPassed(dayKey) ? 'ok' : 'info'}>
              {isPassed(dayKey) ? `Aprovada · ${progress.best[dayKey]}%` : 'Em treinamento'}
            </StatusBadge>
          </div>

          <p className="text-sm text-[var(--muted)]">
            <strong className="text-[var(--ink)]">Meta do dia:</strong> {day.meta}
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {day.subs.map(([subName, bullets]) => {
              const mappedDept = SUB_TO_DEPT[subName] || day.prat[0]?.deptKey || 'geral';
              return (
                <div
                  key={subName}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-[var(--ink)]">{subName}</h3>
                    <ul className="space-y-1.5 text-xs text-[var(--muted)] list-disc pl-4">
                      {bullets.map((b, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenQuickSim(mappedDept)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
                  >
                    <Bot className="h-3.5 w-3.5 text-[var(--accent)]" />
                    Simular este tema
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 md:p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">Prática obrigatória no Simulador</h2>
              <p className="text-xs text-[var(--muted)]">
                Execute cada tarefa no Simulador (rápido ou tela cheia). A prova cronometrada de{' '}
                {activeCollaborator} libera após concluir todas.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenQuickSim(day.prat[0]?.deptKey)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
              >
                <Bot className="h-3.5 w-3.5" />
                Simulador Rápido
              </button>
              <button
                type="button"
                onClick={() => onLaunchPractice(day.prat[0]?.deptKey)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
              >
                <Play className="h-3.5 w-3.5 text-[var(--accent)]" />
                Tela cheia
              </button>
            </div>
          </div>

          <div className="divide-y divide-[var(--line)]">
            {day.prat.map((task) => {
              const checked = Boolean(progress.prac[task.id]);
              const detectedInSim = Boolean(progress.simSignals[task.id]);
              return (
                <div
                  key={task.id}
                  className="py-3 flex flex-wrap items-start justify-between gap-3"
                >
                  <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-[240px]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePractice(task.id)}
                      className="mt-1 h-4 w-4 accent-[var(--accent)] rounded"
                    />
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium block">{task.text}</span>
                      <span className="text-xs text-[var(--muted)] block">{task.hint}</span>
                    </div>
                  </label>

                  <div className="flex items-center gap-2 shrink-0">
                    {detectedInSim && (
                      <StatusBadge tone="ok">Praticado no Simulador</StatusBadge>
                    )}
                    {task.deptKey && (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpenQuickSim(task.deptKey)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] px-2.5 py-1 text-xs font-semibold hover:brightness-95 whitespace-nowrap"
                        >
                          <Bot className="h-3 w-3" />
                          Simular rápido
                        </button>
                        <button
                          type="button"
                          onClick={() => onLaunchPractice(task.deptKey)}
                          className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
                        >
                          Tela cheia →
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {allPracDone ? (
          renderQuizBlock(dayKey)
        ) : (
          <section className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] flex flex-wrap items-center justify-between gap-3">
            <span>
              A prova difícil do {dayKey === 'd1' ? 'Dia 1' : dayKey === 'd2' ? 'Dia 2' : 'Dia 3'}{' '}
              será liberada assim que todas as 3 práticas acima forem concluídas.
            </span>
            <button
              type="button"
              onClick={() => onOpenQuickSim(day.prat.find((t) => !progress.prac[t.id])?.deptKey)}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:border-[var(--accent)] whitespace-nowrap"
            >
              Concluir no Simulador →
            </button>
          </section>
        )}
      </div>
    );
  };

  const renderTeamMatrix = () => {
    return (
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Processo Individual da Equipe · ClickCannabis</h2>
            <p className="text-xs text-[var(--muted)]">
              Cada colaboradora possui notas, práticas no simulador e trilha de integração
              totalmente independentes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!googleLinked && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const clean = newCollabName.trim();
                  if (!clean) return;
                  onAddCollaborator(clean);
                  setNewCollabName('');
                }}
                className="inline-flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={newCollabName}
                  onChange={(e) => setNewCollabName(e.target.value)}
                  placeholder="Colocar meu nome..."
                  aria-label="Adicionar nome ao processo individual"
                  className="w-40 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
                >
                  <UserPlus className="h-3.5 w-3.5 text-[var(--accent)]" />
                  Adicionar
                </button>
              </form>
            )}
            <button
              type="button"
              onClick={() => onOpenQuickSim('geral')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-3.5 py-2 text-xs font-semibold whitespace-nowrap"
            >
              <Bot className="h-3.5 w-3.5" />
              Abrir Simulador
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="w-full min-w-[820px] text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--surface-2)] text-[var(--muted)] uppercase tracking-wider text-[10px] border-b border-[var(--line)]">
                <th className="text-left px-3 py-2.5">Colaboradora</th>
                <th className="text-left px-3 py-2.5">Etapa atual</th>
                <th className="text-center px-2.5 py-2.5">Dia 1</th>
                <th className="text-center px-2.5 py-2.5">Dia 2</th>
                <th className="text-center px-2.5 py-2.5">Dia 3</th>
                <th className="text-center px-2.5 py-2.5">Final Hard</th>
                <th className="text-center px-2.5 py-2.5">Práticas</th>
                <th className="text-center px-2.5 py-2.5">Progresso</th>
                <th className="text-right px-3 py-2.5">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {collaborators.map((name) => {
                const p = allProgressByPerson[name] || EMPTY_TRAINEE_PROGRESS();
                const s = computeTraineeSummary(p, trilhaData[name]);
                const pracCount = TRAINEE_DAYS.flatMap((d) => d.prat).filter(
                  (t) => p.prac[t.id]
                ).length;
                const isActive = name === activeCollaborator;

                return (
                  <tr
                    key={name}
                    className={isActive ? 'bg-[var(--accent-soft)]/50' : 'hover:bg-[var(--surface-2)]'}
                  >
                    <td className="px-3 py-2.5 font-bold text-[var(--ink)]">
                      {name}
                      {isActive && (
                        <span className="ml-2 text-[10px] font-bold uppercase text-[var(--accent)]">
                          (Ativa)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge tone={s.completedStages === 4 ? 'ok' : 'info'}>
                        {s.currentStageLabel}
                      </StatusBadge>
                    </td>
                    {(['d1', 'd2', 'd3', 'final'] as TraineeStageKey[]).map((sk) => {
                      const val = p.best[sk];
                      const ok = val !== undefined && val >= TRN_MIN[sk];
                      return (
                        <td key={sk} className="px-2.5 py-2.5 text-center font-mono-num">
                          {val !== undefined ? (
                            <span
                              className={
                                ok
                                  ? 'font-bold text-[var(--accent)]'
                                  : 'font-semibold text-[var(--danger)]'
                              }
                            >
                              {val}%
                            </span>
                          ) : (
                            <span className="text-[var(--muted)]">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2.5 py-2.5 text-center font-mono-num">{pracCount}/9</td>
                    <td className="px-2.5 py-2.5 text-center font-mono-num">
                      <strong className="text-[var(--accent)]">{s.completedStages}/4 provas</strong>
                      <span className="block text-[10px] text-[var(--muted)]">
                        Trilha {s.trilhaPct}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {(!googleLinked || isActive) && (
                          <button
                            type="button"
                            onClick={() => {
                              onChangeCollaborator(name);
                              setTab('visao');
                            }}
                            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold hover:border-[var(--accent)] whitespace-nowrap"
                          >
                            Abrir processo
                          </button>
                        )}
                        {(!googleLinked || isActive) && (
                          <button
                            type="button"
                            onClick={() => {
                              onChangeCollaborator(name);
                              onOpenQuickSim('geral');
                            }}
                            className="rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
                          >
                            Simular
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  return (
    <div className="max-w-[1380px] mx-auto space-y-5">
      {/* Header corporativo com logo e estrutura de liderança */}
      <div className="no-print rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <ClickCannabisLogo subtitle="Programa Corporativo de Formação Trainee" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                Treinamento Trainee · {activeCollaborator}
              </h1>
              <p className="text-sm text-[var(--muted)] mt-0.5">
                Formação intensiva de 3 dias (Básico ao Avançado), prática nos 7 subsetores e
                provas difíceis cronometradas.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenQuickSim('geral')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-3.5 py-2 text-xs font-semibold hover:brightness-105 whitespace-nowrap"
            >
              <Bot className="h-3.5 w-3.5" />
              Simulador Rápido
            </button>
            <button
              type="button"
              onClick={() => onGoView('reciclagem')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5 text-[var(--accent)]" />
              Reciclagem (Veteranas)
            </button>
            <button
              type="button"
              onClick={() => onGoView('subsetores')}
              className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
            >
              Guia dos Subsetores
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={handleResetPerson}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--danger)] hover:border-[var(--danger)] whitespace-nowrap"
              >
                Resetar {activeCollaborator}
              </button>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3 border-t border-[var(--line)]">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] block">
              Treinadora
            </span>
            <strong className="text-sm text-[var(--ink)]">
              {leadership.treinadora || cfg.madrinha.nome || 'Andréia'}
            </strong>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block">
              Coordenadora
            </span>
            <strong className="text-sm text-[var(--ink)]">{leadership.coordenadora}</strong>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block">
              Liderança
            </span>
            <strong className="text-sm text-[var(--ink)]">{leadership.lideranca}</strong>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block">
              Liderança em Treinamento
            </span>
            <strong className="text-sm text-[var(--ink)]">{leadership.liderancaTreinamento}</strong>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="no-print flex flex-wrap gap-2"
        role="tablist"
        aria-label="Etapas do Programa Trainee"
      >
        {(
          [
            ['visao', 'Visão Geral'],
            ['equipe', `Equipe (${collaborators.length})`],
            ['d1', 'Dia 1 · Básico'],
            ['d2', 'Dia 2 · Intermediário'],
            ['d3', 'Dia 3 · Avançado'],
            ['final', 'Prova Final Hard'],
          ] as Array<[TraineeTab, string]>
        ).map(([k, label]) => {
          const locked = k !== 'visao' && k !== 'equipe' && !isUnlocked(k);
          const active = tab === k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(k)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                active
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-ink)]'
                  : 'bg-[var(--surface)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--accent)]'
              }`}
            >
              {k === 'equipe' && <Users className="h-3.5 w-3.5" />}
              {locked && <Lock className="h-3.5 w-3.5" />}
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {tab === 'visao' && (
        <div className="space-y-4">
          {/* Mapa de progressão 4 etapas */}
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold">Mapa de Progressão (Básico → Avançado)</h2>
                <p className="text-xs text-[var(--muted)]">
                  {completedCount} de 4 provas eliminatórias concluídas por{' '}
                  <strong className="text-[var(--ink)]">{activeCollaborator}</strong>.
                </p>
              </div>
              <div className="text-right font-mono-num">
                <span className="text-xs text-[var(--muted)] block">Provas Concluídas</span>
                <strong className="text-xl text-[var(--accent)]">
                  {Math.round((completedCount / 4) * 100)}%
                </strong>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {stageKeys.map((k, idx) => {
                const best = progress.best[k];
                const unlocked = isUnlocked(k);
                const passed = isPassed(k);
                const tries = triesOf(k);
                const quickDept =
                  k === 'd1' ? 'geral' : k === 'd2' ? 'confirmacao' : k === 'd3' ? 'solicitacoes' : 'andamento';
                return (
                  <div
                    key={k}
                    className={`rounded-xl border p-4 flex flex-col justify-between gap-3 ${
                      passed
                        ? 'border-[var(--accent)] bg-[var(--surface-2)]'
                        : 'border-[var(--line)] bg-[var(--surface)]'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[var(--muted)] tabular-nums">
                          Etapa 0{idx + 1}
                        </span>
                        {!unlocked ? (
                          <StatusBadge tone="neutral">Bloqueado</StatusBadge>
                        ) : passed ? (
                          <StatusBadge tone="ok">Aprovada · {best}%</StatusBadge>
                        ) : (
                          <StatusBadge tone={best !== undefined ? 'warn' : 'info'}>
                            {best !== undefined ? `Reprovada · ${best}%` : 'Liberada'}
                          </StatusBadge>
                        )}
                      </div>
                      <h3 className="text-base font-bold">{STAGE_NAMES[k]}</h3>
                      <p className="text-xs text-[var(--muted)]">
                        {k === 'd1' && '10 questões · 12 min · mín. 85% (Chat, Agendamento, Reagendamento).'}
                        {k === 'd2' && '10 questões · 12 min · mín. 85% (Confirmação, CRM, Médicos).'}
                        {k === 'd3' && '10 questões · 12 min · mín. 85% (Solicitações, Turno, Auditoria).'}
                        {k === 'final' && '30 questões integradas · 35 min · mín. 90%.'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--line)] text-xs">
                      <span className="text-[var(--muted)] tabular-nums">
                        Tent.: {tries}/{TRN_MAXT[k]}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenQuickSim(quickDept)}
                          className="font-semibold text-[var(--muted)] hover:text-[var(--accent)] whitespace-nowrap"
                        >
                          Simular
                        </button>
                        <button
                          type="button"
                          onClick={() => setTab(k)}
                          className="font-semibold text-[var(--accent)] hover:underline whitespace-nowrap"
                        >
                          {unlocked ? (passed ? 'Revisar' : 'Acessar →') : 'Ver requisito'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 md:p-6 space-y-3">
            <h2 className="text-lg font-bold">Regras do Treinamento Hard ClickCannabis (3 Dias)</h2>
            <ul className="space-y-2 text-sm text-[var(--muted)] list-disc pl-5">
              <li>
                <strong className="text-[var(--ink)]">Provas diárias cronometradas e difíceis:</strong>{' '}
                cada dia libera apenas após concluir as 3 práticas no Simulador e exige prova de{' '}
                <strong className="text-[var(--ink)]">10 questões em 12 minutos</strong> com mínimo de{' '}
                <strong className="text-[var(--ink)]">85%</strong> (máximo 1 erro).
              </li>
              <li>
                <strong className="text-[var(--ink)]">Prova Final Hard:</strong> 30 questões (8 de
                cada dia + 6 casos críticos operacionais), cronômetro de{' '}
                <strong className="text-[var(--ink)]">35 minutos</strong>, nota mínima{' '}
                <strong className="text-[var(--ink)]">90%</strong> e apenas{' '}
                <strong className="text-[var(--ink)]">2 tentativas</strong>.
              </li>
              <li>
                <strong className="text-[var(--ink)]">Avaliação tudo ou nada:</strong> questões de
                múltipla escolha exigem todas as alternativas certas para pontuar.
              </li>
            </ul>
          </section>

          {allApproved && (
            <section className="rounded-2xl border-2 border-[var(--accent)] bg-[var(--surface)] p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <ClickCannabisLogo subtitle="Certificação Oficial Trainee" />
                  <div className="flex items-center gap-3 pt-1">
                    <div className="h-12 w-12 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center shrink-0">
                      <Award className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                        Certificação Trainee Concluída
                      </p>
                      <h2 className="text-xl font-bold">
                        {activeCollaborator} — Aprovada em todos os 7 subsetores ClickCannabis
                      </h2>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="no-print inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-2 text-sm font-semibold hover:border-[var(--accent)] whitespace-nowrap"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir certificado
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-[var(--muted)] font-mono-num pt-2 border-t border-[var(--line)]">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="inline-flex items-center gap-1.5 text-[var(--ink)]">
                    <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
                    Dia 1: {progress.best.d1}%
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1.5 text-[var(--ink)]">
                    <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
                    Dia 2: {progress.best.d2}%
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1.5 text-[var(--ink)]">
                    <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
                    Dia 3: {progress.best.d3}%
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1.5 text-[var(--ink)] font-bold">
                    <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
                    Prova Final: {progress.best.final}%
                  </span>
                </div>
                <span className="text-xs font-sans">
                  Validação: Treinadora {leadership.treinadora || cfg.madrinha.nome || 'Andréia'} ·
                  Coord. {leadership.coordenadora} · Lid. {leadership.lideranca} · Lid. Trein.{' '}
                  {leadership.liderancaTreinamento}
                </span>
              </div>
            </section>
          )}
        </div>
      )}

      {tab === 'equipe' && renderTeamMatrix()}

      {(tab === 'd1' || tab === 'd2' || tab === 'd3') && renderDayTab(tab)}

      {tab === 'final' &&
        (isUnlocked('final') ? (
          renderQuizBlock('final')
        ) : (
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-[var(--muted)] shrink-0" />
              <div>
                <h2 className="text-base font-bold">
                  Prova Final Hard bloqueada para {activeCollaborator}
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  Aprove os Dias 1, 2 e 3 (mínimo {TRN_MIN.d1}% em cada) para desbloquear a Prova
                  Final Hard.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenQuickSim('solicitacoes')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-3.5 py-2 text-xs font-semibold whitespace-nowrap"
            >
              <Bot className="h-3.5 w-3.5" />
              Treinar no Simulador
            </button>
          </section>
        ))}
    </div>
  );
}
