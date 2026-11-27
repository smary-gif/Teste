import React, { useEffect, useState } from 'react';
import {
  Bell,
  BellOff,
  CheckCircle2,
  ChevronDown,
  Copy,
  Delete,
  GripHorizontal,
  Headphones,
  History,
  MessageSquare,
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneOff,
  Plus,
  User,
  Users,
  X,
} from 'lucide-react';
import type { PatientCase } from '../types';
import { initials, nowTime, pad } from '../utils/helpers';

export interface CallLogEntry {
  id: string;
  patientId?: string;
  patientName: string;
  phone: string;
  outcome: 'Em andamento' | 'Atendeu' | 'Sem resposta' | 'Cancelada';
  durationSecs: number;
  time: string;
}

interface PhoneDialerOverlayProps {
  pendingCallPatient: PatientCase | null;
  dialerOpen: boolean;
  dialerPatient: PatientCase | null;
  attendantName: string;
  onCancelConfirm: () => void;
  onConfirmCall: (patient: PatientCase) => void;
  onCloseDialer: () => void;
  onOpenPatientChat?: (patientId: string) => void;
  onOpenNegotiation?: (patientId: string) => void;
  onLogCallResult?: (
    patient: PatientCase,
    outcome: 'Atendeu' | 'Sem resposta',
    durationSecs: number
  ) => void;
  onToast: (msg: string) => void;
}

const DIALPAD_KEYS: Array<{ main: string; sub?: string }> = [
  { main: '1' },
  { main: '2', sub: 'ABC' },
  { main: '3', sub: 'DEF' },
  { main: '4', sub: 'GHI' },
  { main: '5', sub: 'JKL' },
  { main: '6', sub: 'MNO' },
  { main: '7', sub: 'PQRS' },
  { main: '8', sub: 'TUV' },
  { main: '9', sub: 'WXYZ' },
  { main: '*' },
  { main: '0', sub: '+' },
  { main: '#' },
];

const CALLER_NUMBERS = [
  '+55 11 91379-1705',
  '+55 11 98420-3100',
  '+55 21 97110-4402',
];

function sanitizeDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

export function PhoneDialerOverlay({
  pendingCallPatient,
  dialerOpen,
  dialerPatient,
  attendantName,
  onCancelConfirm,
  onConfirmCall,
  onCloseDialer,
  onOpenPatientChat,
  onOpenNegotiation,
  onLogCallResult,
  onToast,
}: PhoneDialerOverlayProps) {
  const [callerLine, setCallerLine] = useState(CALLER_NUMBERS[0]);
  const [onlineStatus, setOnlineStatus] = useState<'Online' | 'Ocupado' | 'Pausa'>('Online');
  const [micReady, setMicReady] = useState(true);
  const [alertsMuted, setAlertsMuted] = useState(false);
  const [dialDigits, setDialDigits] = useState('');
  const [callState, setCallState] = useState<'idle' | 'calling' | 'connected'>('idle');
  const [callSecs, setCallSecs] = useState(0);
  const [mutedMic, setMutedMic] = useState(false);
  const [bottomTab, setBottomTab] = useState<'pad' | 'history' | 'contacts'>('pad');
  const [history, setHistory] = useState<CallLogEntry[]>([]);

  useEffect(() => {
    if (dialerOpen && dialerPatient) {
      setDialDigits(sanitizeDigits(dialerPatient.tel));
      setCallState('calling');
      setCallSecs(0);
      setBottomTab('pad');
    } else if (!dialerOpen) {
      setCallState('idle');
      setCallSecs(0);
      setMutedMic(false);
    }
  }, [dialerOpen, dialerPatient]);

  // Simulate ringing -> connected after 2.2s and increment call timer
  useEffect(() => {
    if (!dialerOpen || callState === 'idle') return;
    if (callState === 'calling') {
      const connectTimer = window.setTimeout(() => {
        setCallState('connected');
      }, 2000);
      return () => window.clearTimeout(connectTimer);
    }
    const tick = window.setInterval(() => {
      setCallSecs((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(tick);
  }, [dialerOpen, callState]);

  const finishCall = (outcome: 'Atendeu' | 'Sem resposta') => {
    const entry: CallLogEntry = {
      id: `call_${Date.now()}`,
      patientId: dialerPatient?.id,
      patientName: dialerPatient?.nome || dialDigits || 'Contato avulso',
      phone: dialDigits || dialerPatient?.tel || '—',
      outcome,
      durationSecs: callSecs,
      time: nowTime(),
    };
    setHistory((prev) => [entry, ...prev].slice(0, 20));
    setCallState('idle');
    if (dialerPatient) {
      onLogCallResult?.(dialerPatient, outcome, callSecs);
    } else {
      onToast(
        outcome === 'Atendeu'
          ? `Ligação concluída (${entry.phone}).`
          : `Tentativa sem resposta registrada para ${entry.phone}.`
      );
    }
  };

  const handleCopyNumber = () => {
    const num = dialDigits || (dialerPatient ? sanitizeDigits(dialerPatient.tel) : '');
    if (!num) return;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(num);
    }
    onToast(`Número ${num} copiado.`);
  };

  const localTimeStr = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <>
      {/* PASSO 1: Modal "Deseja ligar para o paciente?" (image_082f079c.png) */}
      {pendingCallPatient && (
        <div
          className="fixed inset-0 z-[70] bg-black/45 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Deseja ligar para o paciente?"
          onClick={(e) => {
            if (e.target === e.currentTarget) onCancelConfirm();
          }}
        >
          <div className="w-full max-w-[490px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h2 className="text-lg font-bold text-[var(--ink)]">
                Deseja ligar para o paciente?
              </h2>
              <button
                type="button"
                onClick={onCancelConfirm}
                aria-label="Fechar confirmação de ligação"
                className="h-7 w-7 rounded-lg grid place-items-center text-[var(--muted)] hover:bg-[var(--surface-2)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 py-1">
              <div className="flex items-center gap-3">
                <span className="h-11 w-11 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-bold text-base grid place-items-center shrink-0">
                  {attendantName.trim().charAt(0).toUpperCase() || 'S'}
                </span>
                <div>
                  <strong className="text-base block leading-tight text-[var(--ink)]">
                    {attendantName}
                  </strong>
                  <span className="text-xs text-[var(--muted)]">Atendente responsável</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pl-5">
                <div className="w-5 h-7 border-l-2 border-b-2 border-[var(--line)] rounded-bl-lg shrink-0 -mt-3" />
                <span className="h-9 w-9 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-bold text-xs grid place-items-center shrink-0">
                  {initials(pendingCallPatient.nome)}
                </span>
                <div className="min-w-0">
                  <strong className="text-sm block truncate text-[var(--ink)]">
                    {pendingCallPatient.nome}
                  </strong>
                  <span className="text-xs text-[var(--muted)] font-mono-num">
                    Paciente · {pendingCallPatient.tel}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={onCancelConfirm}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                <PhoneOff className="h-4 w-4" />
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => onConfirmCall(pendingCallPatient)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F4B2C] text-white px-4 py-2.5 text-sm font-semibold hover:brightness-110 transition-colors"
              >
                <Phone className="h-4 w-4" />
                Confirmar chamada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASSO 2: Softphone / Discador (image_6bb85166.png) */}
      {dialerOpen && (
        <aside
          aria-label="Discador telefônico"
          className="fixed right-4 bottom-4 z-[75] w-[335px] max-w-[calc(100vw-24px)] rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Top drag handle + close */}
          <div className="flex items-center justify-between px-3 py-2 bg-[var(--surface)] border-b border-[var(--line)]">
            <span className="w-6" />
            <GripHorizontal className="h-4 w-4 text-[var(--muted)]" />
            <button
              type="button"
              onClick={onCloseDialer}
              aria-label="Fechar discador"
              className="h-7 w-7 rounded-full border border-[var(--line)] grid place-items-center text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Dark status bar ("Faltam algumas permissões" / "Microfone ativo") */}
          <div className="bg-[#232528] text-white px-3.5 py-2 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setMicReady((v) => !v);
                onToast(
                  micReady
                    ? 'Permissões de áudio simuladas como pendentes.'
                    : 'Permissões de áudio liberadas para chamada.'
                );
              }}
              className="font-semibold hover:underline text-left"
            >
              {micReady ? 'Áudio pronto · Microfone liberado' : 'Faltam algumas permissões'}
            </button>
            <button
              type="button"
              onClick={() => setAlertsMuted((m) => !m)}
              title={alertsMuted ? 'Ativar toque' : 'Silenciar campainha'}
              className="text-rose-400 hover:text-rose-300"
            >
              {alertsMuted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4 text-emerald-400" />}
            </button>
          </div>

          {/* Line selector & Online status */}
          <div className="px-4 pt-3 pb-2 bg-[var(--surface-2)] border-b border-[var(--line)] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="relative inline-flex items-center">
                <Headphones className="h-5 w-5 text-[var(--muted)]" />
                <span className="absolute -top-1 -right-1.5 h-3.5 w-3.5 rounded-full bg-emerald-600 text-white text-[9px] grid place-items-center font-bold">
                  ✓
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setOnlineStatus((s) =>
                    s === 'Online' ? 'Ocupado' : s === 'Ocupado' ? 'Pausa' : 'Online'
                  )
                }
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold text-white ${
                  onlineStatus === 'Online'
                    ? 'bg-emerald-600'
                    : onlineStatus === 'Ocupado'
                      ? 'bg-amber-600'
                      : 'bg-slate-600'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-white" />
                {onlineStatus}
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>

            <div className="text-center space-y-1">
              <p className="text-[11px] text-[var(--muted)]">O número que estou a usar</p>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] border border-[var(--line)] px-3 py-1 text-xs font-semibold">
                <span aria-hidden="true">🇧🇷</span>
                <select
                  value={callerLine}
                  onChange={(e) => setCallerLine(e.target.value)}
                  aria-label="Número de saída"
                  className="bg-transparent font-semibold focus:outline-none"
                >
                  {CALLER_NUMBERS.map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-[var(--muted)] font-mono-num">
                Hora local: {localTimeStr} (BRT)
              </p>
            </div>

            {/* Active Call Banner */}
            {callState !== 'idle' && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 text-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="block truncate text-emerald-900 dark:text-emerald-200">
                      {dialerPatient ? dialerPatient.nome : dialDigits || 'Chamada'}
                    </strong>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono-num">
                      {callState === 'calling'
                        ? 'Chamando paciente...'
                        : `Em chamada · ${pad(Math.floor(callSecs / 60))}:${pad(callSecs % 60)}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMutedMic((m) => !m)}
                    title={mutedMic ? 'Ativar microfone' : 'Silenciar microfone'}
                    className={`h-7 w-7 rounded-lg grid place-items-center border ${
                      mutedMic
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border-emerald-300'
                    }`}
                  >
                    {mutedMic ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => finishCall('Atendeu')}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-700 text-white px-2 py-1.5 text-[11px] font-semibold"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Atendeu
                  </button>
                  <button
                    type="button"
                    onClick={() => finishCall('Sem resposta')}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-rose-600 text-white px-2 py-1.5 text-[11px] font-semibold"
                  >
                    <PhoneOff className="h-3 w-3" />
                    Sem resposta
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Center area: Dialpad OR History OR Patient actions */}
          <div className="p-4 bg-[var(--surface)] space-y-3">
            {bottomTab === 'pad' && (
              <>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setDialDigits((d) => (d.startsWith('+') ? d : `+${d}`))}
                    aria-label="Adicionar prefixo +"
                    className="h-9 w-9 rounded-full bg-[var(--surface-2)] border border-[var(--line)] grid place-items-center text-[var(--muted)] hover:text-[var(--ink)]"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <span className="font-mono-num text-sm font-bold text-[var(--ink)] tracking-wide">
                    {dialDigits || 'Digite o número'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDialDigits((d) => d.slice(0, -1))}
                    aria-label="Apagar dígito"
                    className="h-9 w-9 rounded-full hover:bg-[var(--surface-2)] grid place-items-center text-[var(--muted)]"
                  >
                    <Delete className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-y-2 gap-x-4 text-center py-1">
                  {DIALPAD_KEYS.map((k) => (
                    <button
                      key={k.main}
                      type="button"
                      onClick={() => setDialDigits((d) => `${d}${k.main}`)}
                      className="rounded-xl py-1.5 hover:bg-[var(--surface-2)] transition-colors flex flex-col items-center justify-center"
                    >
                      <span className="text-lg font-semibold leading-tight text-[var(--ink)]">
                        {k.main}
                      </span>
                      {k.sub && (
                        <span className="text-[9px] font-bold tracking-widest text-[var(--muted)]">
                          {k.sub}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            {bottomTab === 'history' && (
              <div className="space-y-2 max-h-[230px] overflow-y-auto">
                <strong className="text-xs block">Histórico de chamadas recentes</strong>
                {history.length ? (
                  history.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-2.5 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <strong className="block truncate">{item.patientName}</strong>
                        <span className="text-[11px] text-[var(--muted)] font-mono-num">
                          {item.phone} · {item.time}
                        </span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                          item.outcome === 'Atendeu'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {item.outcome}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[var(--muted)] text-center py-8">
                    Nenhuma chamada encerrada ainda nesta sessão.
                  </p>
                )}
              </div>
            )}

            {bottomTab === 'contacts' && (
              <div className="space-y-2 text-xs">
                <strong className="block">Contato ativo</strong>
                {dialerPatient ? (
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 space-y-2">
                    <div>
                      <strong className="block text-sm">{dialerPatient.nome}</strong>
                      <span className="text-[var(--muted)] font-mono-num">
                        {dialerPatient.proc} · {dialerPatient.tel}
                      </span>
                    </div>
                    <p className="text-[var(--muted)]">
                      Médico: <strong className="text-[var(--ink)]">{dialerPatient.medico}</strong>
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {onOpenPatientChat && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenPatientChat(dialerPatient.id);
                            onCloseDialer();
                          }}
                          className="rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] px-2.5 py-1.5 font-semibold"
                        >
                          Abrir Chat
                        </button>
                      )}
                      {onOpenNegotiation && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenNegotiation(dialerPatient.id);
                          }}
                          className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 font-semibold"
                        >
                          Abrir Negociação
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-[var(--muted)] py-6 text-center">
                    Selecione um paciente para visualizar os detalhes aqui.
                  </p>
                )}
              </div>
            )}

            {/* Green round Call / Red Hangup button + bottom icons */}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setBottomTab('history')}
                title="Histórico de ligações"
                className={`h-8 w-8 rounded-lg grid place-items-center ${
                  bottomTab === 'history'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <History className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setBottomTab('contacts')}
                title="Detalhes do contato"
                className={`h-8 w-8 rounded-lg grid place-items-center ${
                  bottomTab === 'contacts'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <Users className="h-4 w-4" />
              </button>

              {callState === 'idle' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!dialDigits) {
                      onToast('Digite ou selecione um número para iniciar a ligação.');
                      return;
                    }
                    setCallSecs(0);
                    setCallState('calling');
                  }}
                  aria-label="Iniciar chamada"
                  className="h-12 w-12 rounded-full bg-emerald-500 text-white grid place-items-center shadow-lg hover:bg-emerald-600 transition-colors"
                >
                  <PhoneCall className="h-5 w-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => finishCall('Sem resposta')}
                  aria-label="Encerrar chamada"
                  className="h-12 w-12 rounded-full bg-rose-600 text-white grid place-items-center shadow-lg hover:bg-rose-700 transition-colors"
                >
                  <PhoneOff className="h-5 w-5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (dialerPatient && onOpenPatientChat) {
                    onOpenPatientChat(dialerPatient.id);
                  } else {
                    setBottomTab('pad');
                  }
                }}
                title={dialerPatient ? 'Ir ao chat do paciente' : 'Teclado'}
                className="h-8 w-8 rounded-lg grid place-items-center text-[var(--muted)] hover:text-[var(--accent)]"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (dialerPatient && onOpenNegotiation) {
                    onOpenNegotiation(dialerPatient.id);
                  } else {
                    setBottomTab('contacts');
                  }
                }}
                title={dialerPatient ? 'Abrir Negociação' : 'Perfil'}
                className="h-8 w-8 rounded-lg grid place-items-center text-[var(--muted)] hover:text-[var(--accent)]"
              >
                <User className="h-4 w-4" />
              </button>
            </div>

            {/* Bottom input + Copiar matching image_6bb85166.png */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={dialDigits}
                onChange={(e) => setDialDigits(e.target.value.replace(/[^\d+*#]/g, ''))}
                aria-label="Número de telefone selecionado"
                className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs font-mono-num focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={handleCopyNumber}
                className="inline-flex items-center gap-1 rounded-xl bg-[#1F4B2C] text-white px-3.5 py-2 text-xs font-semibold hover:brightness-110 shrink-0"
              >
                <Copy className="h-3 w-3" />
                Copiar
              </button>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
