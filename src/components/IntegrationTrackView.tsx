import React, { useState } from 'react';
import { TRILHA_STAGES } from '../data/defaults';
import type { PortalConfig } from '../types';
import { StatusBadge } from './StatusBadge';

export interface TrilhaStore {
  items: Record<string, boolean>;
  quiz: Record<string, number>;
  valid: Record<string, { by: string; at: number }>;
}

interface IntegrationTrackViewProps {
  cfg: PortalConfig;
  trilhaData: Record<string, TrilhaStore>;
  onUpdateTrilha: (personName: string, next: TrilhaStore) => void;
  isAdmin: boolean;
  traineeName: string;
  onToast: (msg: string) => void;
}

const EMPTY_TRILHA: TrilhaStore = { items: {}, quiz: {}, valid: {} };

export function IntegrationTrackView({
  cfg,
  trilhaData,
  onUpdateTrilha,
  isAdmin,
  traineeName,
  onToast,
}: IntegrationTrackViewProps) {
  const [selectedPerson, setSelectedPerson] = useState<string>('');
  const [quizStates, setQuizStates] = useState<
    Record<string, { answers: Record<number, number>; sent: boolean; score: number }>
  >({});

  const myName = traineeName.trim() || 'Trainee';
  const activePerson = isAdmin && selectedPerson ? selectedPerson : myName;
  const record = trilhaData[activePerson] || EMPTY_TRILHA;

  const totalItems = TRILHA_STAGES.reduce((acc, s) => acc + s.items.length, 0);
  const doneItems = TRILHA_STAGES.reduce(
    (acc, s) => acc + s.items.filter(([id]) => record.items[id]).length,
    0
  );
  const pct = totalItems ? Math.round((doneItems / totalItems) * 100) : 0;

  const knownPeople = Array.from(new Set([myName, ...Object.keys(trilhaData)])).sort();

  const handleToggleItem = (itemId: string, checked: boolean) => {
    onUpdateTrilha(activePerson, {
      ...record,
      items: { ...record.items, [itemId]: checked },
    });
  };

  const handleAnswerQuiz = (stageId: string, qi: number, oi: number) => {
    const cur = quizStates[stageId] || { answers: {}, sent: false, score: 0 };
    if (cur.sent) return;
    setQuizStates((prev) => ({
      ...prev,
      [stageId]: { ...cur, answers: { ...cur.answers, [qi]: oi } },
    }));
  };

  const handleSubmitQuiz = (stageId: string) => {
    const stage = TRILHA_STAGES.find((s) => s.id === stageId);
    if (!stage) return;
    const cur = quizStates[stageId] || { answers: {}, sent: false, score: 0 };
    if (Object.keys(cur.answers).length < stage.quiz.length) {
      onToast('Responda todas as perguntas do quiz.');
      return;
    }
    const ok = stage.quiz.filter((q, qi) => cur.answers[qi] === q[2]).length;
    const score = Math.round((ok / stage.quiz.length) * 100);
    setQuizStates((prev) => ({
      ...prev,
      [stageId]: { ...cur, sent: true, score },
    }));
    const prevBest = record.quiz[stageId];
    if (prevBest === undefined || score > prevBest) {
      onUpdateTrilha(activePerson, {
        ...record,
        quiz: { ...record.quiz, [stageId]: score },
      });
    }
  };

  const handleValidateStage = (stageId: string) => {
    if (!isAdmin) return;
    const nextValid = { ...record.valid };
    if (nextValid[stageId]) {
      delete nextValid[stageId];
    } else {
      nextValid[stageId] = { by: cfg.madrinha.nome || 'Instrutora', at: Date.now() };
    }
    onUpdateTrilha(activePerson, { ...record, valid: nextValid });
    onToast('Validação da etapa atualizada.');
  };

  return (
    <div className="max-w-[1360px] mx-auto space-y-5">
      <div>
        <p className="text-xs text-[var(--muted)]">Desenvolvimento & Treinamento</p>
        <h1 className="text-2xl font-bold mt-0.5">Trilha de Integração</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Seu caminho estruturado por etapa. Marque o que já concluiu, responda ao quiz de cada
          fase e peça validação da madrinha.
        </p>
      </div>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-[220px]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
            {activePerson === myName ? 'Seu progresso' : `Progresso de ${activePerson}`}
          </span>
          <div className="flex items-baseline gap-3">
            <strong className="font-display text-3xl tabular-nums">{pct}%</strong>
            <span className="text-xs text-[var(--muted)] tabular-nums">
              {doneItems} de {totalItems} itens concluídos
            </span>
          </div>
          <div className="h-2 w-60 max-w-full rounded-full bg-[var(--sunk)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {isAdmin && (
          <label className="flex items-center gap-2 text-xs font-semibold">
            <span>Ver trilha de:</span>
            <select
              value={selectedPerson}
              onChange={(e) => setSelectedPerson(e.target.value)}
              className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs"
            >
              <option value="">{myName} (atual)</option>
              {knownPeople
                .filter((p) => p !== myName)
                .map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
            </select>
          </label>
        )}
      </section>

      <div className="space-y-3.5">
        {TRILHA_STAGES.map((stage, idx) => {
          const doneCount = stage.items.filter(([id]) => record.items[id]).length;
          const allDone = doneCount === stage.items.length;
          const valid = record.valid[stage.id];
          const bestQuiz = record.quiz[stage.id];
          const qState = quizStates[stage.id];

          return (
            <section
              key={stage.id}
              className={`rounded-2xl border p-5 space-y-3 bg-[var(--surface)] ${
                allDone ? 'border-[var(--accent)]' : 'border-[var(--line)]'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span
                    className={`h-8 w-8 rounded-full font-bold text-xs grid place-items-center shrink-0 tabular-nums ${
                      allDone
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'bg-[var(--surface-2)] text-[var(--muted)] border border-[var(--line)]'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <h2 className="text-base font-bold">{stage.t}</h2>
                    <p className="text-xs text-[var(--muted)]">{stage.d}</p>
                  </div>
                </div>

                <StatusBadge tone={valid ? 'ok' : allDone ? 'warn' : 'neutral'}>
                  {valid
                    ? `Validada por ${valid.by}`
                    : `${doneCount}/${stage.items.length} itens`}
                </StatusBadge>
              </div>

              <ul className="space-y-2 pt-1">
                {stage.items.map(([id, label]) => (
                  <li key={id}>
                    <label className="inline-flex items-start gap-2.5 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(record.items[id])}
                        onChange={(e) => handleToggleItem(id, e.target.checked)}
                        className="mt-1 h-4 w-4 accent-[var(--accent)]"
                      />
                      <span>{label}</span>
                    </label>
                  </li>
                ))}
              </ul>

              {stage.quiz.length > 0 && (
                <details
                  open={Boolean(qState)}
                  className="rounded-xl bg-[var(--surface-2)] border border-[var(--line)] p-3.5 text-xs space-y-3"
                >
                  <summary className="cursor-pointer font-bold select-none">
                    Quiz da etapa{' '}
                    {bestQuiz !== undefined ? `· melhor nota: ${bestQuiz}%` : ''}
                  </summary>

                  <div className="space-y-3 pt-2">
                    {stage.quiz.map(([qq, opts, correctIdx], qi) => {
                      const ans = qState?.answers[qi];
                      return (
                        <div key={qi} className="space-y-1.5">
                          <p className="font-semibold text-sm">
                            {qi + 1}. {qq}
                          </p>
                          <div className="grid gap-1.5">
                            {opts.map((opt, oi) => {
                              let cls =
                                'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]';
                              if (qState?.sent) {
                                if (oi === correctIdx) {
                                  cls =
                                    'border-[var(--accent)] bg-[var(--accent-soft)] font-semibold';
                                } else if (ans === oi) {
                                  cls =
                                    'border-[var(--danger)] bg-[var(--danger-soft)] line-through';
                                }
                              } else if (ans === oi) {
                                cls = 'border-[var(--accent)] bg-[var(--accent-soft)]';
                              }
                              return (
                                <button
                                  key={oi}
                                  type="button"
                                  disabled={Boolean(qState?.sent)}
                                  onClick={() => handleAnswerQuiz(stage.id, qi, oi)}
                                  className={`text-left rounded-lg border px-3 py-2 text-xs ${cls}`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {qState?.sent ? (
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <span className="font-bold text-sm">
                          Resultado: {qState.score}%{' '}
                          {qState.score >= 75
                            ? '· Aprovado nesta etapa.'
                            : '· Revise os itens e tente novamente.'}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setQuizStates((prev) => ({
                              ...prev,
                              [stage.id]: { answers: {}, sent: false, score: 0 },
                            }))
                          }
                          className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 font-semibold"
                        >
                          Refazer quiz
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSubmitQuiz(stage.id)}
                        className="rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] px-3.5 py-1.5 font-semibold"
                      >
                        Corrigir quiz
                      </button>
                    )}
                  </div>
                </details>
              )}

              {isAdmin && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handleValidateStage(stage.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold border ${
                      valid
                        ? 'border-[var(--line)] bg-[var(--surface)]'
                        : 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
                    }`}
                  >
                    {valid ? 'Desfazer validação' : 'Validar etapa (madrinha)'}
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
