import React, { useEffect, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  Lock,
  Play,
  Printer,
  RotateCcw,
  ShieldAlert,
  Unlock,
} from 'lucide-react';
import {
  TRAINEE_DAYS,
  TRAINEE_INTEGRATED_POOL,
  TRN_MAXT,
  TRN_MIN,
  TRN_TIME_SECONDS,
} from '../data/defaults';
import type {
  AppView,
  TraineeProgressStore,
  TraineeQuestionRaw,
  TraineeQuestionShuffled,
  TraineeStageKey,
} from '../types';
import { pad, shuffleArray } from '../utils/helpers';
import { StatusBadge } from './StatusBadge';

interface TraineeViewProps {
  progress: TraineeProgressStore;
  onUpdateProgress: (next: TraineeProgressStore) => void;
  isAdmin: boolean;
  traineeName: string;
  onLaunchPractice: (deptKey?: string) => void;
  onGoView: (view: AppView) => void;
  onToast: (msg: string) => void;
}

interface QuizSession {
  questions: TraineeQuestionShuffled[];
  answers: Record<number, number | number[]>;
  result: { pct: number; ok: number; total: number } | null;
  startedAt: number | null;
}

type TraineeTab = 'visao' | TraineeStageKey;

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
    .slice(0, 8)
    .map(shuffleQuestion);
}

const STAGE_NAMES: Record<TraineeStageKey, string> = {
  d1: 'Dia 1 · Básico',
  d2: 'Dia 2 · Intermediário',
  d3: 'Dia 3 · Avançado',
  final: 'Prova Final Hard',
};

export function TraineeView({
  progress,
  onUpdateProgress,
  isAdmin,
  traineeName,
  onLaunchPractice,
  onGoView,
  onToast,
}: TraineeViewProps) {
  const [tab, setTab] = useState<TraineeTab>('visao');
  const [sessions, setSessions] = useState<Partial<Record<TraineeStageKey, QuizSession>>>({});
  const [finalRemaining, setFinalRemaining] = useState<number>(TRN_TIME_SECONDS);

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

  const ensureSession = (k: TraineeStageKey): QuizSession => {
    const existing = sessions[k];
    if (existing) return existing;
    const created: QuizSession = {
      questions: buildQuizSet(k),
      answers: {},
      result: null,
      startedAt: k === 'final' ? Date.now() : null,
    };
    setSessions((prev) => ({ ...prev, [k]: created }));
    return created;
  };

  useEffect(() => {
    if (tab !== 'visao' && isUnlocked(tab)) {
      const dayDef = TRAINEE_DAYS.find((d) => d.k === tab);
      const pracReady = dayDef
        ? dayDef.prat.every((task) => progress.prac[task.id])
        : true;
      if (pracReady && !sessions[tab]) {
        const created: QuizSession = {
          questions: buildQuizSet(tab),
          answers: {},
          result: null,
          startedAt: tab === 'final' ? Date.now() : null,
        };
        setSessions((prev) => ({ ...prev, [tab]: created }));
        if (tab === 'final') setFinalRemaining(TRN_TIME_SECONDS);
      }
    }
  }, [tab, progress.prac]);

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
      onToast(`Tempo esgotado! Prova corrigida automaticamente: ${pct}%.`);
    } else if (pct >= TRN_MIN[k]) {
      onToast(`Aprovado(a) com ${pct}%! Próxima etapa liberada.`);
    } else {
      onToast(`Nota ${pct}%. Abaixo do mínimo exigido de ${TRN_MIN[k]}%.`);
    }
  };

  useEffect(() => {
    const finalSession = sessions.final;
    if (tab !== 'final' || !finalSession || finalSession.result || !finalSession.startedAt) {
      return;
    }

    const tick = () => {
      const elapsed = Math.floor((Date.now() - (finalSession.startedAt || Date.now())) / 1000);
      const rem = Math.max(0, TRN_TIME_SECONDS - elapsed);
      setFinalRemaining(rem);
      if (rem <= 0) {
        gradeQuiz('final', true);
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [tab, sessions.final]);

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
      startedAt: k === 'final' ? Date.now() : null,
    };
    if (k === 'final') setFinalRemaining(TRN_TIME_SECONDS);
    setSessions((prev) => ({ ...prev, [k]: fresh }));
  };

  const handleUnlockTries = (k: TraineeStageKey) => {
    onUpdateProgress({
      ...progress,
      tries: { ...progress.tries, [k]: 0 },
    });
    handleRetry(k);
    onToast(`Novas tentativas liberadas para ${STAGE_NAMES[k]}.`);
  };

  const handleResetAll = () => {
    onUpdateProgress({
      prac: {},
      best: {},
      tries: {},
      date: {},
      simSignals: {},
    });
    setSessions({});
    setTab('visao');
    onToast('Progresso do programa Trainee reiniciado.');
  };

  const stageKeys: TraineeStageKey[] = ['d1', 'd2', 'd3', 'final'];
  const allApproved = stageKeys.every(isPassed);
  const completedCount = stageKeys.filter(isPassed).length;

  const renderQuizBlock = (k: TraineeStageKey) => {
    const session = sessions[k] || ensureSession(k);
    const tries = triesOf(k);
    const remainingTries = TRN_MAXT[k] - tries;
    const exhaustedWithoutPass = !isPassed(k) && remainingTries <= 0 && !session.result;

    if (exhaustedWithoutPass) {
      return (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-[var(--danger)] shrink-0 mt-0.5" />
            <div className="space-y-3">
              <h2 className="text-lg font-bold">Tentativas esgotadas</h2>
              <p className="text-sm text-[var(--muted)]">
                Você utilizou todas as {TRN_MAXT[k]} tentativas disponíveis para esta etapa. Procure a
                instrutora ou coordenação para revisar os erros e liberar uma nova tentativa.
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleUnlockTries(k)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2 text-sm font-semibold whitespace-nowrap"
                >
                  <Unlock className="h-4 w-4" />
                  Liberar nova tentativa (Instrutora)
                </button>
              )}
            </div>
          </div>
        </section>
      );
    }

    const answeredCount = session.questions.filter((_, idx) => {
      const a = session.answers[idx];
      return Array.isArray(a) ? a.length > 0 : a !== undefined;
    }).length;
    const allAnswered = answeredCount === session.questions.length;

    return (
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 md:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
          <div>
            <h2 className="text-lg font-bold">
              {k === 'final'
                ? 'Prova Final Hard · 30 questões'
                : `Prova do Dia · 8 questões`}
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Nota mínima: <span className="font-semibold text-[var(--ink)]">{TRN_MIN[k]}%</span> ·
              Questões embaralhadas e sem consulta · Múltipla escolha vale tudo ou nada
            </p>
          </div>

          {k === 'final' && !session.result && (
            <div
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-bold font-mono-num ${
                finalRemaining < 300
                  ? 'border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]'
                  : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)]'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>
                {pad(Math.floor(finalRemaining / 60))}:{pad(finalRemaining % 60)}
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
                      marque todas as corretas
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
                    <strong className="text-[var(--ink)]">Critério:</strong> {q.w}
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
                  ? 'Aprovado(a)'
                  : `Abaixo da nota mínima de ${TRN_MIN[k]}%`}
              </div>

              {session.result.pct < TRN_MIN[k] &&
                (TRN_MAXT[k] - triesOf(k) > 0 ? (
                  <button
                    type="button"
                    onClick={() => handleRetry(k)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2.5 text-sm font-semibold whitespace-nowrap"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Tentar de novo ({TRN_MAXT[k] - triesOf(k)} restante
                    {TRN_MAXT[k] - triesOf(k) > 1 ? 's' : ''})
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs text-[var(--muted)]">
                      Tentativas esgotadas. Procure a treinadora para liberar nova tentativa.
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
                  onClick={() =>
                    setTab(k === 'd1' ? 'd2' : k === 'd2' ? 'd3' : 'final')
                  }
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
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 flex items-center gap-3">
          <Lock className="h-5 w-5 text-[var(--muted)] shrink-0" />
          <div>
            <h2 className="text-base font-bold">Módulo bloqueado</h2>
            <p className="text-sm text-[var(--muted)]">
              Conclua as práticas e seja aprovado(a) na prova do dia anterior (mínimo 80%) para
              desbloquear esta etapa.
            </p>
          </div>
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
                Nível {day.nivel}
              </span>
              <h2 className="text-xl font-bold mt-0.5">{day.titulo}</h2>
            </div>
            <StatusBadge tone={isPassed(dayKey) ? 'ok' : 'info'}>
              {isPassed(dayKey) ? `Aprovado · ${progress.best[dayKey]}%` : 'Em treinamento'}
            </StatusBadge>
          </div>

          <p className="text-sm text-[var(--muted)]">
            <strong className="text-[var(--ink)]">Meta do dia:</strong> {day.meta}
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {day.subs.map(([subName, bullets]) => (
              <div
                key={subName}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4 space-y-2"
              >
                <h3 className="text-sm font-bold text-[var(--ink)]">{subName}</h3>
                <ul className="space-y-1.5 text-xs text-[var(--muted)] list-disc pl-4">
                  {bullets.map((b, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 md:p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">Prática obrigatória no Simulador</h2>
              <p className="text-xs text-[var(--muted)]">
                Execute cada tarefa no Simulador de IA (ou CRM/Solicitações) e marque abaixo. A
                prova do dia libera após concluir todas.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onLaunchPractice(day.prat[0]?.deptKey)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
            >
              <Play className="h-3.5 w-3.5 text-[var(--accent)]" />
              Abrir Simulador
            </button>
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
                      <button
                        type="button"
                        onClick={() => onLaunchPractice(task.deptKey)}
                        className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
                      >
                        Ir praticar →
                      </button>
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
          <section className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
            A prova do {dayKey === 'd1' ? 'Dia 1' : dayKey === 'd2' ? 'Dia 2' : 'Dia 3'} será
            liberada assim que todas as práticas acima forem concluídas e marcadas.
          </section>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-[1380px] mx-auto space-y-5">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--muted)]">
            Home · Programa Corporativo · Básico ao Avançado
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-0.5">
            Treinamento Trainee · 3 Dias Intensivos
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Formação progressiva do nível básico ao avançado em todos os 7 subsetores, com prática
            no Simulador de IA e provas eliminatórias.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
              onClick={handleResetAll}
              className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--danger)] hover:border-[var(--danger)] whitespace-nowrap"
            >
              Resetar progresso
            </button>
          )}
        </div>
      </div>

      <div
        className="no-print flex flex-wrap gap-2"
        role="tablist"
        aria-label="Etapas do Programa Trainee"
      >
        {(
          [
            ['visao', 'Visão Geral'],
            ['d1', 'Dia 1 · Básico'],
            ['d2', 'Dia 2 · Intermediário'],
            ['d3', 'Dia 3 · Avançado'],
            ['final', 'Prova Final Hard'],
          ] as Array<[TraineeTab, string]>
        ).map(([k, label]) => {
          const locked = k !== 'visao' && !isUnlocked(k);
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
              {locked && <Lock className="h-3.5 w-3.5" />}
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {tab === 'visao' && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold">Mapa de Progressão (Básico → Avançado)</h2>
                <p className="text-xs text-[var(--muted)]">
                  Conclua {completedCount} de 4 etapas obrigatórias para conquistar a certificação
                  Trainee.
                </p>
              </div>
              <div className="text-right font-mono-num">
                <span className="text-xs text-[var(--muted)] block">Conclusão Geral</span>
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
                          <StatusBadge tone="ok">Aprovado · {best}%</StatusBadge>
                        ) : (
                          <StatusBadge tone={best !== undefined ? 'warn' : 'info'}>
                            {best !== undefined ? `Reprovado · ${best}%` : 'Liberado'}
                          </StatusBadge>
                        )}
                      </div>
                      <h3 className="text-base font-bold">{STAGE_NAMES[k]}</h3>
                      <p className="text-xs text-[var(--muted)]">
                        {k === 'd1' && 'Chat geral, Agendamento e Reagendamento (mín. 80%).'}
                        {k === 'd2' && 'Confirmação, Suporte aos pacientes e Médicos (mín. 80%).'}
                        {k === 'd3' && 'Solicitações, turno e qualidade operacional (mín. 80%).'}
                        {k === 'final' && '30 questões integradas · 45 min · mín. 90%.'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[var(--line)] text-xs">
                      <span className="text-[var(--muted)] tabular-nums">
                        Tentativas: {tries}/{TRN_MAXT[k]}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTab(k)}
                        className="font-semibold text-[var(--accent)] hover:underline whitespace-nowrap"
                      >
                        {unlocked ? (passed ? 'Revisar' : 'Acessar →') : 'Ver requisito'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 md:p-6 space-y-3">
            <h2 className="text-lg font-bold">Regras do Treinamento Hard (3 Dias)</h2>
            <ul className="space-y-2 text-sm text-[var(--muted)] list-disc pl-5">
              <li>
                <strong className="text-[var(--ink)]">Cobertura total dos 7 subsetores:</strong>{' '}
                Dia 1 (Nível Básico) foca entrada, agendamento e regra das 2 horas; Dia 2 (Nível
                Intermediário) foca confirmação ativa, CRM ao vivo e suporte médico; Dia 3 (Nível
                Avançado) foca Solicitações, levantamento e passagem de turno.
              </li>
              <li>
                <strong className="text-[var(--ink)]">Critério rigoroso de aprovação:</strong> cada
                dia exige práticas concluídas no Simulador e prova de 8 questões com mínimo de{' '}
                <strong className="text-[var(--ink)]">80%</strong> (máximo 1 erro). A etapa
                seguinte só abre após aprovação.
              </li>
              <li>
                <strong className="text-[var(--ink)]">Prova Final Hard:</strong> 30 questões (8 de
                cada dia + 6 casos integrados), cronômetro de{' '}
                <strong className="text-[var(--ink)]">45 minutos</strong>, nota mínima{' '}
                <strong className="text-[var(--ink)]">90%</strong> (máximo 3 erros) e apenas{' '}
                <strong className="text-[var(--ink)]">2 tentativas</strong>.
              </li>
              <li>
                <strong className="text-[var(--ink)]">Avaliação tudo ou nada:</strong> questões
                com múltiplas opções corretas exigem todas as marcações certas para pontuar.
              </li>
            </ul>
          </section>

          {allApproved && (
            <section className="rounded-2xl border-2 border-[var(--accent)] bg-[var(--surface)] p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center shrink-0">
                    <Award className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                      Certificação Concluída
                    </p>
                    <h2 className="text-xl font-bold">
                      {traineeName || 'Colaboradora'} — Aprovado(a) como Trainee em todos os
                      subsetores
                    </h2>
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
              <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)] font-mono-num pt-2 border-t border-[var(--line)]">
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
            </section>
          )}
        </div>
      )}

      {(tab === 'd1' || tab === 'd2' || tab === 'd3') && renderDayTab(tab)}

      {tab === 'final' &&
        (isUnlocked('final') ? (
          renderQuizBlock('final')
        ) : (
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 flex items-center gap-3">
            <Lock className="h-5 w-5 text-[var(--muted)] shrink-0" />
            <div>
              <h2 className="text-base font-bold">Prova Final bloqueada</h2>
              <p className="text-sm text-[var(--muted)]">
                Aprove os Dias 1, 2 e 3 (mínimo 80% em cada) para desbloquear a Prova Final Hard.
              </p>
            </div>
          </section>
        ))}
    </div>
  );
}
