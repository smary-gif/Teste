import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  CheckCircle2,
  FolderOpen,
  Link2,
  Lock,
  Maximize2,
  Receipt,
  Send,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { PHASE_TXT, SCRIPT_CONF, TRAIN_DEPTS } from '../data/defaults';
import type {
  PatientCase,
  PortalConfig,
  TraineeSummary,
} from '../types';
import {
  cmdIs,
  fillTemplate,
  findShortcut,
  getTodayMeta,
  initials,
  isConversationClosed,
  isOperatorClosingMessage,
  isPatientClosingReply,
  normCmd,
  nowTime,
} from '../utils/helpers';
import { ClickCannabisLogo } from './ClickCannabisLogo';
import { buildConsultationLinks } from './ConsultationModals';
import { NegotiationModal } from './NegotiationModal';
import { getConsultationTone, StatusBadge } from './StatusBadge';

interface QuickSimulatorDrawerProps {
  open: boolean;
  onClose: () => void;
  initialDeptKey?: string;
  initialPatientId?: string;
  cfg: PortalConfig;
  patients: PatientCase[];
  setPatients: React.Dispatch<React.SetStateAction<PatientCase[]>>;
  aiConfigured: boolean;
  activeCollaborator: string;
  summary: TraineeSummary;
  onOpenFullSimulator: (deptKey: string, patientId: string) => void;
  onSignalPractice: (signalId: string) => void;
  onSyncConsultation?: (
    patientId: string,
    patch: {
      dateKey?: string;
      dataBr?: string;
      hora?: string;
      medico?: string;
      status?: string;
    }
  ) => void;
  onCaseEvaluated: (approved: boolean) => void;
  onStartCall?: (patient: PatientCase) => void;
  onToast: (msg: string) => void;
}

export function QuickSimulatorDrawer({
  open,
  onClose,
  initialDeptKey,
  initialPatientId,
  cfg,
  patients,
  setPatients,
  aiConfigured,
  activeCollaborator,
  summary,
  onOpenFullSimulator,
  onSignalPractice,
  onSyncConsultation,
  onCaseEvaluated,
  onStartCall,
  onToast,
}: QuickSimulatorDrawerProps) {
  const [deptKeyState, setDeptKeyState] = useState<string>(initialDeptKey || 'geral');
  const [patientId, setPatientId] = useState<string>(initialPatientId || '');
  const [composer, setComposer] = useState('');
  const [suggIdx, setSuggIdx] = useState(0);
  const [noteText, setNoteText] = useState('');
  const [useAiMode, setUseAiMode] = useState<boolean>(aiConfigured);
  const [evaluating, setEvaluating] = useState(false);
  const [evalFeedback, setEvalFeedback] = useState<string | null>(null);
  const [negOpen, setNegOpen] = useState(false);

  const msgsEndRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(9000);
  const nextMsgId = () => `qsim_${Date.now()}_${seqRef.current++}`;

  useEffect(() => {
    setUseAiMode(aiConfigured);
  }, [aiConfigured]);

  useEffect(() => {
    if (!open) return;
    if (initialPatientId) {
      const target = patients.find((p) => p.id === initialPatientId);
      if (target) {
        setDeptKeyState(target.key);
        setPatientId(target.id);
        setEvalFeedback(null);
        return;
      }
    }
    const targetDept = initialDeptKey || deptKeyState || 'geral';
    setDeptKeyState(targetDept);
    const first = patients.find((p) => p.key === targetDept) || patients[0];
    if (first) {
      setPatientId(first.id);
    }
    setEvalFeedback(null);
  }, [open, initialDeptKey, initialPatientId]);

  const deptPatients = patients.filter((p) => p.key === deptKeyState);
  const selected =
    patients.find((p) => p.id === patientId && p.key === deptKeyState) ||
    deptPatients[0] ||
    patients[0] ||
    null;

  useEffect(() => {
    if (open) {
      msgsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [open, selected?.msgs.length, selected?.typing]);

  if (!open) return null;

  const showSuggestions = composer.startsWith('/') && !/\n/.test(composer);
  const matchingShortcuts = showSuggestions
    ? cfg.atalhos.filter((a) => normCmd(a.cmd).startsWith(normCmd(composer)))
    : [];

  const updatePatient = (id: string, updater: (p: PatientCase) => PatientCase) => {
    setPatients((prev) => prev.map((p) => (p.id === id ? updater(p) : p)));
  };

  const signalDeptCompletion = (dept: string) => {
    if (dept === 'geral') onSignalPractice('d1_0');
    if (dept === 'agendamento') onSignalPractice('d1_1');
    if (dept === 'reagendamento') onSignalPractice('d1_2');
    if (dept === 'confirmacao') onSignalPractice('d2_0');
    if (dept === 'andamento') onSignalPractice('d2_1');
    if (dept === 'medicos') onSignalPractice('d2_2');
    if (dept === 'solicitacoes') onSignalPractice('d3_0');
  };

  const getScriptedReply = (
    p: PatientCase
  ): { text: string; nextIdx: Record<string, number>; isLast: boolean } => {
    const idxMap = { ...(p.scriptIdx || {}) };
    if (p.key === 'confirmacao' || (SCRIPT_CONF[p.sc.id || ''] && !p.sc.replies)) {
      const sc = SCRIPT_CONF[p.sc.id || ''] || SCRIPT_CONF.tranquilo;
      const key = p.fase;
      const arr = sc[key]?.length ? sc[key] : sc.livre;
      const next = (idxMap[key] ?? -1) + 1;
      idxMap[key] = next;
      return {
        text: next < arr.length ? arr[next] : sc.livre[0] || 'Ok, obrigado!',
        nextIdx: idxMap,
        isLast: next >= arr.length - 1,
      };
    }
    const arr = p.sc.replies || ['Ok, obrigado!'];
    const next = (idxMap.r ?? -1) + 1;
    idxMap.r = next;
    return {
      text: arr[Math.min(next, arr.length - 1)],
      nextIdx: idxMap,
      isLast: next >= arr.length - 1,
    };
  };

  const triggerPatientReply = async (targetCase: PatientCase, operatorClosed = false) => {
    if (isConversationClosed(targetCase.atend)) return;

    if (
      targetCase.sc.silent &&
      targetCase.opCount < targetCase.sc.silent + (targetCase.key === 'andamento' ? 1 : 0)
    ) {
      return;
    }

    updatePatient(targetCase.id, (p) => ({ ...p, typing: true }));

    if (useAiMode && aiConfigured) {
      try {
        const res = await fetch('/api/ai/patient-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient: {
              nome: targetCase.nome,
              isMed: targetCase.isMed,
              key: targetCase.key,
              dept: targetCase.dept,
              data: targetCase.data,
              hora: targetCase.hora,
              medico: targetCase.medico,
              scenarioDesc: targetCase.sc.desc,
            },
            history: targetCase.msgs.map((m) => ({ from: m.from, text: m.text })),
            phaseText: targetCase.key === 'confirmacao' ? PHASE_TXT[targetCase.fase] : '',
          }),
        });
        const data = (await res.json()) as { reply?: string; error?: string };
        if (!res.ok) {
          updatePatient(targetCase.id, (p) => ({ ...p, typing: false }));
          onToast(data.error || 'Erro ao gerar resposta da IA.');
          return;
        }
        const reply = (data.reply || '').trim();
        const shouldClose = isPatientClosingReply(reply, false, operatorClosed);

        updatePatient(targetCase.id, (p) => {
          if (isConversationClosed(p.atend)) return { ...p, typing: false };
          const msgs = [...p.msgs];
          if (reply) {
            msgs.push({ id: nextMsgId(), from: 'pac', text: reply, t: nowTime() });
          }
          if (shouldClose) {
            msgs.push({
              id: nextMsgId(),
              from: 'evt',
              text: 'Atendimento concluído · Conversa encerrada automaticamente.',
              t: nowTime(),
            });
          }
          return {
            ...p,
            typing: false,
            atend: shouldClose ? 'Resolvido' : p.atend,
            msgs,
          };
        });
        if (shouldClose) {
          signalDeptCompletion(targetCase.key);
          onToast('Atendimento concluído e conversa encerrada automaticamente.');
        }
      } catch {
        updatePatient(targetCase.id, (p) => ({ ...p, typing: false }));
        onToast('Falha de rede ao consultar IA.');
      }
      return;
    }

    window.setTimeout(() => {
      const scripted = getScriptedReply(targetCase);
      const shouldClose = isPatientClosingReply(
        scripted.text,
        scripted.isLast && targetCase.opCount >= 1,
        operatorClosed
      );
      updatePatient(targetCase.id, (p) => {
        if (isConversationClosed(p.atend)) return { ...p, typing: false };
        const msgs = [
          ...p.msgs,
          { id: nextMsgId(), from: 'pac' as const, text: scripted.text, t: nowTime() },
        ];
        if (shouldClose) {
          msgs.push({
            id: nextMsgId(),
            from: 'evt' as const,
            text: 'Atendimento concluído · Conversa encerrada automaticamente.',
            t: nowTime(),
          });
        }
        return {
          ...p,
          typing: false,
          scriptIdx: scripted.nextIdx,
          atend: shouldClose ? 'Resolvido' : p.atend,
          msgs,
        };
      });
      if (shouldClose) {
        signalDeptCompletion(targetCase.key);
        onToast('Atendimento concluído e conversa encerrada automaticamente.');
      }
    }, 600);
  };

  const handleSend = () => {
    if (!selected || !composer.trim() || isConversationClosed(selected.atend)) return;
    const raw = composer.trim();
    const shortcut = raw.startsWith('/') ? findShortcut(cfg.atalhos, raw) : undefined;
    const text = shortcut ? fillTemplate(shortcut.texto, selected) : raw;
    const cmd = shortcut ? normCmd(shortcut.cmd) : null;
    const opClosed = isOperatorClosingMessage(text, cmd);
    const immediateClose = cmd === '/faltou' || (opClosed && Boolean(selected.sc.silent));

    const newMsg = {
      id: nextMsgId(),
      from: 'op' as const,
      text,
      label: shortcut ? `Atalho ${shortcut.cmd}` : undefined,
      t: nowTime(),
    };

    const nextCase: PatientCase = {
      ...selected,
      opCount: selected.opCount + 1,
      status: cmd === '/confirmacao' ? 'Confirmada' : selected.status,
      atend: immediateClose ? 'Resolvido' : selected.atend,
      msgs: immediateClose
        ? [
            ...selected.msgs,
            newMsg,
            {
              id: nextMsgId(),
              from: 'evt',
              text: 'Atendimento concluído · Conversa encerrada automaticamente.',
              t: nowTime(),
            },
          ]
        : [...selected.msgs, newMsg],
    };

    updatePatient(selected.id, () => nextCase);
    setComposer('');

    if (cmd === '/importante' && selected.key === 'agendamento') onSignalPractice('d1_1');
    if (cmd === '/devido' && selected.key === 'reagendamento') onSignalPractice('d1_2');
    if (cmd === '/confirmacao' && selected.key === 'confirmacao') onSignalPractice('d2_0');
    if ((cmd === '/aguarde2' || cmd === '/faltou') && selected.key === 'andamento') {
      onSignalPractice('d2_1');
    }
    if (selected.key === 'medicos') onSignalPractice('d2_2');

    if (immediateClose) {
      signalDeptCompletion(selected.key);
      onToast('Atendimento concluído e conversa encerrada automaticamente.');
      return;
    }

    void triggerPatientReply(nextCase, opClosed);
  };

  const handleQuickNote = () => {
    if (!selected || !noteText.trim()) return;
    updatePatient(selected.id, (p) => ({
      ...p,
      notas: [
        ...p.notas,
        { id: nextMsgId(), tipo: 'Nota', text: noteText.trim(), t: nowTime() },
      ],
    }));
    if (selected.key === 'solicitacoes') onSignalPractice('d3_1');
    if (selected.key === 'geral') onSignalPractice('d1_0');
    setNoteText('');
    onToast('Nota interna registrada no atendimento.');
  };

  const handleMarkResolved = () => {
    if (!selected || isConversationClosed(selected.atend)) return;
    updatePatient(selected.id, (p) => ({
      ...p,
      typing: false,
      atend: 'Resolvido',
      msgs: [
        ...p.msgs,
        {
          id: nextMsgId(),
          from: 'evt',
          text: 'Atendimento concluído pela colaboradora · Conversa encerrada.',
          t: nowTime(),
        },
      ],
    }));
    signalDeptCompletion(selected.key);
    onToast('Atendimento concluído e conversa encerrada.');
  };

  const handleReopen = () => {
    if (!selected) return;
    updatePatient(selected.id, (p) => ({
      ...p,
      atend: 'Em Atendimento',
      msgs: [
        ...p.msgs,
        { id: nextMsgId(), from: 'evt', text: 'Conversa reaberta pela colaboradora.', t: nowTime() },
      ],
    }));
    onToast('Atendimento reaberto.');
  };

  const handleForwardResource = (text: string, label: string) => {
    if (!selected) return;
    const newMsg = {
      id: nextMsgId(),
      from: 'op' as const,
      text,
      label,
      t: nowTime(),
    };
    const nextCase: PatientCase = {
      ...selected,
      opCount: selected.opCount + 1,
      msgs: [...selected.msgs, newMsg],
    };
    updatePatient(selected.id, () => nextCase);
    onToast(`${label} encaminhado no chat.`);
    if (!isConversationClosed(selected.atend)) {
      void triggerPatientReply(nextCase, false);
    }
  };

  const handleRescheduleSelected = (payload: {
    dateKey: string;
    dataBr: string;
    hora: string;
    medico: string;
    sendToChat: boolean;
  }) => {
    if (!selected) return;
    const dataDash = payload.dataBr.replaceAll('/', '-');
    const extraMsgs = [
      ...selected.msgs,
      {
        id: nextMsgId(),
        from: 'evt' as const,
        text: `Reagendamento: ${payload.dataBr} às ${payload.hora} · ${payload.medico}`,
        t: nowTime(),
      },
    ];
    if (payload.sendToChat) {
      extraMsgs.push({
        id: nextMsgId(),
        from: 'op' as const,
        label: 'Reagendamento confirmado',
        text: `Sua consulta foi reagendada para ${payload.dataBr} às ${payload.hora} com ${payload.medico}. Qualquer dúvida estamos à disposição!`,
        t: nowTime(),
      });
    }
    const nextCase: PatientCase = {
      ...selected,
      data: dataDash,
      hora: payload.hora,
      medico: payload.medico,
      status: 'Reagendada',
      opCount: payload.sendToChat ? selected.opCount + 1 : selected.opCount,
      msgs: extraMsgs,
    };
    updatePatient(selected.id, () => nextCase);
    onSyncConsultation?.(selected.id, {
      dateKey: payload.dateKey,
      dataBr: payload.dataBr,
      hora: payload.hora,
      medico: payload.medico,
      status: 'Reagendada',
    });
    onSignalPractice('d1_2');
    onToast(`Consulta reagendada para ${payload.dataBr} às ${payload.hora}.`);
    if (payload.sendToChat && !isConversationClosed(selected.atend)) {
      void triggerPatientReply(nextCase, false);
    }
  };

  const handleChangeDoctorSelected = (medico: string, sendToChat: boolean) => {
    if (!selected) return;
    const extraMsgs = [
      ...selected.msgs,
      {
        id: nextMsgId(),
        from: 'evt' as const,
        text: `Médico alterado para ${medico}`,
        t: nowTime(),
      },
    ];
    if (sendToChat) {
      extraMsgs.push({
        id: nextMsgId(),
        from: 'op' as const,
        label: 'Alteração de médico',
        text: `Informamos que sua consulta foi atualizada para atendimento com ${medico}, mantendo o mesmo dia e horário (${selected.data.replaceAll('-', '/')} às ${selected.hora}).`,
        t: nowTime(),
      });
    }
    const nextCase: PatientCase = {
      ...selected,
      medico,
      opCount: sendToChat ? selected.opCount + 1 : selected.opCount,
      msgs: extraMsgs,
    };
    updatePatient(selected.id, () => nextCase);
    onSyncConsultation?.(selected.id, { medico });
    onToast(`Médico atualizado para ${medico}.`);
  };

  const handleChangeConsultationStatus = (nextStatus: string, sendToChat?: boolean) => {
    if (!selected) return;
    const extraMsgs = [
      ...selected.msgs,
      {
        id: nextMsgId(),
        from: 'evt' as const,
        text: `Status da consulta alterado para "${nextStatus}"`,
        t: nowTime(),
      },
    ];
    if (sendToChat && nextStatus === 'Confirmada') {
      extraMsgs.push({
        id: nextMsgId(),
        from: 'op' as const,
        label: 'Agendamento confirmado',
        text: `Sua consulta de ${selected.data.replaceAll('-', '/')} às ${selected.hora} com ${selected.medico} está confirmada! 10 minutos antes enviaremos o link de acesso.`,
        t: nowTime(),
      });
      if (selected.key === 'confirmacao') onSignalPractice('d2_0');
    }
    updatePatient(selected.id, (p) => ({
      ...p,
      status: nextStatus,
      opCount: sendToChat && nextStatus === 'Confirmada' ? p.opCount + 1 : p.opCount,
      msgs: extraMsgs,
    }));
    onSyncConsultation?.(selected.id, { status: nextStatus });
    onToast(`Status da consulta atualizado para ${nextStatus}.`);
  };

  const handleAddNoteFromModal = (text: string, tipo = 'Nota') => {
    if (!selected || !text.trim()) return;
    updatePatient(selected.id, (p) => ({
      ...p,
      notas: [...p.notas, { id: nextMsgId(), tipo, text: text.trim(), t: nowTime() }],
    }));
    onToast('Nota adicionada no atendimento.');
  };

  const handleEvaluate = async () => {
    if (!selected || evaluating) return;
    setEvaluating(true);
    setEvalFeedback('Auditando atendimento segundo critérios de Liderança ClickCannabis...');
    try {
      const res = await fetch('/api/ai/evaluate-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient: {
            nome: selected.nome,
            dept: selected.dept,
            scenarioDesc: selected.sc.desc,
            status: selected.status,
          },
          messages: selected.msgs.map((m) => ({ from: m.from, text: m.text, label: m.label })),
          notes: selected.notas.map((n) => ({ tipo: n.tipo, text: n.text })),
          atendStatus: selected.atend,
          dept: selected.dept,
        }),
      });
      const data = (await res.json()) as { feedback?: string; error?: string };
      if (!res.ok) {
        setEvalFeedback(data.error || 'Não foi possível avaliar este atendimento.');
      } else {
        const fb = data.feedback || 'Sem parecer retornado.';
        setEvalFeedback(fb);
        const approved = /aprovado no caso/i.test(fb) && !/precisa ajustar/i.test(fb);
        onCaseEvaluated(approved);
      }
    } catch {
      setEvalFeedback('Falha de rede ao consultar auditoria por IA.');
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-[rgba(6,20,12,0.52)] flex justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Simulador Rápido ClickCannabis"
    >
      <aside className="bg-[var(--surface)] w-full max-w-[680px] h-full flex flex-col shadow-2xl border-l border-[var(--line)]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between gap-3 bg-[var(--surface)]">
          <div className="flex items-center gap-3 min-w-0">
            <ClickCannabisLogo compact />
            <div className="h-5 w-px bg-[var(--line)]" />
            <div className="min-w-0">
              <strong className="text-sm font-bold block truncate">
                Simulador Rápido · {activeCollaborator}
              </strong>
              <span className="text-[11px] text-[var(--muted)] block truncate">
                Pratique sem sair desta tela · Atalhos com /
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {selected && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFullSimulator(selected.key, selected.id);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                Tela cheia
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar simulador rápido"
              className="h-8 w-8 rounded-lg border border-[var(--line)] grid place-items-center hover:border-[var(--accent)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div className="px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Award className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
            <span className="truncate">
              <strong className="text-[var(--ink)]">{summary.currentStageLabel}</strong>
            </span>
          </div>
          <span className="font-mono-num font-bold text-[var(--accent)] shrink-0">
            {summary.completedStages}/{summary.totalStages} provas · {summary.practicesDone}/
            {summary.totalPractices} práticas
          </span>
        </div>

        {/* Selectors */}
        <div className="px-4 py-2.5 border-b border-[var(--line)] flex flex-wrap items-center gap-2 bg-[var(--surface)]">
          <select
            value={deptKeyState}
            onChange={(e) => {
              const nextKey = e.target.value;
              setDeptKeyState(nextKey);
              const first = patients.find((p) => p.key === nextKey);
              if (first) setPatientId(first.id);
              setEvalFeedback(null);
            }}
            aria-label="Subsetor do simulador rápido"
            className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)]"
          >
            {TRAIN_DEPTS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.nome}
              </option>
            ))}
          </select>

          <select
            value={selected?.id || ''}
            onChange={(e) => {
              setPatientId(e.target.value);
              setEvalFeedback(null);
            }}
            aria-label="Caso simulado"
            className="flex-1 min-w-[180px] rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs font-medium text-[var(--ink)]"
          >
            {deptPatients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} · {p.hora} ({p.atend})
              </option>
            ))}
          </select>

          <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => {
                if (!aiConfigured) {
                  onToast('GEMINI_API_KEY não configurada no servidor. Usando Roteiro Padrão.');
                  return;
                }
                setUseAiMode(true);
              }}
              className={`px-2 py-1 rounded-md font-semibold whitespace-nowrap ${
                useAiMode
                  ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                  : 'text-[var(--muted)]'
              }`}
            >
              IA
            </button>
            <button
              type="button"
              onClick={() => setUseAiMode(false)}
              className={`px-2 py-1 rounded-md font-semibold whitespace-nowrap ${
                !useAiMode
                  ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                  : 'text-[var(--muted)]'
              }`}
            >
              Roteiro
            </button>
          </div>
        </div>

        {selected ? (
          <>
            {/* Patient Strip */}
            <div className="px-4 py-2 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-2 text-xs bg-[var(--surface)]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 rounded-full bg-[var(--sunk)] text-[var(--accent)] font-bold text-[11px] grid place-items-center shrink-0">
                  {initials(selected.nome)}
                </div>
                <div className="min-w-0">
                  <strong className="truncate block">{selected.nome}</strong>
                  <span className="text-[11px] text-[var(--muted)] truncate block">
                    {selected.sc.desc}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <StatusBadge tone={getConsultationTone(selected.status)}>
                  {selected.status}
                </StatusBadge>
                <button
                  type="button"
                  onClick={() => {
                    setNegOpen(true);
                    if (selected.key === 'geral') onSignalPractice('d1_0');
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-2 py-1 text-[11px] font-semibold hover:border-[var(--accent)] whitespace-nowrap"
                >
                  <FolderOpen className="h-3 w-3" />
                  Negociação
                </button>
                {!isConversationClosed(selected.atend) && (
                  <button
                    type="button"
                    onClick={handleMarkResolved}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold hover:brightness-95 whitespace-nowrap"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Concluir
                  </button>
                )}
                {aiConfigured && (
                  <button
                    type="button"
                    onClick={handleEvaluate}
                    disabled={evaluating}
                    className="inline-flex items-center gap-1 rounded-lg bg-[var(--info-soft)] text-[var(--info)] px-2.5 py-1 text-[11px] font-semibold hover:opacity-90 whitespace-nowrap"
                  >
                    <Sparkles className="h-3 w-3" />
                    {evaluating ? 'Auditando...' : 'Avaliar'}
                  </button>
                )}
              </div>
            </div>

            {!selected.isMed && (
              <div className="px-4 py-1.5 border-b border-[var(--line)] bg-[var(--surface-2)] flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-[var(--muted)] font-semibold mr-1">Encaminhar:</span>
                <button
                  type="button"
                  onClick={() => {
                    const l = buildConsultationLinks(selected.proc);
                    handleForwardResource(
                      `Olá, ${selected.first}! Segue o link da sua consulta com ${selected.medico} (${selected.data.replaceAll('-', '/')} às ${selected.hora}):\n${l.consulta}`,
                      'Link de consulta'
                    );
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 font-semibold hover:border-[var(--accent)]"
                >
                  <Link2 className="h-3 w-3 text-[var(--accent)]" />
                  Link consulta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const l = buildConsultationLinks(selected.proc);
                    handleForwardResource(
                      `Olá, ${selected.first}! Segue o link de convidado para a consulta de ${selected.data.replaceAll('-', '/')} às ${selected.hora}:\n${l.convidado}`,
                      'Link de convidado'
                    );
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 font-semibold hover:border-[var(--accent)]"
                >
                  <Users className="h-3 w-3 text-[var(--accent)]" />
                  Link convidado
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const l = buildConsultationLinks(selected.proc);
                    const isFree = selected.tipo === 'Gratuita';
                    handleForwardResource(
                      isFree
                        ? `Olá, ${selected.first}! Sua consulta com ${selected.medico} foi na modalidade Gratuita (R$ 0,00), sem cobrança de Nota Fiscal.`
                        : `Olá, ${selected.first}! Seguem as Notas Fiscais da sua consulta com ${selected.medico} (Total R$ 50,00):\n• NF Médico (${l.nfMedicoNumero} · R$ 45,00): ${l.nfMedicoLink}\n• NF ClickCannabis (${l.nfClickNumero} · R$ 5,00): ${l.nfClickLink}`,
                      'Nota fiscal'
                    );
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 font-semibold hover:border-[var(--accent)]"
                >
                  <Receipt className="h-3 w-3 text-[var(--accent)]" />
                  Nota fiscal
                </button>
              </div>
            )}

            {evalFeedback && (
              <div className="px-4 py-2.5 bg-[var(--info-soft)] text-[var(--info)] border-b border-[var(--line)] text-xs flex items-start justify-between gap-3">
                <div className="whitespace-pre-wrap leading-relaxed">{evalFeedback}</div>
                <button
                  type="button"
                  onClick={() => setEvalFeedback(null)}
                  aria-label="Fechar avaliação"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Chat history */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[var(--surface-2)]">
              {selected.msgs.map((m) => {
                if (m.from === 'evt') {
                  return (
                    <div
                      key={m.id}
                      className="mx-auto w-fit max-w-full rounded-full bg-[var(--sunk)] px-3 py-1 text-[11px] font-semibold text-[var(--muted)] text-center"
                    >
                      {m.text}
                    </div>
                  );
                }
                if (m.from === 'sys' || m.from === 'api') {
                  return (
                    <div
                      key={m.id}
                      className="ml-auto max-w-[85%] rounded-xl border border-[var(--line)] bg-[var(--bubble-sys)] p-2.5 text-xs space-y-1"
                    >
                      <span className="text-[10px] font-bold uppercase text-[var(--muted)] block">
                        Sistema · {m.d || getTodayMeta().todaySl} {m.t}
                      </span>
                      <div className="whitespace-pre-wrap">{m.text}</div>
                    </div>
                  );
                }
                const isIn = m.from === 'pac';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col max-w-[80%] gap-0.5 ${
                      isIn ? 'self-start items-start' : 'ml-auto self-end items-end'
                    }`}
                  >
                    {m.label && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                        {m.label}
                      </span>
                    )}
                    <div
                      className={`rounded-xl px-3 py-2 text-xs whitespace-pre-wrap ${
                        isIn
                          ? 'bg-[var(--bubble-in)] border border-[var(--line)]'
                          : 'bg-[var(--bubble-out)]'
                      }`}
                    >
                      {m.text}
                    </div>
                    <span className="text-[10px] text-[var(--muted)] font-mono-num">
                      {m.t}
                      {m.from === 'op' ? ' · você' : ''}
                    </span>
                  </div>
                );
              })}

              {selected.typing && (
                <p className="text-xs italic text-[var(--muted)]">
                  {selected.isMed ? selected.nome : selected.first} está digitando...
                </p>
              )}
              <div ref={msgsEndRef} />
            </div>

            {/* Quick Note bar */}
            <div className="px-3 py-2 border-t border-[var(--line)] bg-[var(--surface-2)] flex items-center gap-2">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickNote();
                  }
                }}
                placeholder={`Registrar nota interna (${selected.notas.length} salvas)...`}
                className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={handleQuickNote}
                className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
              >
                + Nota
              </button>
            </div>

            {isConversationClosed(selected.atend) ? (
              <div className="p-3 border-t border-[var(--line)] bg-[var(--surface-2)] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <Lock className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                  <span className="font-semibold text-[var(--ink)]">
                    Conversa encerrada ({selected.atend})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {aiConfigured && (
                    <button
                      type="button"
                      onClick={handleEvaluate}
                      disabled={evaluating}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--info-soft)] text-[var(--info)] px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
                    >
                      <Sparkles className="h-3 w-3" />
                      {evaluating ? 'Auditando...' : 'Avaliar'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleReopen}
                    className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
                  >
                    Reabrir
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 border-t border-[var(--line)] bg-[var(--surface)] relative flex items-end gap-2">
                {showSuggestions && matchingShortcuts.length > 0 && (
                  <div className="absolute left-3 right-3 bottom-full mb-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xl max-h-52 overflow-y-auto z-20 divide-y divide-[var(--line)]">
                    {matchingShortcuts.map((a, idx) => (
                      <button
                        key={a.cmd}
                        type="button"
                        onClick={() => setComposer(a.cmd)}
                        className={`w-full text-left px-3 py-2 text-xs ${
                          idx === suggIdx ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--surface-2)]'
                        }`}
                      >
                        <span className="font-mono-num font-bold text-[var(--accent)]">
                          {a.cmd}
                        </span>
                        <span className="block text-[var(--muted)] truncate mt-0.5">
                          {a.texto.replace(/\n/g, ' ')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <textarea
                  rows={2}
                  value={composer}
                  onChange={(e) => {
                    setComposer(e.target.value);
                    setSuggIdx(0);
                  }}
                  onKeyDown={(e) => {
                    if (showSuggestions && matchingShortcuts.length > 0) {
                      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSuggIdx(
                          (prev) =>
                            (prev + (e.key === 'ArrowDown' ? 1 : -1) + matchingShortcuts.length) %
                            matchingShortcuts.length
                        );
                        return;
                      }
                      if (e.key === 'Tab' || e.key === 'Enter') {
                        const chosen = matchingShortcuts[suggIdx] || matchingShortcuts[0];
                        if (chosen && !cmdIs(composer, chosen.cmd)) {
                          e.preventDefault();
                          setComposer(chosen.cmd);
                          return;
                        }
                      }
                    }
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Responda ou digite / para escolher um atalho..."
                  className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs resize-none focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  aria-label="Enviar mensagem"
                  className="h-10 w-10 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] grid place-items-center shrink-0 hover:brightness-105"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="p-8 text-center text-sm text-[var(--muted)]">
            Nenhum atendimento disponível para simulação.
          </div>
        )}
      </aside>

      {negOpen && selected && (
        <NegotiationModal
          patient={selected}
          onClose={() => setNegOpen(false)}
          onToast={onToast}
          onStartCall={onStartCall}
          onReschedule={handleRescheduleSelected}
          onChangeDoctor={handleChangeDoctorSelected}
          onChangeStatus={handleChangeConsultationStatus}
          onAddNote={handleAddNoteFromModal}
          onForwardToChat={(text, label) => {
            handleForwardResource(text, label);
            setNegOpen(false);
          }}
        />
      )}
    </div>
  );
}
