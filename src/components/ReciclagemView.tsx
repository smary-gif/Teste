import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Bot,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Lock,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Unlock,
  Users,
} from 'lucide-react';
import {
  computeReciclagemStatus,
  DEFAULT_LEADERSHIP,
  EMPTY_RECICLAGEM_PROGRESS,
  RECICLAGEM_CICLO_ATUAL,
  RECICLAGEM_MAXT,
  RECICLAGEM_MIN,
  RECICLAGEM_MODULES,
  RECICLAGEM_PRESET_PONTOS,
  RECICLAGEM_QUESTION_POOL,
  RECICLAGEM_TIME_SECONDS,
  TENURE_LABELS,
  TR_SUBS,
} from '../data/defaults';
import type {
  AppView,
  PortalConfig,
  ReciclagemCalibrationPoint,
  ReciclagemPersonProgress,
  TenureBracket,
  TraineeQuestionRaw,
  TraineeQuestionShuffled,
} from '../types';
import { norm, pad, shuffleArray } from '../utils/helpers';
import { ClickCannabisLogo } from './ClickCannabisLogo';
import { StatusBadge } from './StatusBadge';

interface ReciclagemViewProps {
  cfg: PortalConfig;
  collaborators: string[];
  activeCollaborator: string;
  onChangeCollaborator: (name: string) => void;
  reciclagemByPerson: Record<string, ReciclagemPersonProgress>;
  onUpdateReciclagem: (name: string, next: ReciclagemPersonProgress) => void;
  isAdmin: boolean;
  onOpenQuickSim: (deptKey?: string) => void;
  onGoView: (view: AppView) => void;
  onToast: (msg: string) => void;
}

type ReciclagemTab = 'trilha' | 'veteranas' | 'calibracao';

interface ExamSession {
  questions: TraineeQuestionShuffled[];
  answers: Record<number, number | number[]>;
  result: { pct: number; ok: number; total: number } | null;
  startedAt: number | null;
}

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

function buildReciclagemExam(): TraineeQuestionShuffled[] {
  return shuffleArray(RECICLAGEM_QUESTION_POOL)
    .slice(0, 15)
    .map(shuffleQuestion);
}

const PRESET_TO_DEPT: Record<string, string> = {
  'Agenda futura sem solicitação à Liderança': 'reagendamento',
  'Nota interna incompleta na etapa 4.4': 'confirmacao',
  'Reagendamento < 2h sem aplicar /devido': 'reagendamento',
  'Dúvida de posologia sem abrir Solicitação médica': 'solicitacoes',
  'Chat encerrado sem registro de desfecho': 'geral',
  'Card de CRM desatualizado durante atendimento': 'andamento',
};

export function ReciclagemView({
  cfg,
  collaborators,
  activeCollaborator,
  onChangeCollaborator,
  reciclagemByPerson,
  onUpdateReciclagem,
  isAdmin,
  onOpenQuickSim,
  onGoView,
  onToast,
}: ReciclagemViewProps) {
  const leadership = cfg.lideranca || DEFAULT_LEADERSHIP;
  const trainerName = leadership.treinadora || cfg.madrinha.nome || 'Andréia';

  const current: ReciclagemPersonProgress =
    reciclagemByPerson[activeCollaborator] || EMPTY_RECICLAGEM_PROGRESS(activeCollaborator);
  const summary = useMemo(() => computeReciclagemStatus(current), [current]);

  const [tab, setTab] = useState<ReciclagemTab>('trilha');
  const [examSession, setExamSession] = useState<ExamSession | null>(null);
  const [remainingSecs, setRemainingSecs] = useState<number>(RECICLAGEM_TIME_SECONDS);

  // Team filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [teamFilter, setTeamFilter] = useState<'veteranas' | 'todas' | 'pendentes' | 'aprovadas'>(
    'veteranas'
  );
  const [sectorFilter, setSectorFilter] = useState<string>('Todos');

  // Calibration form state
  const [calTema, setCalTema] = useState(RECICLAGEM_PRESET_PONTOS[0]);
  const [calObs, setCalObs] = useState('');

  useEffect(() => {
    setExamSession(null);
    setRemainingSecs(RECICLAGEM_TIME_SECONDS);
  }, [activeCollaborator]);

  const allChecklistDone = summary.checklistDone === summary.checklistTotal;

  const startExam = () => {
    setExamSession({
      questions: buildReciclagemExam(),
      answers: {},
      result: null,
      startedAt: Date.now(),
    });
    setRemainingSecs(RECICLAGEM_TIME_SECONDS);
  };

  const gradeExam = (forcedTimeout = false) => {
    if (!examSession || examSession.result) return;

    let okCount = 0;
    examSession.questions.forEach((q, qi) => {
      const rawAns = examSession.answers[qi];
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

    const pct = Math.round((okCount / examSession.questions.length) * 100);
    setExamSession((prev) =>
      prev ? { ...prev, result: { pct, ok: okCount, total: prev.questions.length } } : prev
    );

    const prevBest = current.examBest || 0;
    onUpdateReciclagem(activeCollaborator, {
      ...current,
      examBest: Math.max(prevBest, pct),
      examTries: current.examTries + 1,
      examDate: new Date().toLocaleDateString('pt-BR'),
    });

    if (forcedTimeout) {
      onToast(`Tempo esgotado! Prova de reciclagem de ${activeCollaborator}: ${pct}%.`);
    } else if (pct >= RECICLAGEM_MIN) {
      onToast(`Reciclagem concluída por ${activeCollaborator} com ${pct}%!`);
    } else {
      onToast(`Nota ${pct}%. Mínimo exigido na reciclagem: ${RECICLAGEM_MIN}%.`);
    }
  };

  useEffect(() => {
    if (tab !== 'trilha' || !examSession || examSession.result || !examSession.startedAt) {
      return;
    }

    const tick = () => {
      const elapsed = Math.floor((Date.now() - (examSession.startedAt || Date.now())) / 1000);
      const rem = Math.max(0, RECICLAGEM_TIME_SECONDS - elapsed);
      setRemainingSecs(rem);
      if (rem <= 0) {
        gradeExam(true);
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [tab, examSession]);

  const handleToggleChecklist = (itemId: string) => {
    onUpdateReciclagem(activeCollaborator, {
      ...current,
      checklist: {
        ...current.checklist,
        [itemId]: !current.checklist[itemId],
      },
    });
  };

  const handleCompleteModule = (modId: string) => {
    const mod = RECICLAGEM_MODULES.find((m) => m.id === modId);
    if (!mod) return;
    const nextChecklist = { ...current.checklist };
    const allChecked = mod.checklist.every((c) => nextChecklist[c.id]);
    mod.checklist.forEach((c) => {
      nextChecklist[c.id] = !allChecked;
    });
    onUpdateReciclagem(activeCollaborator, {
      ...current,
      checklist: nextChecklist,
    });
    onToast(
      allChecked
        ? `Checklist do módulo ${mod.ordem} desmarcado.`
        : `Módulo ${mod.ordem} validado para ${activeCollaborator}.`
    );
  };

  const handleSelectAnswer = (qi: number, oi: number, isMulti: boolean) => {
    if (!examSession || examSession.result) return;
    const prevAns = examSession.answers[qi];
    let updated: number | number[];
    if (isMulti) {
      const arr = Array.isArray(prevAns)
        ? prevAns
        : prevAns !== undefined
          ? [prevAns]
          : [];
      updated = arr.includes(oi) ? arr.filter((x) => x !== oi) : [...arr, oi];
    } else {
      updated = oi;
    }
    setExamSession((prev) =>
      prev ? { ...prev, answers: { ...prev.answers, [qi]: updated } } : prev
    );
  };

  const handleUnlockTries = () => {
    onUpdateReciclagem(activeCollaborator, {
      ...current,
      examTries: 0,
    });
    startExam();
    onToast(`Novas tentativas liberadas para ${activeCollaborator}.`);
  };

  const handleResetPerson = () => {
    onUpdateReciclagem(activeCollaborator, EMPTY_RECICLAGEM_PROGRESS(activeCollaborator));
    setExamSession(null);
    onToast(`Ciclo de reciclagem de ${activeCollaborator} reiniciado.`);
  };

  const handleAddCalibration = (e: React.FormEvent) => {
    e.preventDefault();
    const obsClean = calObs.trim() || `Reforçar alinhamento operacional em: ${calTema}`;
    const point: ReciclagemCalibrationPoint = {
      id: `cal_${Date.now()}`,
      tema: calTema,
      observacao: obsClean,
      autor: isAdmin ? `Treinadora ${trainerName}` : activeCollaborator,
      data: new Date().toLocaleDateString('pt-BR'),
      resolvido: false,
    };
    onUpdateReciclagem(activeCollaborator, {
      ...current,
      calibracoes: [point, ...current.calibracoes],
    });
    setCalObs('');
    onToast(`Ponto de calibração registrado para ${activeCollaborator}.`);
  };

  const handleToggleCalResolved = (id: string) => {
    onUpdateReciclagem(activeCollaborator, {
      ...current,
      calibracoes: current.calibracoes.map((c) =>
        c.id === id ? { ...c, resolvido: !c.resolvido } : c
      ),
    });
  };

  const teamRows = useMemo(() => {
    const q = norm(searchTerm.trim());
    return collaborators
      .map((name) => {
        const rec = reciclagemByPerson[name] || EMPTY_RECICLAGEM_PROGRESS(name);
        const st = computeReciclagemStatus(rec);
        return { name, rec, st };
      })
      .filter(({ name, rec, st }) => {
        if (q && !norm(name).includes(q) && !norm(rec.subsetorPrincipal).includes(q)) {
          return false;
        }
        if (sectorFilter !== 'Todos' && rec.subsetorPrincipal !== sectorFilter) {
          return false;
        }
        if (teamFilter === 'veteranas') {
          return rec.tenure === 'veterana_1a' || rec.tenure === 'plena_6m';
        }
        if (teamFilter === 'pendentes') {
          return st.status !== 'Aprovada';
        }
        if (teamFilter === 'aprovadas') {
          return st.status === 'Aprovada';
        }
        return true;
      });
  }, [collaborators, reciclagemByPerson, searchTerm, teamFilter, sectorFilter]);

  const veteranTotal = useMemo(
    () =>
      collaborators.filter((n) => {
        const t = (reciclagemByPerson[n] || EMPTY_RECICLAGEM_PROGRESS(n)).tenure;
        return t === 'veterana_1a' || t === 'plena_6m';
      }).length,
    [collaborators, reciclagemByPerson]
  );

  const openCalCount = current.calibracoes.filter((c) => !c.resolvido).length;
  const resolvedCalCount = current.calibracoes.filter((c) => c.resolvido).length;

  const statusTone =
    summary.status === 'Aprovada'
      ? 'ok'
      : summary.status === 'Em reciclagem'
        ? 'info'
        : 'warn';

  const remainingTries = RECICLAGEM_MAXT - current.examTries;
  const exhaustedWithoutPass =
    !summary.examPassed && remainingTries <= 0 && !examSession?.result;

  const renderExamSection = () => {
    if (!allChecklistDone) {
      return (
        <section className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-[var(--muted)] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-bold">
                Prova de Reciclagem bloqueada ({summary.checklistDone}/{summary.checklistTotal}{' '}
                itens)
              </h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Conclua o checklist dos 4 módulos de atualização acima para liberar a avaliação
                cronometrada de 15 questões (mínimo {RECICLAGEM_MIN}%).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenQuickSim('reagendamento')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap shrink-0"
          >
            <Bot className="h-3.5 w-3.5 text-[var(--accent)]" />
            Praticar antes no Simulador
          </button>
        </section>
      );
    }

    if (exhaustedWithoutPass) {
      return (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-[var(--danger)] shrink-0 mt-0.5" />
            <div className="space-y-3">
              <h2 className="text-lg font-bold">
                Tentativas de reciclagem esgotadas — {activeCollaborator}
              </h2>
              <p className="text-sm text-[var(--muted)]">
                Foram usadas todas as {RECICLAGEM_MAXT} tentativas deste ciclo. Revise os pontos
                críticos com a Treinadora {trainerName} no Simulador antes de liberar nova rodada.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onOpenQuickSim('confirmacao')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap shrink-0"
                >
                  <Bot className="h-3.5 w-3.5 text-[var(--accent)]" />
                  Treinar no Simulador
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleUnlockTries}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    Liberar nova tentativa (Instrutora)
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (!examSession) {
      return (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold">
              Prova de Calibração e Reciclagem · 15 questões avançadas
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Candidata: <strong className="text-[var(--ink)]">{activeCollaborator}</strong> ·
              Tempo: <strong className="text-[var(--ink)]">18 min</strong> · Nota mínima:{' '}
              <strong className="text-[var(--ink)]">{RECICLAGEM_MIN}%</strong> · Tentativas usadas:{' '}
              <strong className="font-mono-num text-[var(--ink)]">
                {current.examTries}/{RECICLAGEM_MAXT}
              </strong>
              {current.examBest !== undefined && (
                <>
                  {' '}
                  · Melhor nota:{' '}
                  <strong className="font-mono-num text-[var(--accent)]">
                    {current.examBest}%
                  </strong>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={startExam}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-5 py-2.5 text-sm font-semibold hover:brightness-105 whitespace-nowrap shrink-0"
          >
            <ClipboardCheck className="h-4 w-4" />
            {summary.examPassed ? 'Refazer prova para revisão' : 'Iniciar prova de reciclagem'}
          </button>
        </section>
      );
    }

    const answeredCount = examSession.questions.filter((_, idx) => {
      const a = examSession.answers[idx];
      return Array.isArray(a) ? a.length > 0 : a !== undefined;
    }).length;
    const allAnswered = answeredCount === examSession.questions.length;
    const isUrgent = remainingSecs < 120;

    return (
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 md:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
          <div>
            <h2 className="text-lg font-bold">
              Prova de Reciclagem · {RECICLAGEM_CICLO_ATUAL}
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Colaboradora: <strong className="text-[var(--ink)]">{activeCollaborator}</strong> ·
              Mínimo: <strong className="text-[var(--ink)]">{RECICLAGEM_MIN}%</strong> · Múltipla
              escolha vale tudo ou nada
            </p>
          </div>

          {!examSession.result && (
            <div
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-bold font-mono-num ${
                isUrgent
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
          {examSession.questions.map((q, qi) => {
            const rawAns = examSession.answers[qi];
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
                    if (examSession.result) {
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
                        disabled={Boolean(examSession.result)}
                        onClick={() => handleSelectAnswer(qi, oi, q.m)}
                        className={`w-full text-left rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${cls}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {examSession.result && (
                  <p className="text-xs text-[var(--muted)] bg-[var(--surface-2)] rounded-lg px-3 py-2">
                    <strong className="text-[var(--ink)]">Critério ClickCannabis:</strong> {q.w}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-[var(--line)] flex flex-wrap items-center gap-3">
          {!examSession.result ? (
            <button
              type="button"
              disabled={!allAnswered}
              onClick={() => gradeExam(false)}
              className="rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-5 py-2.5 text-sm font-semibold disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              Corrigir reciclagem ({answeredCount}/{examSession.questions.length})
            </button>
          ) : (
            <>
              <div
                className={`rounded-xl px-4 py-2.5 text-sm font-bold tabular-nums ${
                  examSession.result.pct >= RECICLAGEM_MIN
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'bg-[var(--danger-soft)] text-[var(--danger)]'
                }`}
              >
                {examSession.result.pct}% ({examSession.result.ok} de {examSession.result.total}) ·{' '}
                {examSession.result.pct >= RECICLAGEM_MIN
                  ? 'Aprovada na Reciclagem'
                  : `Abaixo do mínimo (${RECICLAGEM_MIN}%)`}
              </div>

              {examSession.result.pct < RECICLAGEM_MIN &&
                (RECICLAGEM_MAXT - current.examTries > 0 ? (
                  <button
                    type="button"
                    onClick={startExam}
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2.5 text-sm font-semibold whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Tentar novamente ({RECICLAGEM_MAXT - current.examTries} restante
                    {RECICLAGEM_MAXT - current.examTries > 1 ? 's' : ''})
                  </button>
                ) : (
                  isAdmin && (
                    <button
                      type="button"
                      onClick={handleUnlockTries}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap shrink-0"
                    >
                      <Unlock className="h-3.5 w-3.5" />
                      Liberar nova tentativa
                    </button>
                  )
                ))}
            </>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="max-w-[1380px] mx-auto space-y-5">
      {/* Header corporativo */}
      <div className="no-print rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1.5">
            <ClickCannabisLogo subtitle="Programa de Reciclagem · Equipe Experiente" />
            <h1 className="text-2xl md:text-3xl font-bold">
              Reciclagem Operacional · {activeCollaborator}
            </h1>
            <p className="text-xs text-[var(--muted)]">
              {TENURE_LABELS[current.tenure].label} · Setor {current.subsetorPrincipal} ·{' '}
              {current.ciclo} · Treinadora {trainerName} · Coord. {leadership.coordenadora} ·
              Liderança {leadership.lideranca} · Lid. Trein. {leadership.liderancaTreinamento}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenQuickSim('reagendamento')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-3.5 py-2 text-xs font-semibold hover:brightness-105 whitespace-nowrap shrink-0"
            >
              <Bot className="h-3.5 w-3.5" />
              Simular Atualização
            </button>
            <button
              type="button"
              onClick={() => onGoView('consultas')}
              className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap shrink-0"
            >
              Abrir Consultas
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={handleResetPerson}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--danger)] hover:border-[var(--danger)] whitespace-nowrap shrink-0"
              >
                Reiniciar ciclo
              </button>
            )}
          </div>
        </div>

        {/* KPI strip (4 columns, clean single elevation) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-[var(--line)]">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3">
            <span className="text-xs text-[var(--muted)] block">Status no {current.ciclo}</span>
            <div className="mt-1">
              <StatusBadge tone={statusTone}>{summary.status}</StatusBadge>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3">
            <span className="text-xs text-[var(--muted)] block">Checklist de atualização</span>
            <strong className="font-display text-2xl font-mono-num block mt-0.5">
              {summary.checklistDone}/{summary.checklistTotal}
            </strong>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3">
            <span className="text-xs text-[var(--muted)] block">Prova de reciclagem</span>
            <strong className="font-display text-2xl font-mono-num block mt-0.5 text-[var(--accent)]">
              {current.examBest !== undefined ? `${current.examBest}%` : '—'}
            </strong>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3">
            <span className="text-xs text-[var(--muted)] block">Calibração de auditoria</span>
            <strong className="font-display text-2xl font-mono-num block mt-0.5">
              {openCalCount} abertos · {resolvedCalCount} ok
            </strong>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="no-print flex flex-wrap gap-2"
        role="tablist"
        aria-label="Seções da Reciclagem Operacional"
      >
        {(
          [
            ['trilha', 'Trilha e Prova de Reciclagem'],
            ['veteranas', `Painel das Veteranas (${veteranTotal})`],
            ['calibracao', `Pontos de Calibração (${current.calibracoes.length})`],
          ] as Array<[ReciclagemTab, string]>
        ).map(([k, label]) => {
          const active = tab === k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(k)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
                active
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-ink)]'
                  : 'bg-[var(--surface)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--accent)]'
              }`}
            >
              {k === 'trilha' && <RefreshCw className="h-3.5 w-3.5" />}
              {k === 'veteranas' && <Users className="h-3.5 w-3.5" />}
              {k === 'calibracao' && <ClipboardCheck className="h-3.5 w-3.5" />}
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: TRILHA + PROVA */}
      {tab === 'trilha' && (
        <div className="space-y-4">
          {/* Enquadramento da colaboradora (tempo de casa + subsetor) */}
          <section className="no-print rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 md:p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold">Perfil de antiguidade e foco · {activeCollaborator}</h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Ajuste o tempo de casa e o subsetor principal para direcionar a reciclagem.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-2 font-semibold text-[var(--muted)]">
                <span>Tempo de casa</span>
                <select
                  value={current.tenure}
                  onChange={(e) =>
                    onUpdateReciclagem(activeCollaborator, {
                      ...current,
                      tenure: e.target.value as TenureBracket,
                    })
                  }
                  aria-label="Tempo de casa da colaboradora"
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
                >
                  {(Object.keys(TENURE_LABELS) as TenureBracket[]).map((tb) => (
                    <option key={tb} value={tb}>
                      {TENURE_LABELS[tb].label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 font-semibold text-[var(--muted)]">
                <span>Subsetor</span>
                <select
                  value={current.subsetorPrincipal}
                  onChange={(e) =>
                    onUpdateReciclagem(activeCollaborator, {
                      ...current,
                      subsetorPrincipal: e.target.value,
                    })
                  }
                  aria-label="Subsetor principal da colaboradora"
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
                >
                  {['Auditoria', ...TR_SUBS, 'Agendamento e reagendamento', 'Trainee'].map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {/* 4 Módulos de Atualização */}
          <div className="grid lg:grid-cols-2 gap-4">
            {RECICLAGEM_MODULES.map((mod) => {
              const modDoneCount = mod.checklist.filter((c) => current.checklist[c.id]).length;
              const modDoneAll = modDoneCount === mod.checklist.length;
              return (
                <section
                  key={mod.id}
                  className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-xs font-mono-num font-bold text-[var(--accent)]">
                          Módulo {mod.ordem}
                        </span>
                        <h2 className="text-base font-bold mt-0.5">{mod.titulo}</h2>
                        <p className="text-xs text-[var(--muted)] mt-0.5">{mod.foco}</p>
                      </div>
                      <StatusBadge tone={modDoneAll ? 'ok' : 'neutral'}>
                        {modDoneCount}/{mod.checklist.length}
                      </StatusBadge>
                    </div>

                    <ul className="space-y-1.5 text-xs text-[var(--muted)] list-disc pl-4">
                      {mod.atualizacoes.map((item, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>

                    <div className="divide-y divide-[var(--line)] pt-2 border-t border-[var(--line)]">
                      {mod.checklist.map((item) => {
                        const checked = Boolean(current.checklist[item.id]);
                        return (
                          <label
                            key={item.id}
                            className="py-2.5 flex items-start gap-2.5 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleChecklist(item.id)}
                              className="mt-0.5 h-4 w-4 accent-[var(--accent)] rounded shrink-0"
                            />
                            <span className="space-y-0.5 block">
                              <span
                                className={`text-xs font-semibold block ${
                                  checked ? 'text-[var(--accent)]' : 'text-[var(--ink)]'
                                }`}
                              >
                                {item.text}
                              </span>
                              <span className="text-[11px] text-[var(--muted)] block">
                                {item.hint}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--line)]">
                    <button
                      type="button"
                      onClick={() => handleCompleteModule(mod.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap shrink-0"
                    >
                      <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
                      {modDoneAll ? 'Desmarcar módulo' : 'Marcar módulo revisado'}
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenQuickSim(mod.deptKey)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] px-3 py-1.5 text-xs font-semibold hover:brightness-95 whitespace-nowrap shrink-0"
                    >
                      <Bot className="h-3.5 w-3.5" />
                      Praticar no Simulador
                    </button>
                  </div>
                </section>
              );
            })}
          </div>

          {renderExamSection()}

          {summary.status === 'Aprovada' && (
            <section className="rounded-2xl border-2 border-[var(--accent)] bg-[var(--surface)] p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center shrink-0">
                    <Award className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--accent)]">
                      Reciclagem Aprovada · {current.ciclo}
                    </p>
                    <h2 className="text-xl font-bold">
                      {activeCollaborator} — Padrão ClickCannabis Recalibrado ({current.examBest}%)
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="no-print inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap shrink-0"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir certificado
                </button>
              </div>
              <p className="text-xs text-[var(--muted)] pt-2 border-t border-[var(--line)] flex flex-wrap items-center gap-3 font-mono-num">
                <span className="inline-flex items-center gap-1 text-[var(--ink)]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent)]" />
                  Checklist {summary.checklistDone}/{summary.checklistTotal}
                </span>
                <span>·</span>
                <span>Data: {current.examDate || new Date().toLocaleDateString('pt-BR')}</span>
                <span>·</span>
                <span className="font-sans">
                  Validação: Treinadora {trainerName} · Coord. {leadership.coordenadora} ·
                  Liderança {leadership.lideranca} · Lid. Trein. {leadership.liderancaTreinamento}
                </span>
              </p>
            </section>
          )}
        </div>
      )}

      {/* TAB 2: PAINEL DAS VETERANAS */}
      {tab === 'veteranas' && (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 md:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">
                Painel de Reciclagem · Colaboradoras Veteranas
              </h2>
              <p className="text-xs text-[var(--muted)]">
                Acompanhe quem já concluiu a calibração do {RECICLAGEM_CICLO_ATUAL} e quem ainda
                precisa revisar regras novas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar colaboradora..."
                  aria-label="Buscar colaboradora na reciclagem"
                  className="w-48 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] pl-8 pr-3 py-1.5 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                aria-label="Filtrar por subsetor"
                className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--ink)]"
              >
                <option value="Todos">Todos os subsetores</option>
                {['Auditoria', ...TR_SUBS, 'Agendamento e reagendamento', 'Trainee'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['veteranas', 'Mais tempo (+6m / +1 ano)'],
                ['todas', 'Toda a equipe'],
                ['pendentes', 'Pendentes / Em curso'],
                ['aprovadas', 'Aprovadas'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTeamFilter(k)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                  teamFilter === k
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full min-w-[820px] text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--surface-2)] text-[var(--muted)] text-[11px] font-semibold border-b border-[var(--line)]">
                  <th className="text-left px-3 py-2.5">Colaboradora</th>
                  <th className="text-left px-3 py-2.5">Subsetor</th>
                  <th className="text-left px-3 py-2.5">Tempo de casa</th>
                  <th className="text-center px-2.5 py-2.5">Checklist</th>
                  <th className="text-center px-2.5 py-2.5">Nota Prova</th>
                  <th className="text-center px-2.5 py-2.5">Calibrações</th>
                  <th className="text-left px-3 py-2.5">Status</th>
                  <th className="text-right px-3 py-2.5">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {teamRows.length > 0 ? (
                  teamRows.map(({ name, rec, st }) => {
                    const isActive = name === activeCollaborator;
                    const openCals = rec.calibracoes.filter((c) => !c.resolvido).length;
                    const rowTone =
                      st.status === 'Aprovada'
                        ? 'ok'
                        : st.status === 'Em reciclagem'
                          ? 'info'
                          : 'warn';
                    return (
                      <tr
                        key={name}
                        className={
                          isActive ? 'bg-[var(--accent-soft)]/45' : 'hover:bg-[var(--surface-2)]'
                        }
                      >
                        <td className="px-3 py-2.5 font-bold text-[var(--ink)]">
                          {name}
                          {isActive && (
                            <span className="ml-2 text-[10px] font-bold text-[var(--accent)]">
                              (Ativa)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--muted)]">
                          {rec.subsetorPrincipal}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-[var(--ink)]">
                          {TENURE_LABELS[rec.tenure].short}
                        </td>
                        <td className="px-2.5 py-2.5 text-center font-mono-num">
                          {st.checklistDone}/{st.checklistTotal}
                        </td>
                        <td className="px-2.5 py-2.5 text-center font-mono-num">
                          {rec.examBest !== undefined ? (
                            <strong
                              className={
                                st.examPassed ? 'text-[var(--accent)]' : 'text-[var(--danger)]'
                              }
                            >
                              {rec.examBest}%
                            </strong>
                          ) : (
                            <span className="text-[var(--muted)]">—</span>
                          )}
                        </td>
                        <td className="px-2.5 py-2.5 text-center font-mono-num">
                          {openCals > 0 ? `${openCals} pendente${openCals > 1 ? 's' : ''}` : 'Em dia'}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge tone={rowTone}>{st.status}</StatusBadge>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onChangeCollaborator(name);
                                setTab('trilha');
                              }}
                              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold hover:border-[var(--accent)] whitespace-nowrap shrink-0"
                            >
                              Abrir reciclagem
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onChangeCollaborator(name);
                                onOpenQuickSim('reagendamento');
                              }}
                              className="rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap shrink-0"
                            >
                              Simular
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-[var(--muted)]">
                      Nenhuma colaboradora encontrada para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: CALIBRAÇÃO & AUDITORIA */}
      {tab === 'calibracao' && (
        <div className="grid lg:grid-cols-[380px_minmax(0,1fr)] gap-4 items-start">
          <form
            onSubmit={handleAddCalibration}
            className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3.5 text-xs"
          >
            <div>
              <h2 className="text-base font-bold">Registrar ponto de calibração</h2>
              <p className="text-[var(--muted)] mt-0.5">
                Registre desvios de rotina ou vícios identificados pela Auditoria / Treinadora para{' '}
                <strong className="text-[var(--ink)]">{activeCollaborator}</strong>.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cal-tema" className="block font-bold">
                Tema recorrente
              </label>
              <select
                id="cal-tema"
                value={calTema}
                onChange={(e) => setCalTema(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink)]"
              >
                {RECICLAGEM_PRESET_PONTOS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cal-obs" className="block font-bold">
                Detalhe observado / meta de correção
              </label>
              <textarea
                id="cal-obs"
                rows={3}
                value={calObs}
                onChange={(e) => setCalObs(e.target.value)}
                placeholder="Ex.: Na confirmação das 14h, faltou registrar tentativa de ligação antes de encerrar."
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 text-xs resize-y focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] py-2 px-4 font-semibold hover:brightness-105 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar ponto de calibração
            </button>
          </form>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--line)]">
              <h2 className="text-base font-bold">
                Histórico de calibração · {activeCollaborator}
              </h2>
              <span className="text-xs font-mono-num text-[var(--muted)]">
                {openCalCount} pendentes · {resolvedCalCount} calibrados
              </span>
            </div>

            {current.calibracoes.length > 0 ? (
              <div className="divide-y divide-[var(--line)]">
                {current.calibracoes.map((item) => {
                  const deptTarget = PRESET_TO_DEPT[item.tema] || 'geral';
                  return (
                    <div
                      key={item.id}
                      className="py-3 flex flex-wrap items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 flex-1 min-w-[220px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm text-[var(--ink)]">{item.tema}</strong>
                          <StatusBadge tone={item.resolvido ? 'ok' : 'warn'}>
                            {item.resolvido ? 'Calibrado' : 'Em ajuste'}
                          </StatusBadge>
                        </div>
                        <p className="text-[var(--muted)] leading-relaxed">{item.observacao}</p>
                        <p className="text-[11px] text-[var(--muted)] font-mono-num">
                          {item.autor} · {item.data}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenQuickSim(deptTarget)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] px-2.5 py-1.5 font-semibold whitespace-nowrap shrink-0"
                        >
                          <Bot className="h-3.5 w-3.5" />
                          Treinar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleCalResolved(item.id)}
                          className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1.5 font-semibold hover:border-[var(--accent)] whitespace-nowrap shrink-0"
                        >
                          {item.resolvido ? 'Reabrir' : 'Marcar calibrado'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--line)] p-6 text-center text-xs text-[var(--muted)] space-y-2">
                <p>
                  Nenhum ponto de ajuste registrado para {activeCollaborator} neste ciclo.
                </p>
                <p>
                  Use o formulário ao lado para apontar hábitos de rotina que precisam ser
                  recalibrados ou pratique os novos cenários no Simulador.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
