import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  FileText,
  Filter,
  Link2,
  MoreVertical,
  Package,
  Phone,
  Receipt,
  RefreshCw,
  Send,
  SquarePen,
  Stethoscope,
  UserCog,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { MEDS } from '../data/defaults';
import type { PatientCase } from '../types';
import { getTodayMeta, initials } from '../utils/helpers';
import {
  buildConsultationLinks,
  DoctorSchedulePicker,
  formatDateKeyToBr,
  getDoctorSlotsForDate,
} from './ConsultationModals';
import { getConsultationTone, StatusBadge } from './StatusBadge';

type NegTab = 'anamnese' | 'entregas' | 'consultas' | 'links' | 'financeiro';

interface NegotiationModalProps {
  patient: PatientCase;
  initialTab?: 'consultas' | 'entregas';
  onClose: () => void;
  onToast: (msg: string) => void;
  onStartCall?: (patient: PatientCase) => void;
  onOpenChat?: (patientId: string) => void;
  onReschedule?: (payload: {
    dateKey: string;
    dataBr: string;
    hora: string;
    medico: string;
    sendToChat: boolean;
  }) => void;
  onChangeDoctor?: (medico: string, sendToChat: boolean) => void;
  onChangeStatus?: (status: string, sendToChat?: boolean) => void;
  onAddNote?: (text: string, tipo?: string) => void;
  onForwardToChat?: (text: string, label: string) => void;
}

function copyToClipboard(text: string, onToast: (m: string) => void, msg: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => onToast(msg))
      .catch(() => onToast(msg));
  } else {
    onToast(msg);
  }
}

export function NegotiationModal({
  patient,
  initialTab = 'consultas',
  onClose,
  onToast,
  onStartCall,
  onOpenChat,
  onReschedule,
  onChangeDoctor,
  onChangeStatus,
  onAddNote,
  onForwardToChat,
}: NegotiationModalProps) {
  const [tab, setTab] = useState<NegTab>(initialTab);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [cardMenuIdx, setCardMenuIdx] = useState<number | null>(null);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [pipelineStage, setPipelineStage] = useState(() => `${patient.dept} · Em atendimento`);
  const [showMoreProfile, setShowMoreProfile] = useState(false);

  // Active sub-mode inside Consultas pane
  const [subPanel, setSubPanel] = useState<
    null | 'reagendar' | 'medico' | 'status' | 'nota' | 'cancelar' | 'receita'
  >(null);
  const [receitaTarget, setReceitaTarget] = useState<{
    num: string;
    medico: string;
    data: string;
    tipo: string;
  } | null>(null);

  const { todayKey } = getTodayMeta();
  const [newMedico, setNewMedico] = useState(
    MEDS.includes(patient.medico) ? patient.medico : MEDS[0]
  );
  const [newDateKey, setNewDateKey] = useState(todayKey);
  const [newHora, setNewHora] = useState(() => {
    const todaySlots = getDoctorSlotsForDate(
      MEDS.includes(patient.medico) ? patient.medico : MEDS[0],
      todayKey
    ).slots;
    if (todaySlots.includes(patient.hora)) return patient.hora;
    return todaySlots[0] || patient.hora || '14:00';
  });
  const [scheduleAuthorized, setScheduleAuthorized] = useState(true);
  const [notifyChat, setNotifyChat] = useState(true);

  const [statusChoice, setStatusChoice] = useState(patient.status || 'Aguardando consulta');
  const [noteInput, setNoteInput] = useState('');
  const [noteType, setNoteType] = useState('Nota');
  const [cancelReason, setCancelReason] = useState('Solicitação do paciente');

  const links = buildConsultationLinks(patient.proc);
  const medOptions = MEDS.includes(patient.medico) ? MEDS : [patient.medico, ...MEDS];

  const activeStatusDisplay =
    patient.status === 'Pendente' || patient.status === 'Aguardando'
      ? 'Aguardando consulta'
      : patient.status;

  const consultas = [
    {
      num: `#${284500 + patient.k}`,
      data: patient.data.replaceAll('-', '/'),
      tipo: patient.tipo === 'Gratuita' ? 'Gratuita' : patient.tipo || 'Consulta Médica',
      medico: patient.medico,
      status: activeStatusDisplay,
      obs: `Consulta agendada para ${patient.data.replaceAll('-', '/')} às ${patient.hora}.`,
      isActive: true,
    },
    ...patient.hist.consultas.map((c) => ({
      ...c,
      status: 'Consulta realizada',
      isActive: false,
    })),
  ];

  const handleForwardLink = (kind: 'consulta' | 'convidado') => {
    const url = kind === 'consulta' ? links.consulta : links.convidado;
    const label = kind === 'consulta' ? 'Link de consulta' : 'Link de convidado';
    const text =
      kind === 'consulta'
        ? `Olá, ${patient.first}! Segue o link da sua consulta com ${patient.medico} (${patient.data.replaceAll('-', '/')} às ${patient.hora}):\n${url}\n\nPor favor, autorize câmera e microfone ao entrar.`
        : `Olá, ${patient.first}! Segue o link de convidado para a consulta de ${patient.data.replaceAll('-', '/')} às ${patient.hora} com ${patient.medico}:\n${url}`;

    copyToClipboard(url, onToast, `${label} copiado.`);
    onForwardToChat?.(text, label);
  };

  const handleForwardAnamnese = (mode: 'primeira' | 'recorrencia') => {
    const label =
      mode === 'primeira' ? 'Primeira anamnese' : 'Anamnese de recorrência';
    const text =
      mode === 'primeira'
        ? `Olá, ${patient.first}! Para agilizar seu atendimento com ${patient.medico}, preencha sua primeira anamnese antes da consulta:\n${links.anamnese}?tipo=primeira`
        : `Olá, ${patient.first}! Segue o link da anamnese de recorrência para atualizar seus dados antes da consulta:\n${links.anamnese}?tipo=recorrencia`;
    copyToClipboard(`${links.anamnese}?tipo=${mode}`, onToast, `Link de ${label.toLowerCase()} copiado.`);
    onForwardToChat?.(text, label);
  };

  const handleForwardInvoice = () => {
    const valor = patient.tipo === 'Gratuita' ? 'R$ 0,00 (Gratuita)' : 'R$ 89,00';
    const text = `Olá, ${patient.first}! Segue a Nota Fiscal (${links.nfNumero}) da sua consulta com ${patient.medico}:\n• Valor: ${valor}\n• Status: Emitida\n• PDF da NFS-e: ${links.nfLink}`;
    copyToClipboard(links.nfLink, onToast, `Nota fiscal ${links.nfNumero} copiada.`);
    onForwardToChat?.(text, 'Nota fiscal');
  };

  const iconTabs: Array<{ key: NegTab; label: string; icon: typeof Stethoscope }> = [
    { key: 'anamnese', label: 'Anamnese', icon: FileText },
    { key: 'entregas', label: 'Entregas', icon: Package },
    { key: 'consultas', label: 'Consultas', icon: Stethoscope },
    { key: 'links', label: 'Links', icon: Eye },
    { key: 'financeiro', label: 'Nota fiscal', icon: Receipt },
  ];

  const isConfirmedAlready = patient.status === 'Confirmada';

  return (
    <div
      className="fixed inset-0 z-40 bg-[rgba(6,20,12,0.52)] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Negociação de ${patient.nome}`}
    >
      <div className="bg-[var(--surface-2)] border border-[var(--line)] rounded-2xl w-full max-w-[1040px] max-h-[calc(100vh-32px)] flex flex-col overflow-hidden shadow-2xl">
        {/* Top breadcrumb bar matching reference */}
        <div className="px-5 py-3 bg-[var(--surface)] border-b border-[var(--line)] flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[var(--muted)]">
            <span>Home</span>
            <span>/</span>
            <strong className="text-[var(--ink)]">Negociação · Consultas</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-coach="neg-close"
            aria-label="Fechar negociação"
            className="h-8 w-8 rounded-lg border border-[var(--line)] grid place-items-center hover:border-[var(--accent)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid md:grid-cols-[290px_minmax(0,1fr)] gap-4 p-4 overflow-y-auto flex-1">
          {/* LEFT PROFILE CARD matching image_7588aef2.png */}
          <aside className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-4 space-y-4 h-fit">
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar
              </button>
              <button
                type="button"
                onClick={() => setShowMoreProfile((v) => !v)}
                aria-label="Mais opções do contato"
                className="h-7 w-7 rounded-lg hover:bg-[var(--surface-2)] grid place-items-center text-[var(--muted)]"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-bold text-sm grid place-items-center shrink-0">
                {initials(patient.nome)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-sm truncate">{patient.nome}</p>
                  <span className="text-[11px] text-[var(--muted)] font-mono-num shrink-0">
                    {patient.proc}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMoreProfile((v) => !v)}
                  className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[var(--accent)] hover:underline mt-0.5"
                >
                  Ver mais detalhes
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>

            {showMoreProfile && (
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-2.5 text-[11px] space-y-1.5">
                <p>
                  <span className="text-[var(--muted)]">Setor:</span> <strong>{patient.dept}</strong>
                </p>
                <p>
                  <span className="text-[var(--muted)]">Pipeline:</span> <strong>{pipelineStage}</strong>
                </p>
                <p>
                  <span className="text-[var(--muted)]">Tipo:</span> <strong>{patient.tipo}</strong>
                </p>
                <div className="pt-1 border-t border-[var(--line)] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                      Notas recentes ({patient.notas.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTab('consultas');
                        setSubPanel('nota');
                      }}
                      className="text-[10px] font-bold text-[var(--accent)] hover:underline"
                    >
                      + Nova nota
                    </button>
                  </div>
                  {patient.notas.length ? (
                    patient.notas.slice(-3).map((n) => (
                      <div key={n.id} className="rounded bg-[var(--surface)] px-2 py-1 text-[10px]">
                        <span className="font-semibold text-[var(--accent)]">{n.tipo}</span> ({n.t}):{' '}
                        {n.text}
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-[var(--muted)]">Sem notas registradas.</p>
                  )}
                </div>
              </div>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setPipelineOpen((o) => !o)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] py-2.5 px-3 text-xs font-semibold hover:brightness-105"
              >
                <span>Alterar Pipeline e etapa</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {pipelineOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xl p-1 text-xs space-y-0.5">
                  {[
                    'Confirmação · Lembrete enviado',
                    'Reagendamento · Aguardando escolha',
                    'Consulta Médica · Em andamento',
                    'Solicitações · Em análise',
                    'Pós-venda · Concluído',
                  ].map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => {
                        setPipelineStage(stage);
                        setPipelineOpen(false);
                        onToast(`Pipeline atualizado: ${stage}`);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg ${
                        pipelineStage === stage
                          ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-bold'
                          : 'hover:bg-[var(--surface-2)]'
                      }`}
                    >
                      {stage}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 5-Icon Tab Strip matching screenshot */}
            <div className="flex items-center justify-between gap-1 pt-1" role="tablist">
              <ChevronLeft className="h-3.5 w-3.5 text-[var(--muted)] shrink-0" />
              <div className="flex items-center gap-1">
                {iconTabs.map((item) => {
                  const Icon = item.icon;
                  const active = tab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      title={item.label}
                      data-coach={
                        item.key === 'consultas'
                          ? 'neg-tab-consultas'
                          : item.key === 'entregas'
                            ? 'neg-tab-entregas'
                            : undefined
                      }
                      onClick={() => {
                        setTab(item.key);
                        setSubPanel(null);
                        setCardMenuIdx(null);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-[var(--accent-soft)] text-[var(--ink)] border border-[var(--accent)]/40'
                          : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? 'text-[var(--accent)]' : ''}`} />
                      {active && <span>{item.label}</span>}
                    </button>
                  );
                })}
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)] shrink-0" />
            </div>

            <button
              type="button"
              onClick={() => {
                if (onOpenChat) {
                  onOpenChat(patient.id);
                } else {
                  onClose();
                }
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] py-2 px-3 text-xs font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
            >
              <span>ClickChat</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[var(--accent)]" />
            </button>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 space-y-2.5 text-xs">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--accent)]">
                <Phone className="h-3.5 w-3.5" />
                Formas de contato
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--muted)]">Telefone</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (onStartCall) {
                        onStartCall(patient);
                      } else {
                        copyToClipboard(patient.tel, onToast, `Telefone ${patient.tel} copiado.`);
                      }
                    }}
                    title="Ligar para o paciente"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] bg-[var(--surface)] px-2.5 py-1 font-mono-num text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                  >
                    <Phone className="h-3 w-3" />
                    {patient.tel}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(patient.tel, onToast, `Telefone ${patient.tel} copiado.`)
                    }
                    title="Copiar telefone"
                    aria-label="Copiar telefone"
                    className="h-7 w-7 rounded-lg border border-[var(--line)] bg-[var(--surface)] grid place-items-center text-[var(--muted)] hover:border-[var(--accent)]"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--muted)]">E-mail</span>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(patient.email, onToast, `E-mail ${patient.email} copiado.`)
                  }
                  className="break-all text-right font-medium hover:underline"
                >
                  {patient.email}
                </button>
              </div>
            </div>
          </aside>

          {/* RIGHT WORKSPACE */}
          <section className="flex flex-col min-w-0 space-y-3">
            {/* Sub-panels inside Consultas: Reagendar, Alterar Médico, Status, Nota, Cancelar */}
            {tab === 'consultas' && subPanel === 'reagendar' && !patient.isMed && (
              <div className="rounded-2xl border border-[var(--accent)] bg-[var(--surface)] p-5 space-y-4 text-xs shadow-sm">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center shrink-0">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold">Reagendar Consulta · #{284500 + patient.k}</h3>
                      <p className="text-[11px] text-[var(--muted)] font-mono-num">
                        Atual: {patient.data.replaceAll('-', '/')} às {patient.hora} · {patient.medico}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubPanel(null)}
                    className="rounded-lg border border-[var(--line)] px-3 py-1.5 font-semibold hover:border-[var(--accent)]"
                  >
                    Voltar às consultas
                  </button>
                </div>

                <DoctorSchedulePicker
                  medico={newMedico}
                  currentMedico={patient.medico}
                  dateKey={newDateKey}
                  hora={newHora}
                  onChangeMedico={setNewMedico}
                  onChangeDateKey={setNewDateKey}
                  onChangeHora={setNewHora}
                  onAuthChange={setScheduleAuthorized}
                  onRequestLeadership={(info) => {
                    onAddNote?.(
                      `Solicitação enviada à Liderança (Katlen Pfeifer / Stephanye / Iris) para abrir agenda de ${info.medico} em ${info.dataBr}: ${info.motivo}`,
                      'Nota'
                    );
                    onToast(
                      `Solicitação enviada à Liderança para liberar agenda de ${info.medico} em ${info.dataBr}.`
                    );
                  }}
                />

                <label className="flex items-center gap-2 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyChat}
                    onChange={(e) => setNotifyChat(e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  <span>Encaminhar confirmação de reagendamento no chat do paciente</span>
                </label>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--line)]">
                  <span className="text-[11px] text-[#c47a1c] dark:text-[#f0b354] font-medium">
                    {!scheduleAuthorized
                      ? 'Solicite abertura à Liderança ou libere a data específica para confirmar.'
                      : ''}
                  </span>
                  <div className="flex gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => setSubPanel(null)}
                      className="rounded-xl border border-[var(--line)] px-4 py-2 font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={!scheduleAuthorized}
                      onClick={() => {
                        if (!scheduleAuthorized) {
                          onToast(
                            'Para outro dia, solicite abertura à Liderança ou selecione data específica liberada.'
                          );
                          return;
                        }
                        const dataBr = formatDateKeyToBr(newDateKey);
                        onReschedule?.({
                          dateKey: newDateKey,
                          dataBr,
                          hora: newHora,
                          medico: newMedico,
                          sendToChat: notifyChat,
                        });
                        setSubPanel(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2 font-semibold hover:brightness-105 disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Confirmar reagendamento
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === 'consultas' && subPanel === 'medico' && !patient.isMed && (
              <div className="rounded-2xl border border-[var(--accent)] bg-[var(--surface)] p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">Alterar Médico · #{284500 + patient.k}</h3>
                  <button
                    type="button"
                    onClick={() => setSubPanel(null)}
                    className="text-[var(--muted)] hover:text-[var(--ink)]"
                  >
                    Fechar
                  </button>
                </div>
                <p className="text-[var(--muted)]">
                  Médico atual: <strong className="text-[var(--ink)]">{patient.medico}</strong>
                </p>
                <select
                  value={newMedico}
                  onChange={(e) => setNewMedico(e.target.value)}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 font-semibold"
                >
                  {medOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyChat}
                    onChange={(e) => setNotifyChat(e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  <span>Avisar paciente no chat sobre a alteração de médico</span>
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSubPanel(null)}
                    className="rounded-xl border border-[var(--line)] px-3.5 py-2 font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeDoctor?.(newMedico, notifyChat);
                      setSubPanel(null);
                    }}
                    className="rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-3.5 py-2 font-semibold"
                  >
                    Salvar médico
                  </button>
                </div>
              </div>
            )}

            {tab === 'consultas' && subPanel === 'status' && !patient.isMed && (
              <div className="rounded-2xl border border-[var(--accent)] bg-[var(--surface)] p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">Alterar status da presença</h3>
                  <button
                    type="button"
                    onClick={() => setSubPanel(null)}
                    className="text-[var(--muted)] hover:text-[var(--ink)]"
                  >
                    Fechar
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    'Aguardando consulta',
                    'Confirmada',
                    'Em andamento',
                    'Realizada',
                    'Faltou',
                    'Cancelada',
                  ].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusChoice(st)}
                      className={`rounded-xl border px-3 py-2 font-semibold text-left ${
                        statusChoice === st
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                          : 'border-[var(--line)] bg-[var(--surface-2)]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSubPanel(null)}
                    className="rounded-xl border border-[var(--line)] px-3.5 py-2 font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const mapped =
                        statusChoice === 'Aguardando consulta' ? 'Aguardando' : statusChoice;
                      onChangeStatus?.(mapped);
                      setSubPanel(null);
                    }}
                    className="rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-3.5 py-2 font-semibold"
                  >
                    Salvar status
                  </button>
                </div>
              </div>
            )}

            {tab === 'consultas' && subPanel === 'nota' && (
              <div className="rounded-2xl border border-[var(--accent)] bg-[var(--surface)] p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">Adicionar nota na consulta</h3>
                  <button
                    type="button"
                    onClick={() => setSubPanel(null)}
                    className="text-[var(--muted)] hover:text-[var(--ink)]"
                  >
                    Fechar
                  </button>
                </div>
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value)}
                  className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1.5"
                >
                  <option>Nota</option>
                  <option>Falta com custo</option>
                  <option>Falta sem custo</option>
                </select>
                <textarea
                  rows={3}
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Ex.: Paciente pediu reagendamento para o período da tarde."
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 resize-y focus:outline-none focus:border-[var(--accent)]"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSubPanel(null)}
                    className="rounded-xl border border-[var(--line)] px-3.5 py-2 font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!noteInput.trim()) return;
                      onAddNote?.(noteInput.trim(), noteType);
                      setNoteInput('');
                      setSubPanel(null);
                    }}
                    className="rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-3.5 py-2 font-semibold"
                  >
                    Salvar nota
                  </button>
                </div>
              </div>
            )}

            {tab === 'consultas' && subPanel === 'cancelar' && !patient.isMed && (
              <div className="rounded-2xl border border-[var(--danger)] bg-[var(--surface)] p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--danger)]">
                    Cancelar consulta · #{284500 + patient.k}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSubPanel(null)}
                    className="text-[var(--muted)] hover:text-[var(--ink)]"
                  >
                    Fechar
                  </button>
                </div>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2"
                >
                  <option>Solicitação do paciente</option>
                  <option>Falta / Sem aviso prévio (regra 2h)</option>
                  <option>Indisponibilidade médica</option>
                  <option>Duplicidade de agendamento</option>
                </select>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSubPanel(null)}
                    className="rounded-xl border border-[var(--line)] px-3.5 py-2 font-semibold"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeStatus?.('Cancelada', false);
                      onAddNote?.(`Consulta cancelada: ${cancelReason}`, 'Nota');
                      setSubPanel(null);
                    }}
                    className="rounded-xl bg-[var(--danger)] text-white px-3.5 py-2 font-semibold"
                  >
                    Confirmar cancelamento
                  </button>
                </div>
              </div>
            )}

            {tab === 'consultas' && subPanel === 'receita' && receitaTarget && (
              <div className="rounded-2xl border border-[var(--accent)] bg-[var(--surface)] p-5 space-y-4 text-xs shadow-sm">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
                      Receita Médica Digital
                    </span>
                    <h3 className="text-base font-bold mt-0.5">
                      Prescrição · Consulta {receitaTarget.num}
                    </h3>
                    <p className="text-[11px] text-[var(--muted)]">
                      Emitida em {receitaTarget.data} · {receitaTarget.medico}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubPanel(null)}
                    className="rounded-lg border border-[var(--line)] px-3 py-1.5 font-semibold hover:border-[var(--accent)]"
                  >
                    Voltar às consultas
                  </button>
                </div>

                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm">
                      Óleo Full Spectrum CBD 3000mg / THC &lt;0,3% (Frasco 30ml)
                    </strong>
                    <StatusBadge tone="ok">Assinada digitalmente</StatusBadge>
                  </div>
                  <p>
                    <span className="text-[var(--muted)]">Paciente:</span>{' '}
                    <strong>{patient.nome}</strong> ({patient.proc})
                  </p>
                  <p>
                    <span className="text-[var(--muted)]">Posologia prescrita:</span> Uso sublingual
                    — iniciar com 3 gotas à noite por 7 dias, evoluindo conforme acompanhamento médico
                    para 5 gotas manhã e noite.
                  </p>
                  <p className="font-mono-num text-[11px] text-[var(--muted)]">
                    Validade: 6 meses · Código de verificação ICP-Brasil: CC-{284500 + patient.k}-RX
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `Receita ${receitaTarget.num} · ${patient.nome} · Óleo Full Spectrum CBD 3000mg (30ml) · ${receitaTarget.medico} · ${receitaTarget.data}`,
                        onToast,
                        'Dados da receita copiados.'
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 font-semibold hover:border-[var(--accent)]"
                  >
                    <Copy className="h-3.5 w-3.5 text-[var(--accent)]" />
                    Copiar resumo da receita
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const text = `Olá, ${patient.first}! Segue a 2ª via da sua receita emitida na consulta ${receitaTarget.num} (${receitaTarget.data}) com ${receitaTarget.medico}:\n• Produto: Óleo Full Spectrum CBD 3000mg (30ml)\n• Código digital: CC-${284500 + patient.k}-RX`;
                      onForwardToChat?.(text, '2ª via de receita');
                      setSubPanel(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-3.5 py-2 font-semibold"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Reenviar receita no chat
                  </button>
                </div>
              </div>
            )}

            {/* CONSULTAS TAB */}
            {tab === 'consultas' && !subPanel && (
              <>
                {consultas.map((c, idx) => (
                  <div
                    key={c.num}
                    className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3 relative"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-bold">Consulta Médica - {c.num}</h3>
                      <div className="flex items-center gap-2">
                        <StatusBadge
                          tone={
                            c.status === 'Aguardando consulta'
                              ? 'warn'
                              : getConsultationTone(c.status)
                          }
                        >
                          {c.status}
                        </StatusBadge>
                        <StatusBadge tone="info">
                          {c.tipo === 'Consulta Médica' ? 'Recorrência' : c.tipo}
                        </StatusBadge>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-[var(--muted)] block text-[11px]">
                          Médico Responsável
                        </span>
                        <strong className="text-sm">{c.medico}</strong>
                      </div>
                      <div>
                        <span className="text-[var(--muted)] block text-[11px]">Paciente</span>
                        <span className="font-medium text-sm">{patient.nome}</span>
                      </div>
                    </div>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
                      >
                        Mais informações
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${
                            expandedIdx === idx ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {expandedIdx === idx && (
                      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 text-xs space-y-2">
                        <div className="flex flex-wrap gap-4 font-mono-num">
                          <span>
                            <strong className="text-[var(--muted)]">Data:</strong> {c.data}
                          </span>
                          {c.isActive && (
                            <span>
                              <strong className="text-[var(--muted)]">Horário:</strong>{' '}
                              {patient.hora}
                            </span>
                          )}
                          <span>
                            <strong className="text-[var(--muted)]">Modalidade:</strong> {c.tipo}
                          </span>
                        </div>
                        <p className="text-[var(--muted)]">{c.obs}</p>
                        {c.isActive && !patient.isMed && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => handleForwardLink('consulta')}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 font-semibold hover:border-[var(--accent)]"
                            >
                              <Link2 className="h-3 w-3 text-[var(--accent)]" />
                              Encaminhar link de consulta
                            </button>
                            <button
                              type="button"
                              onClick={() => handleForwardLink('convidado')}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 font-semibold hover:border-[var(--accent)]"
                            >
                              <Users className="h-3 w-3 text-[var(--accent)]" />
                              Encaminhar link de convidado
                            </button>
                            <button
                              type="button"
                              onClick={handleForwardInvoice}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 font-semibold hover:border-[var(--accent)]"
                            >
                              <Receipt className="h-3 w-3 text-[var(--accent)]" />
                              Encaminhar Nota Fiscal
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bottom card action bar matching image_7588aef2.png */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--line)]">
                      {c.isActive ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (onStartCall) {
                                onStartCall(patient);
                              } else {
                                copyToClipboard(
                                  patient.tel,
                                  onToast,
                                  `Ligação iniciada / número ${patient.tel} copiado.`
                                );
                                onAddNote?.(`Tentativa de ligação para ${patient.tel}`, 'Nota');
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            Ligar
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Ver Detalhes
                          </button>
                          {!patient.isMed && onReschedule && (
                            <button
                              type="button"
                              onClick={() => setSubPanel('reagendar')}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] px-3 py-1.5 text-xs font-semibold hover:brightness-105"
                            >
                              <Calendar className="h-3.5 w-3.5" />
                              Reagendar Consulta
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setReceitaTarget({
                                num: c.num,
                                medico: c.medico,
                                data: c.data,
                                tipo: c.tipo,
                              });
                              setSubPanel('receita');
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Ver receita
                          </button>
                          <button
                            type="button"
                            onClick={() => setTab('anamnese')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Acessar anamnese
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] px-3 py-1.5 text-xs font-semibold"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Ver detalhes da consulta
                          </button>
                        </div>
                      )}

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setCardMenuIdx(cardMenuIdx === idx ? null : idx)}
                          aria-label={`Mais ações da consulta ${c.num}`}
                          className="h-8 w-8 rounded-lg hover:bg-[var(--surface-2)] grid place-items-center text-[var(--muted)] hover:text-[var(--ink)]"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {cardMenuIdx === idx && (
                          <>
                            <div
                              className="fixed inset-0 z-20"
                              onClick={() => setCardMenuIdx(null)}
                            />
                            <div className="absolute right-0 bottom-full mb-1.5 z-30 w-[250px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl p-1.5 text-xs space-y-0.5">
                              <button
                                type="button"
                                disabled={isConfirmedAlready}
                                onClick={() => {
                                  setCardMenuIdx(null);
                                  onChangeStatus?.('Confirmada', true);
                                }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left ${
                                  isConfirmedAlready
                                    ? 'text-[var(--muted)] opacity-55 cursor-not-allowed'
                                    : 'hover:bg-[var(--surface-2)] font-medium'
                                }`}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Confirmar agendamento
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setCardMenuIdx(null);
                                  setSubPanel('medico');
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-[var(--surface-2)]"
                              >
                                <UserCog className="h-3.5 w-3.5 text-[var(--muted)]" />
                                Alterar Médico
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setCardMenuIdx(null);
                                  handleForwardAnamnese('primeira');
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-[var(--surface-2)]"
                              >
                                <Filter className="h-3.5 w-3.5 text-[var(--muted)]" />
                                Enviar primeira anamnese
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setCardMenuIdx(null);
                                  handleForwardAnamnese('recorrencia');
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-[var(--surface-2)]"
                              >
                                <Filter className="h-3.5 w-3.5 text-[var(--muted)]" />
                                Enviar anamnese de recorrência
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setCardMenuIdx(null);
                                  copyToClipboard(
                                    links.anamnese,
                                    onToast,
                                    `Link da anamnese copiado: ${links.anamnese}`
                                  );
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-[var(--surface-2)]"
                              >
                                <Copy className="h-3.5 w-3.5 text-[var(--muted)]" />
                                Copiar link da anamnese
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setCardMenuIdx(null);
                                  setSubPanel('nota');
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-[var(--surface-2)]"
                              >
                                <SquarePen className="h-3.5 w-3.5 text-[var(--muted)]" />
                                Adicionar nota
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setCardMenuIdx(null);
                                  setSubPanel('status');
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-[var(--surface-2)]"
                              >
                                <RefreshCw className="h-3.5 w-3.5 text-[var(--muted)]" />
                                Alterar status da presença
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setCardMenuIdx(null);
                                  setSubPanel('reagendar');
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left font-semibold text-[#c47a1c] dark:text-[#f0b354] bg-[#fbecd2]/55 dark:bg-[#3a2a10]/55 hover:brightness-95"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Reagendar Consulta
                              </button>

                              <div className="my-1 border-t border-[var(--line)]" />

                              <button
                                type="button"
                                onClick={() => {
                                  setCardMenuIdx(null);
                                  setSubPanel('cancelar');
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Cancelar consulta
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* ANAMNESE TAB */}
            {tab === 'anamnese' && (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold">Anamnese do paciente</h3>
                    <p className="text-[var(--muted)] mt-0.5">
                      Link direto:{' '}
                      <span className="font-mono-num text-[var(--ink)]">{links.anamnese}</span>
                    </p>
                  </div>
                  <StatusBadge tone={patient.k % 2 === 0 ? 'ok' : 'warn'}>
                    {patient.k % 2 === 0 ? 'Anamnese respondida' : 'Aguardando preenchimento'}
                  </StatusBadge>
                </div>

                <div className="grid sm:grid-cols-2 gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block">
                      Queixa / Objetivo principal
                    </span>
                    <strong className="text-xs">
                      {patient.k % 3 === 0
                        ? 'Ansiedade e qualidade do sono'
                        : patient.k % 3 === 1
                          ? 'Dor crônica e relaxamento muscular'
                          : 'Controle de estresse e foco'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block">
                      Uso prévio de Cannabis medicinal
                    </span>
                    <strong className="text-xs">
                      {patient.tipo === 'Recorrência' ? 'Sim · Em acompanhamento' : 'Não · Primeira avaliação'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block">
                      Alergias conhecidas
                    </span>
                    <strong className="text-xs">Nenhuma referida no cadastro</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block">
                      Medicações de uso contínuo
                    </span>
                    <strong className="text-xs">Informadas no prontuário para avaliação médica</strong>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleForwardAnamnese('primeira')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-3.5 py-2 font-semibold"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Enviar primeira anamnese
                  </button>
                  <button
                    type="button"
                    onClick={() => handleForwardAnamnese('recorrencia')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-3.5 py-2 font-semibold hover:border-[var(--accent)]"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Enviar anamnese de recorrência
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(links.anamnese, onToast, 'Link da anamnese copiado.')
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-3.5 py-2 font-semibold hover:border-[var(--accent)]"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar link
                  </button>
                </div>
              </div>
            )}

            {/* ENTREGAS TAB */}
            {tab === 'entregas' && (
              <div className="space-y-3">
                {patient.hist.entregas.length ? (
                  patient.hist.entregas.map((e) => (
                    <div
                      key={e.pedido}
                      className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold">Pedido {e.pedido}</h3>
                        <StatusBadge
                          tone={
                            e.status === 'Entregue'
                              ? 'ok'
                              : e.status === 'Em transporte'
                                ? 'info'
                                : 'warn'
                          }
                        >
                          {e.status}
                        </StatusBadge>
                      </div>
                      <p>
                        <span className="text-[var(--muted)]">Data da compra:</span> {e.data}
                      </p>
                      <p>
                        <span className="text-[var(--muted)]">Itens:</span> {e.itens}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">
                    Este paciente ainda não comprou. Nenhuma entrega registrada.
                  </div>
                )}
              </div>
            )}

            {/* LINKS TAB */}
            {tab === 'links' && (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3 text-xs">
                <h3 className="text-base font-bold">Links da consulta · {patient.proc}</h3>
                <div className="space-y-2">
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <strong className="block">Link de consulta (paciente)</strong>
                      <span className="font-mono-num text-[var(--muted)] break-all">
                        {links.consulta}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleForwardLink('consulta')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] px-3 py-1.5 font-semibold shrink-0"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Encaminhar no chat
                    </button>
                  </div>
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <strong className="block">Link de convidado (acompanhante)</strong>
                      <span className="font-mono-num text-[var(--muted)] break-all">
                        {links.convidado}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleForwardLink('convidado')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] px-3 py-1.5 font-semibold shrink-0"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Encaminhar no chat
                    </button>
                  </div>
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <strong className="block">Link do médico</strong>
                      <span className="font-mono-num text-[var(--muted)] break-all">
                        {links.medico}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(links.medico, onToast, 'Link do médico copiado.')
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 font-semibold shrink-0"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* FINANCEIRO / NOTA FISCAL TAB */}
            {tab === 'financeiro' && (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold">Nota fiscal · {links.nfNumero}</h3>
                  <StatusBadge tone="ok">Emitida</StatusBadge>
                </div>
                <p className="text-[var(--muted)]">
                  Referente à consulta de {patient.data.replaceAll('-', '/')} às {patient.hora} com{' '}
                  <strong className="text-[var(--ink)]">{patient.medico}</strong>.
                </p>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono-num">{links.nfLink}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(links.nfLink, onToast, 'Link da Nota Fiscal copiado.')
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 font-semibold"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar NF
                    </button>
                    <button
                      type="button"
                      onClick={handleForwardInvoice}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] px-3 py-1.5 font-semibold"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Encaminhar no chat
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
