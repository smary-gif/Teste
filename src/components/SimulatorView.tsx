import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  CheckCircle2,
  Columns3,
  FolderOpen,
  Link2,
  ListChecks,
  Lock,
  Mic,
  Monitor,
  Receipt,
  RotateCcw,
  Send,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { PHASE_TXT, SCRIPT_CONF } from '../data/defaults';
import type {
  AppView,
  AtendStatus,
  AtendTabKey,
  PatientCase,
  PortalConfig,
} from '../types';
import {
  ATEND_LIST,
  ATEND_TAB,
  cmdIs,
  deptKey,
  fillTemplate,
  findShortcut,
  getTodayMeta,
  initials,
  isConversationClosed,
  isOperatorClosingMessage,
  isPatientClosingReply,
  normCmd,
  nowTime,
  shortDept,
} from '../utils/helpers';
import { buildConsultationLinks } from './ConsultationModals';
import { NegotiationModal } from './NegotiationModal';
import { getAtendTone, getConsultationTone, StatusBadge } from './StatusBadge';

interface SimulatorViewProps {
  cfg: PortalConfig;
  patients: PatientCase[];
  setPatients: React.Dispatch<React.SetStateAction<PatientCase[]>>;
  selectedId: string;
  setSelectedId: (id: string) => void;
  deptFilter: string;
  setDeptFilter: (dept: string) => void;
  listTab: AtendTabKey;
  setListTab: (tab: AtendTabKey) => void;
  aiConfigured: boolean;
  onResetSim: () => void;
  onGoView: (view: AppView) => void;
  onOpenSolModal: (patientId: string, mode: 'new' | 'edit') => void;
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
  onCaseEvaluated?: (approved: boolean) => void;
  onStartCall?: (patient: PatientCase) => void;
  onCoachSignal: (signalName: string) => void;
  onToast: (msg: string) => void;
}

const CONFIRM_EVENTS = [
  { label: 'Lembrete 07:00', fase: 'confirmacao' as const },
  { label: 'Lembrete 2h antes', fase: 'pre' as const },
  { label: 'Lembrete 10 min com link', fase: 'acesso' as const },
];

export function SimulatorView({
  cfg,
  patients,
  setPatients,
  selectedId,
  setSelectedId,
  deptFilter,
  setDeptFilter,
  listTab,
  setListTab,
  aiConfigured,
  onResetSim,
  onGoView,
  onOpenSolModal,
  onSignalPractice,
  onSyncConsultation,
  onCaseEvaluated,
  onStartCall,
  onCoachSignal,
  onToast,
}: SimulatorViewProps) {
  const [ddOpen, setDdOpen] = useState(false);
  const [atendOpen, setAtendOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [composer, setComposer] = useState('');
  const [suggIdx, setSuggIdx] = useState(0);
  const [noteType, setNoteType] = useState('Nota');
  const [noteText, setNoteText] = useState('');
  const [pendingAudio, setPendingAudio] = useState<{ url: string; name: string } | null>(null);
  const [negOpen, setNegOpen] = useState(false);
  const [useAiMode, setUseAiMode] = useState<boolean>(aiConfigured);
  const [evaluating, setEvaluating] = useState(false);
  const [evalFeedback, setEvalFeedback] = useState<string | null>(null);

  const msgsEndRef = useRef<HTMLDivElement>(null);
  const abortMapRef = useRef<Record<string, AbortController>>({});
  const seqRef = useRef(1000);
  const nextMsgId = () => `sim_${Date.now()}_${seqRef.current++}`;

  useEffect(() => {
    setUseAiMode(aiConfigured);
  }, [aiConfigured]);

  const allInDept = patients.filter(
    (p) => deptFilter === 'Todos' || deptKey(p.dept) === deptKey(deptFilter)
  );
  const visibleList = allInDept.filter((p) => ATEND_TAB[p.atend] === listTab);
  const selected = patients.find((p) => p.id === selectedId) || visibleList[0] || null;

  useEffect(() => {
    if (selected && selected.unread) {
      setPatients((prev) =>
        prev.map((p) => (p.id === selected.id ? { ...p, unread: false } : p))
      );
    }
    setEvalFeedback(null);
  }, [selectedId]);

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [selected?.msgs.length, selected?.typing]);

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

    abortMapRef.current[targetCase.id]?.abort();
    const ctl = new AbortController();
    abortMapRef.current[targetCase.id] = ctl;

    updatePatient(targetCase.id, (p) => ({ ...p, typing: true }));

    if (useAiMode && aiConfigured) {
      try {
        const res = await fetch('/api/ai/patient-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctl.signal,
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
            unread: p.id !== selectedId,
            atend: shouldClose ? 'Resolvido' : p.atend,
            msgs,
          };
        });

        if (shouldClose) {
          signalDeptCompletion(targetCase.key);
          onToast('Atendimento concluído e conversa encerrada automaticamente.');
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        updatePatient(targetCase.id, (p) => ({ ...p, typing: false }));
        onToast('Falha de rede ao consultar IA. Você pode alternar para Roteiro Padrão.');
      }
      return;
    }

    window.setTimeout(() => {
      if (ctl.signal.aborted) return;
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
          unread: p.id !== selectedId,
          atend: shouldClose ? 'Resolvido' : p.atend,
          msgs,
        };
      });
      if (shouldClose) {
        signalDeptCompletion(targetCase.key);
        onToast('Atendimento concluído e conversa encerrada automaticamente.');
      }
    }, 750);
  };

  const handleConcludeConversation = () => {
    if (!selected || isConversationClosed(selected.atend)) return;
    abortMapRef.current[selected.id]?.abort();
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

  const handleReopenConversation = () => {
    if (!selected) return;
    updatePatient(selected.id, (p) => ({
      ...p,
      atend: 'Em Atendimento',
      msgs: [
        ...p.msgs,
        {
          id: nextMsgId(),
          from: 'evt',
          text: 'Conversa reaberta pela colaboradora.',
          t: nowTime(),
        },
      ],
    }));
    onToast('Atendimento reaberto.');
  };

  const handleSendMessage = () => {
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
    onCoachSignal('sim-send');

    // Practice signal tracking for Trainee 3-day milestones
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

  const handleFireEvent = (target: PatientCase) => {
    const ev = CONFIRM_EVENTS[target.ev];
    if (!ev || target.key !== 'confirmacao') return;
    const { todaySl } = getTodayMeta();

    let nextCase: PatientCase = { ...target, ev: target.ev + 1, fase: ev.fase };
    const extraMsgs = [...target.msgs];

    if (ev.fase === 'confirmacao') {
      extraMsgs.push({
        id: nextMsgId(),
        from: 'sys',
        text: fillTemplate(cfg.templates.lembrete7h, target),
        d: todaySl,
        t: '07:00',
      });
    } else if (ev.fase === 'pre') {
      extraMsgs.push({
        id: nextMsgId(),
        from: 'api',
        text: 'Diálogo API | Lembrete 2h iniciado por: Sistema',
        d: todaySl,
        t: nowTime(),
      });
      extraMsgs.push({
        id: nextMsgId(),
        from: 'sys',
        text: fillTemplate(cfg.templates.lembrete2h, target),
        d: todaySl,
        t: nowTime(),
      });
    } else if (ev.fase === 'acesso') {
      extraMsgs.push({
        id: nextMsgId(),
        from: 'api',
        text: 'Diálogo API | Lembrete 10m - Paciente iniciado por: Sistema',
        d: todaySl,
        t: nowTime(),
      });
      extraMsgs.push({
        id: nextMsgId(),
        from: 'sys',
        text: fillTemplate(cfg.templates.acesso, target),
        d: todaySl,
        t: nowTime(),
      });
      extraMsgs.push({
        id: nextMsgId(),
        from: 'evt',
        text: 'Confirmação concluída: chat transferido para "Em andamento"',
        t: nowTime(),
      });
      nextCase = {
        ...nextCase,
        key: 'andamento',
        dept: 'Consulta Médica - Em andamento',
        status: 'Aguardando',
        crm: 'Aguardando',
        opCount: 0,
        medMsgs: ['Estou finalizando a consulta anterior, entro em 5 minutos.'],
      };
      onToast(`${target.first} foi encaminhado para Em andamento.`);
    }

    nextCase.msgs = extraMsgs;
    updatePatient(target.id, () => nextCase);
    if (ev.fase === 'confirmacao') {
      void triggerPatientReply(nextCase);
    }
  };

  const handleFireAllConfirm = () => {
    const targets = allInDept.filter((p) => p.key === 'confirmacao');
    if (!targets.length) {
      onToast('Nenhum chat de Confirmação neste filtro.');
      return;
    }
    targets.forEach(handleFireEvent);
    onToast('Lembretes disparados para os chats de Confirmação.');
  };

  const handleAddNote = () => {
    if (!selected) return;
    const txt = noteText.trim();
    if (!txt && !pendingAudio && noteType === 'Nota') {
      onToast('Escreva a nota ou anexe um áudio.');
      return;
    }
    const note = {
      id: nextMsgId(),
      tipo: noteType,
      text: txt || (pendingAudio ? 'Nota de áudio' : ''),
      audio: pendingAudio?.url || null,
      t: nowTime(),
    };
    updatePatient(selected.id, (p) => ({ ...p, notas: [...p.notas, note] }));
    setNoteText('');
    setPendingAudio(null);
    if (selected.key === 'solicitacoes') onSignalPractice('d3_1');
    onToast('Nota interna adicionada.');
  };

  const handleChangeAtend = (nextAtend: AtendStatus) => {
    if (!selected) return;
    setAtendOpen(false);
    if (selected.atend !== nextAtend) {
      const closing = isConversationClosed(nextAtend);
      if (closing) {
        abortMapRef.current[selected.id]?.abort();
      }
      updatePatient(selected.id, (p) => ({
        ...p,
        typing: closing ? false : p.typing,
        atend: nextAtend,
        msgs: [
          ...p.msgs,
          {
            id: nextMsgId(),
            from: 'evt',
            text: closing
              ? `Status: ${nextAtend} · Conversa encerrada.`
              : `Status do atendimento: ${p.atend} → ${nextAtend}`,
            t: nowTime(),
          },
        ],
      }));
      if (closing) {
        signalDeptCompletion(selected.key);
      }
      if (ATEND_TAB[nextAtend] !== ATEND_TAB[selected.atend]) {
        const labels = {
          abertos: 'Em atendimento',
          aguardando: 'Aguardando',
          finalizados: 'Finalizados',
        };
        onToast(
          closing
            ? 'Atendimento concluído e conversa encerrada.'
            : `Chat movido para "${labels[ATEND_TAB[nextAtend]]}".`
        );
      }
    }
  };

  const handleForwardDept = (nextDept: string) => {
    if (!selected) return;
    setDeptOpen(false);
    if (selected.dept !== nextDept) {
      updatePatient(selected.id, (p) => ({
        ...p,
        dept: nextDept,
        msgs: [
          ...p.msgs,
          {
            id: nextMsgId(),
            from: 'evt',
            text: `Chat encaminhado de "${p.dept}" para "${nextDept}"`,
            t: nowTime(),
          },
        ],
      }));
      if (selected.key === 'agendamento' && deptKey(nextDept) === 'confirmacao') {
        onSignalPractice('d1_1');
      }
      onToast(`Chat encaminhado para ${nextDept}.`);
    }
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
    onToast(`${label} encaminhado no chat de ${selected.first}.`);
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

  const handleEvaluateWithAi = async () => {
    if (!selected || evaluating) return;
    setEvaluating(true);
    setEvalFeedback('Analisando seu atendimento segundo as regras Trainee...');
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
        setEvalFeedback(data.error || 'Não foi possível avaliar com IA.');
      } else {
        const fb = data.feedback || 'Sem parecer retornado.';
        setEvalFeedback(fb);
        const approved = /aprovado no caso/i.test(fb) && !/precisa ajustar/i.test(fb);
        onCaseEvaluated?.(approved);
      }
    } catch {
      setEvalFeedback('Erro de rede ao solicitar avaliação por IA.');
    } finally {
      setEvaluating(false);
    }
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && matchingShortcuts.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggIdx(
          (prev) => (prev + (e.key === 'ArrowDown' ? 1 : -1) + matchingShortcuts.length) % matchingShortcuts.length
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
      if (e.key === 'Escape') {
        setComposer((c) => c + ' ');
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const countForDeptOption = (opt: string) =>
    opt === 'Todos'
      ? patients.length
      : patients.filter((p) => deptKey(p.dept) === deptKey(opt)).length;

  const markedCoachDepts = new Set<string>();
  const nextConfirmEvent = selected ? CONFIRM_EVENTS[selected.ev] : undefined;

  return (
    <div className="max-w-[1460px] mx-auto space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--muted)]">Programa Trainee · Prática Real</p>
          <h1 className="text-2xl font-bold mt-0.5">Simulador de IA (Treino)</h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Atenda pacientes e médicos fictícios em todos os 7 subsetores. Use{' '}
            <code className="font-mono-num text-[var(--accent)] font-semibold">/</code> para
            atalhos rápidos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                if (!aiConfigured) {
                  onToast('GEMINI_API_KEY não configurada no servidor. Usando Roteiro Padrão.');
                  return;
                }
                setUseAiMode(true);
              }}
              className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                useAiMode
                  ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              IA Gemini
            </button>
            <button
              type="button"
              onClick={() => setUseAiMode(false)}
              className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                !useAiMode
                  ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Roteiro Padrão
            </button>
          </div>

          <button
            type="button"
            onClick={() => onGoView('subsetores')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
          >
            <ListChecks className="h-3.5 w-3.5" />
            Abrir passo a passo
          </button>
        </div>
      </div>

      {/* Barra de departamento e ações globais */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-semibold text-[var(--ink)]">
            Selecionar departamento para trabalhar
          </span>
          <button
            type="button"
            id="dd-btn"
            onClick={() => setDdOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={ddOpen}
            className="inline-flex items-center justify-between gap-3 min-w-[260px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold hover:border-[var(--accent)]"
          >
            <span className="truncate">{deptFilter}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          </button>

          {ddOpen && (
            <div
              role="listbox"
              className="absolute left-0 top-full mt-1.5 min-w-[300px] rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xl p-1 z-30"
            >
              {cfg.filtroDepartamentos.map((opt) => {
                const k = deptKey(opt);
                const coachAttr = !markedCoachDepts.has(k) ? `dd-${k}` : undefined;
                markedCoachDepts.add(k);
                return (
                  <button
                    key={opt}
                    type="button"
                    role="option"
                    aria-selected={opt === deptFilter}
                    data-coach={coachAttr}
                    onClick={() => {
                      setDeptFilter(opt);
                      setDdOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-xs text-left ${
                      opt === deptFilter
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-bold'
                        : 'hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    <span>{opt}</span>
                    <span className="text-[var(--muted)] tabular-nums">
                      {countForDeptOption(opt)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {deptFilter !== 'Todos' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] text-[var(--ink)] px-3 py-1 text-xs font-semibold">
              <span>{deptFilter}</span>
              <button
                type="button"
                onClick={() => setDeptFilter('Todos')}
                aria-label="Remover filtro"
                className="hover:opacity-75"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={handleFireAllConfirm}
          className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
        >
          Disparar próximo lembrete (Confirmação)
        </button>

        <button
          type="button"
          onClick={onResetSim}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)] whitespace-nowrap"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reiniciar simulação
        </button>
      </div>

      {/* Grade 3 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_320px] gap-3.5 lg:h-[min(760px,calc(100vh-210px))] min-h-[560px]">
        {/* Coluna 1: Lista de conversas */}
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] flex flex-col min-h-0 overflow-hidden h-[320px] lg:h-auto">
          <div className="grid grid-cols-3 border-b border-[var(--line)] shrink-0">
            {(
              [
                ['abertos', 'Em atend.'],
                ['aguardando', 'Aguardando'],
                ['finalizados', 'Finalizados'],
              ] as Array<[AtendTabKey, string]>
            ).map(([key, label]) => {
              const count = allInDept.filter((p) => ATEND_TAB[p.atend] === key).length;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setListTab(key)}
                  className={`py-2.5 px-1 text-[11px] font-semibold border-b-2 transition-colors whitespace-nowrap tabular-nums ${
                    listTab === key
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[var(--line)]">
            {visibleList.length ? (
              visibleList.map((p) => {
                const last = [...p.msgs].reverse().find((m) => m.from !== 'evt');
                const isSel = selected?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-coach={`ci-${p.id}`}
                    onClick={() => {
                      setSelectedId(p.id);
                      setDeptOpen(false);
                      setAtendOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 transition-colors ${
                      isSel ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    <div className="h-8 w-8 rounded-full bg-[var(--sunk)] text-[var(--accent)] font-bold text-xs grid place-items-center shrink-0">
                      {initials(p.nome)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-xs truncate">{p.nome}</strong>
                        {!p.isMed && (
                          <span className="text-[11px] text-[var(--muted)] font-mono-num shrink-0">
                            {p.hora}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--muted)] truncate mt-0.5">
                        {p.typing ? 'digitando...' : last ? last.text.replace(/\n+/g, ' ') : ''}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[var(--muted)]">
                        <span className="truncate">{shortDept(p.dept)}</span>
                        <span>·</span>
                        <span className="font-semibold text-[var(--ink)] truncate">{p.atend}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-6 text-center text-xs text-[var(--muted)]">
                Nenhum chat nesta aba.
              </div>
            )}
          </div>
        </section>

        {/* Coluna 2: Conversa */}
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] flex flex-col min-h-0 overflow-hidden h-[560px] lg:h-auto">
          {selected ? (
            <>
              <div className="px-4 py-2.5 border-b border-[var(--line)] flex flex-wrap items-center gap-2.5 shrink-0">
                <div className="h-9 w-9 rounded-full bg-[var(--sunk)] text-[var(--accent)] font-bold text-xs grid place-items-center shrink-0">
                  {initials(selected.nome)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <strong className="text-sm truncate">{selected.nome}</strong>
                    <button
                      type="button"
                      onClick={() => {
                        setNegOpen(true);
                        if (selected.key === 'geral') onSignalPractice('d1_0');
                      }}
                      data-coach="neg-btn"
                      title="Abrir negociação"
                      aria-label="Abrir negociação"
                      className="h-7 w-7 rounded-lg border border-[var(--line)] grid place-items-center hover:border-[var(--accent)] text-[var(--ink)]"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs text-[var(--muted)]">· {selected.tipo}</span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)] truncate">
                    {selected.isMed
                      ? `Médico(a) parceiro(a) · ${selected.tel}`
                      : `${selected.proc} · ${selected.tel} · ${selected.medico} · ${selected.data} às ${selected.hora}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {!selected.isMed && (
                    <StatusBadge tone={getConsultationTone(selected.status)}>
                      {selected.status}
                    </StatusBadge>
                  )}

                  {!isConversationClosed(selected.atend) && (
                    <button
                      type="button"
                      onClick={handleConcludeConversation}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] px-2.5 py-1 text-xs font-semibold hover:brightness-95 whitespace-nowrap"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Concluir atendimento
                    </button>
                  )}

                  {selected.key === 'confirmacao' && nextConfirmEvent && !isConversationClosed(selected.atend) && (
                    <button
                      type="button"
                      id="next-ev"
                      onClick={() => handleFireEvent(selected)}
                      className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
                    >
                      Disparar: {nextConfirmEvent.label}
                    </button>
                  )}

                  {aiConfigured && (
                    <button
                      type="button"
                      onClick={handleEvaluateWithAi}
                      disabled={evaluating}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--info-soft)] text-[var(--info)] px-2.5 py-1 text-xs font-semibold hover:opacity-90 whitespace-nowrap"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {evaluating ? 'Avaliando...' : 'Avaliar caso'}
                    </button>
                  )}
                </div>
              </div>

              {evalFeedback && (
                <div className="px-4 py-2.5 bg-[var(--info-soft)] text-[var(--info)] border-b border-[var(--line)] text-xs flex items-start justify-between gap-3">
                  <div className="whitespace-pre-wrap leading-relaxed">{evalFeedback}</div>
                  <button
                    type="button"
                    onClick={() => setEvalFeedback(null)}
                    aria-label="Fechar avaliação"
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

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
                        className="ml-auto max-w-[min(80%,440px)] rounded-xl border border-[var(--line)] bg-[var(--bubble-sys)] p-3 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted)]">
                          <Monitor className="h-3.5 w-3.5" />
                          <span>Gerada pelo sistema</span>
                        </div>
                        <div className="whitespace-pre-wrap break-words text-[13px]">{m.text}</div>
                        <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                          <span className="text-[var(--info)] font-medium">Sistema</span>
                          <span className="font-mono-num">
                            {m.d || getTodayMeta().todaySl}, {m.t}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  const isIn = m.from === 'pac';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col max-w-[78%] gap-0.5 ${
                        isIn ? 'self-start items-start' : 'ml-auto self-end items-end'
                      }`}
                    >
                      {m.label && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                          {m.label}
                        </span>
                      )}
                      <div
                        className={`rounded-xl px-3 py-2 text-[13px] whitespace-pre-wrap break-words shadow-xs ${
                          isIn
                            ? 'bg-[var(--bubble-in)] rounded-tl-sm border border-[var(--line)]'
                            : 'bg-[var(--bubble-out)] rounded-tr-sm'
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

              {isConversationClosed(selected.atend) ? (
                <div className="p-3 border-t border-[var(--line)] bg-[var(--surface-2)] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
                  <div className="flex items-center gap-2 text-xs">
                    <Lock className="h-4 w-4 text-[var(--accent)] shrink-0" />
                    <span className="font-semibold text-[var(--ink)]">
                      Conversa encerrada ({selected.atend})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {aiConfigured && (
                      <button
                        type="button"
                        onClick={handleEvaluateWithAi}
                        disabled={evaluating}
                        className="inline-flex items-center gap-1 rounded-lg bg-[var(--info-soft)] text-[var(--info)] px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {evaluating ? 'Avaliando...' : 'Avaliar atendimento'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleReopenConversation}
                      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
                    >
                      Reabrir atendimento
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 border-t border-[var(--line)] flex items-end gap-2 relative bg-[var(--surface)] shrink-0">
                  {showSuggestions && matchingShortcuts.length > 0 && (
                    <div className="absolute left-2.5 right-2.5 bottom-full mb-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xl max-h-60 overflow-y-auto z-20 divide-y divide-[var(--line)]">
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
                    id="composer"
                    rows={2}
                    value={composer}
                    onChange={(e) => {
                      setComposer(e.target.value);
                      setSuggIdx(0);
                    }}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Digite uma mensagem ou / para atalhos"
                    className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    data-coach="sim-send"
                    onClick={handleSendMessage}
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
              Selecione uma conversa na lista ao lado.
            </div>
          )}
        </section>

        {/* Coluna 3: Painel lateral do paciente */}
        <aside className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] overflow-y-auto divide-y divide-[var(--line)]">
          {selected && (
            <>
              <div className="p-3.5 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  Detalhes do {selected.isMed ? 'médico' : 'paciente'}
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-[var(--sunk)] text-[var(--accent)] font-bold text-sm grid place-items-center shrink-0">
                    {initials(selected.nome)}
                  </div>
                  <div className="min-w-0">
                    <strong className="text-sm block truncate">{selected.nome}</strong>
                    <span className="text-xs text-[var(--muted)] font-mono-num block">
                      {selected.tel}
                    </span>
                    <span className="text-[11px] text-[var(--info)] font-semibold">
                      {selected.tipo}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    data-coach="crm-btn"
                    onClick={() => onGoView('crm')}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--line)] py-1.5 px-2 text-xs font-semibold hover:border-[var(--accent)]"
                  >
                    <Columns3 className="h-3.5 w-3.5" />
                    CRM
                  </button>
                  <button
                    type="button"
                    data-coach="sol-btn"
                    onClick={() => onGoView('solicitacoes')}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--line)] py-1.5 px-2 text-xs font-semibold hover:border-[var(--accent)]"
                  >
                    <ListChecks className="h-3.5 w-3.5" />
                    Solicit.
                  </button>
                  <button
                    type="button"
                    onClick={() => setNegOpen(true)}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--line)] py-1.5 px-2 text-xs font-semibold hover:border-[var(--accent)]"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Negoc.
                  </button>
                </div>

                {!selected.isMed && (
                  <div className="pt-1 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                      Ações e encaminhamentos rápidos
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setNegOpen(true)}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] py-1.5 px-2 font-semibold hover:border-[var(--accent)] whitespace-nowrap"
                      >
                        <Calendar className="h-3 w-3 text-[var(--accent)]" />
                        Reagendar / Médico
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const l = buildConsultationLinks(selected.proc);
                          handleForwardResource(
                            `Olá, ${selected.first}! Segue o link da sua consulta com ${selected.medico} (${selected.data.replaceAll('-', '/')} às ${selected.hora}):\n${l.consulta}`,
                            'Link de consulta'
                          );
                        }}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] py-1.5 px-2 font-semibold hover:border-[var(--accent)] whitespace-nowrap"
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
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] py-1.5 px-2 font-semibold hover:border-[var(--accent)] whitespace-nowrap"
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
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] py-1.5 px-2 font-semibold hover:border-[var(--accent)] whitespace-nowrap"
                      >
                        <Receipt className="h-3 w-3 text-[var(--accent)]" />
                        Nota fiscal
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {selected.key === 'solicitacoes' && (
                <div className="p-3.5 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Solicitação vinculada
                  </p>
                  {!selected.sol ? (
                    <button
                      type="button"
                      data-coach="sol-new"
                      onClick={() => onOpenSolModal(selected.id, 'new')}
                      className="w-full rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] py-1.5 px-3 text-xs font-semibold"
                    >
                      Nova solicitação
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge tone="info">{selected.sol.st}</StatusBadge>
                        <span className="text-xs text-[var(--muted)]">{selected.sol.tipo}</span>
                        {selected.sol.urg && <StatusBadge tone="bad">Urgente</StatusBadge>}
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenSolModal(selected.id, 'edit')}
                        className="w-full rounded-lg border border-[var(--line)] py-1.5 px-3 text-xs font-semibold hover:border-[var(--accent)]"
                      >
                        Editar solicitação
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="p-3.5 space-y-2 relative">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  Status do atendimento
                </p>
                <button
                  type="button"
                  id="atend-btn"
                  onClick={() => {
                    setAtendOpen((o) => !o);
                    setDeptOpen(false);
                  }}
                  className="w-full flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-semibold hover:border-[var(--accent)]"
                >
                  <StatusBadge tone={getAtendTone(selected.atend)}>{selected.atend}</StatusBadge>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {atendOpen && (
                  <div className="absolute left-3.5 right-3.5 top-full mt-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xl p-1 z-20">
                    {ATEND_LIST.map((item) => (
                      <button
                        key={item.v}
                        type="button"
                        data-coach={`atend-${item.v.replace(/\s+/g, '-')}`}
                        onClick={() => handleChangeAtend(item.v)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[var(--accent-soft)]"
                      >
                        <StatusBadge tone={item.tone}>{item.v}</StatusBadge>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3.5 space-y-2 relative">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  Departamento
                </p>
                <button
                  type="button"
                  id="dept-btn"
                  onClick={() => {
                    setDeptOpen((o) => !o);
                    setAtendOpen(false);
                  }}
                  className="w-full flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-semibold hover:border-[var(--accent)]"
                >
                  <span className="truncate">{selected.dept}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                </button>
                {deptOpen && (
                  <div className="absolute left-3.5 right-3.5 top-full mt-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xl p-1 max-h-64 overflow-y-auto z-20">
                    {(() => {
                      const seen = new Set<string>();
                      return cfg.encaminharDepartamentos.map((d) => {
                        const k = deptKey(d);
                        const coachAttr = !seen.has(k) ? `dept-${k}` : undefined;
                        seen.add(k);
                        return (
                          <button
                            key={d}
                            type="button"
                            data-coach={coachAttr}
                            onClick={() => handleForwardDept(d)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs ${
                              deptKey(d) === deptKey(selected.dept)
                                ? 'text-[var(--accent)] font-bold'
                                : 'hover:bg-[var(--accent-soft)]'
                            }`}
                          >
                            {d}
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

              <div className="p-3.5 space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] tabular-nums">
                  Notas ({selected.notas.length})
                </p>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selected.notas.length ? (
                    selected.notas.map((n) => (
                      <div
                        key={n.id}
                        className="rounded-lg bg-[var(--note)] p-2.5 text-xs space-y-1"
                      >
                        <p className="break-words">
                          {n.tipo !== 'Nota' && <strong>{n.tipo} · </strong>}
                          {n.text}
                        </p>
                        {n.audio && <audio controls src={n.audio} className="w-full h-8" />}
                        <span className="text-[10px] text-[var(--muted)] font-mono-num block">
                          {n.t} · você
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[var(--muted)]">
                      Nenhuma nota ainda. Registre aqui todas as tentativas de contato.
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-[var(--line)] bg-[var(--note)] overflow-hidden">
                  <div className="flex items-center gap-1.5 p-1.5 border-b border-[var(--line)]">
                    <select
                      id="note-type"
                      value={noteType}
                      onChange={(e) => setNoteType(e.target.value)}
                      aria-label="Tipo de nota"
                      className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11px]"
                    >
                      <option>Nota</option>
                      <option>Falta com custo</option>
                      <option>Falta sem custo</option>
                    </select>
                    <select
                      aria-label="Visibilidade"
                      className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11px]"
                    >
                      <option>Público</option>
                      <option>Privado</option>
                    </select>
                  </div>

                  <textarea
                    id="note-text"
                    rows={2}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Escreva a nota interna. Ex.: Liguei às 14:10, não atendeu."
                    className="w-full bg-transparent p-2 text-xs resize-y focus:outline-none"
                  />

                  <div className="flex flex-wrap items-center gap-1.5 p-1.5 border-t border-[var(--line)]">
                    <label className="relative overflow-hidden inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold cursor-pointer">
                      <Mic className="h-3 w-3" />
                      Áudio
                      <input
                        type="file"
                        accept="audio/*"
                        capture="user"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            setPendingAudio({ url: URL.createObjectURL(f), name: f.name });
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </label>
                    <span className="text-[10px] text-[var(--muted)] flex-1 truncate">
                      {pendingAudio ? `${pendingAudio.name} anexado` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setNoteText('');
                        setPendingAudio(null);
                      }}
                      className="px-2 py-1 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      data-coach="note-add"
                      onClick={handleAddNote}
                      className="rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] px-2.5 py-1 text-[11px] font-semibold"
                    >
                      Adicionar Nota
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

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
