import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  Copy,
  FileText,
  History,
  Link2,
  Lock,
  Receipt,
  Send,
  ShieldCheck,
  UserCog,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { MEDS } from '../data/defaults';
import type { ConsultationRow } from '../types';
import { getTodayMeta, norm, pad } from '../utils/helpers';
import { getConsultationTone, StatusBadge } from './StatusBadge';

export interface ChatTargetOption {
  id: string;
  nome: string;
  proc: string;
  dept: string;
  medico: string;
  data: string;
  hora: string;
}

const ALL_TIME_SLOTS = [
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
];

const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export interface AvailableDaySlot {
  dateKey: string;
  dataBr: string;
  shortDate: string;
  weekday: string;
  tag?: string;
  slots: string[];
  busySlots: string[];
}

export function getDoctorSlotsForDate(
  medico: string,
  dateKey: string
): { slots: string[]; busySlots: string[]; isOffDay: boolean } {
  const medIdx = Math.max(0, MEDS.indexOf(medico));
  const seed = medico.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) + medIdx * 7;
  const parts = dateKey.split('-').map(Number);
  const d =
    parts.length === 3
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : new Date();
  const dow = d.getDay();
  const dayNum = d.getDate() + d.getMonth() * 31;
  const { todayKey } = getTodayMeta();
  const isToday = dateKey === todayKey;

  // Today always has open slots; Sundays off for future dates
  const isOffDay = !isToday && (dow === 0 || (dow === 6 && medIdx % 2 === 1));
  if (isOffDay) {
    return { slots: [], busySlots: ALL_TIME_SLOTS, isOffDay: true };
  }

  const slots: string[] = [];
  const busySlots: string[] = [];
  ALL_TIME_SLOTS.forEach((slot, idx) => {
    const hash = (seed + dayNum * 13 + idx * 5) % 7;
    if (hash === 0 || hash === 3) {
      busySlots.push(slot);
    } else {
      slots.push(slot);
    }
  });
  return { slots, busySlots, isOffDay: false };
}

export function getDoctorAvailableDays(medico: string, totalDays = 10): AvailableDaySlot[] {
  const base = new Date();
  const result: AvailableDaySlot[] = [];

  for (let offset = 0; offset < totalDays; offset++) {
    const d = new Date(base);
    d.setDate(base.getDate() + offset);
    const dow = d.getDay();
    const dateKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const dataBr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const shortDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
    const weekday = WEEKDAYS_PT[dow];
    const tag = offset === 0 ? 'Hoje' : offset === 1 ? 'Amanhã' : undefined;
    const { slots, busySlots } = getDoctorSlotsForDate(medico, dateKey);

    result.push({
      dateKey,
      dataBr,
      shortDate,
      weekday,
      tag,
      slots,
      busySlots,
    });
  }

  return result;
}

export function DoctorSchedulePicker({
  medico,
  currentMedico,
  dateKey,
  hora,
  onChangeMedico,
  onChangeDateKey,
  onChangeHora,
  onRequestLeadership,
  onAuthChange,
}: {
  medico: string;
  currentMedico: string;
  dateKey: string;
  hora: string;
  onChangeMedico: (med: string) => void;
  onChangeDateKey: (dk: string) => void;
  onChangeHora: (h: string) => void;
  onRequestLeadership?: (info: {
    medico: string;
    dateKey: string;
    dataBr: string;
    motivo: string;
  }) => void;
  onAuthChange?: (authorized: boolean) => void;
}) {
  const { today, todayKey, todaySl } = getTodayMeta();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowKey = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

  const [mode, setMode] = useState<'hoje' | 'outro_dia'>(() =>
    dateKey === todayKey ? 'hoje' : 'outro_dia'
  );
  const [futureAuthMode, setFutureAuthMode] = useState<
    'none' | 'lideranca_solicitada' | 'data_especifica'
  >('none');
  const [leaderReason, setLeaderReason] = useState(
    'Paciente precisa reagendar para outro dia e solicitou abertura de agenda'
  );

  const medOptions = MEDS.includes(currentMedico) ? MEDS : [currentMedico, ...MEDS];
  const activeDateKey = mode === 'hoje' ? todayKey : dateKey === todayKey ? tomorrowKey : dateKey;
  const slotInfo = useMemo(
    () => getDoctorSlotsForDate(medico, activeDateKey),
    [medico, activeDateKey]
  );

  const quickFutureDays = useMemo(() => {
    const arr: Array<{ key: string; label: string }> = [];
    for (let off = 1; off <= 5; off++) {
      const d = new Date(today);
      d.setDate(today.getDate() + off);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const label =
        off === 1
          ? `Amanhã (${pad(d.getDate())}/${pad(d.getMonth() + 1)})`
          : `${WEEKDAYS_PT[d.getDay()]} (${pad(d.getDate())}/${pad(d.getMonth() + 1)})`;
      arr.push({ key, label });
    }
    return arr;
  }, [today]);

  const handleSelectDoctor = (nextMed: string) => {
    onChangeMedico(nextMed);
    const nextSlots = getDoctorSlotsForDate(nextMed, activeDateKey).slots;
    if (nextSlots.length > 0 && !nextSlots.includes(hora)) {
      onChangeHora(nextSlots[0]);
    }
  };

  const handleSwitchMode = (nextMode: 'hoje' | 'outro_dia') => {
    setMode(nextMode);
    if (nextMode === 'hoje') {
      onChangeDateKey(todayKey);
      const todaySlots = getDoctorSlotsForDate(medico, todayKey).slots;
      if (todaySlots.length > 0 && !todaySlots.includes(hora)) {
        onChangeHora(todaySlots[0]);
      }
    } else {
      const targetKey = dateKey === todayKey ? tomorrowKey : dateKey;
      onChangeDateKey(targetKey);
      const nextSlots = getDoctorSlotsForDate(medico, targetKey).slots;
      if (nextSlots.length > 0 && !nextSlots.includes(hora)) {
        onChangeHora(nextSlots[0]);
      }
    }
  };

  const canShowFutureSlots =
    mode === 'hoje' || futureAuthMode === 'lideranca_solicitada' || futureAuthMode === 'data_especifica';

  useEffect(() => {
    onAuthChange?.(canShowFutureSlots);
  }, [canShowFutureSlots, onAuthChange]);

  return (
    <div className="space-y-3.5 text-xs">
      {/* Regra operacional */}
      <div className="rounded-xl border border-[#8d5207]/30 bg-[#fbecd2]/65 dark:bg-[#3a2a10]/50 px-3 py-2.5 flex items-start gap-2 text-[#7a4504] dark:text-[#f0b354]">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Regra da agenda médica:</strong> a agenda do médico abre{' '}
          <strong>somente no dia (Hoje)</strong>. Para reagendar para outro dia, envie uma{' '}
          <strong>solicitação de abertura à Liderança</strong> (Katlen Pfeifer / Stephanye / Iris) ou
          utilize uma <strong>data específica</strong> com liberação.
        </p>
      </div>

      {/* 1. Médico */}
      <div className="space-y-1.5">
        <label htmlFor="picker-medico" className="block font-bold text-[var(--ink)]">
          1. Médico responsável (mantenha ou altere para ver os horários)
        </label>
        <select
          id="picker-medico"
          value={medico}
          onChange={(e) => handleSelectDoctor(e.target.value)}
          className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
        >
          {medOptions.map((m) => (
            <option key={m} value={m}>
              {m}
              {m === currentMedico ? ' (Médico atual)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Escolha: Agenda de Hoje OU Outro dia (Liderança / Data específica) */}
      <div className="space-y-2">
        <span className="block font-bold text-[var(--ink)]">
          2. Escolher dia da consulta
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleSwitchMode('hoje')}
            className={`rounded-xl border p-3 text-left transition-colors ${
              mode === 'hoje'
                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                : 'border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--accent)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <strong className="text-[var(--ink)]">Agenda de Hoje ({todaySl})</strong>
              <StatusBadge tone="ok">Aberta</StatusBadge>
            </div>
            <span className="text-[11px] text-[var(--muted)] block mt-1">
              Horários liberados no dia para {medico}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchMode('outro_dia')}
            className={`rounded-xl border p-3 text-left transition-colors ${
              mode === 'outro_dia'
                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                : 'border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--accent)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <strong className="text-[var(--ink)]">Outro dia / Data específica</strong>
              <StatusBadge tone={futureAuthMode === 'none' ? 'warn' : 'info'}>
                {futureAuthMode === 'none' ? 'Requer solicitação' : 'Liberado'}
              </StatusBadge>
            </div>
            <span className="text-[11px] text-[var(--muted)] block mt-1">
              Solicitar abertura à liderança ou usar data específica
            </span>
          </button>
        </div>

        {mode === 'outro_dia' && (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-[var(--ink)]">Escolha a data específica desejada</span>
              <input
                type="date"
                min={tomorrowKey}
                value={activeDateKey}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  onChangeDateKey(val);
                  const nextSlots = getDoctorSlotsForDate(medico, val).slots;
                  if (nextSlots.length > 0 && !nextSlots.includes(hora)) {
                    onChangeHora(nextSlots[0]);
                  }
                }}
                aria-label="Data específica para reagendamento"
                className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-mono-num text-[var(--ink)]"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {quickFutureDays.map((fd) => (
                <button
                  key={fd.key}
                  type="button"
                  onClick={() => {
                    onChangeDateKey(fd.key);
                    const nextSlots = getDoctorSlotsForDate(medico, fd.key).slots;
                    if (nextSlots.length > 0 && !nextSlots.includes(hora)) {
                      onChangeHora(nextSlots[0]);
                    }
                  }}
                  className={`rounded-lg border px-2.5 py-1 font-semibold whitespace-nowrap ${
                    activeDateKey === fd.key
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
                      : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]'
                  }`}
                >
                  {fd.label}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-[var(--ink)]">
                {futureAuthMode === 'none' ? (
                  <Lock className="h-3.5 w-3.5 text-[#c47a1c]" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
                )}
                <span>
                  {futureAuthMode === 'lideranca_solicitada'
                    ? `Solicitação enviada à Liderança para ${formatDateKeyToBr(activeDateKey)} (horários liberados no treino)`
                    : futureAuthMode === 'data_especifica'
                      ? `Modo Data Específica liberada para ${formatDateKeyToBr(activeDateKey)}`
                      : `Agenda de ${formatDateKeyToBr(activeDateKey)} fechada por padrão`}
                </span>
              </div>

              <input
                type="text"
                value={leaderReason}
                onChange={(e) => setLeaderReason(e.target.value)}
                placeholder="Motivo para a liderança..."
                aria-label="Motivo da solicitação para liderança"
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFutureAuthMode('lideranca_solicitada');
                    onRequestLeadership?.({
                      medico,
                      dateKey: activeDateKey,
                      dataBr: formatDateKeyToBr(activeDateKey),
                      motivo: leaderReason.trim() || 'Solicitação de abertura de agenda',
                    });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] px-3 py-1.5 font-semibold hover:brightness-105"
                >
                  <Send className="h-3.5 w-3.5" />
                  Solicitar abertura à Liderança
                </button>

                <button
                  type="button"
                  onClick={() => setFutureAuthMode('data_especifica')}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold ${
                    futureAuthMode === 'data_especifica'
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--accent)]'
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Usar data específica liberada
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Horários disponíveis */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-[var(--ink)]">
            3. Horários disponíveis em {formatDateKeyToBr(activeDateKey)} ({medico})
          </span>
          <span className="font-mono-num text-[var(--accent)] font-bold">
            Selecionado: {hora}
          </span>
        </div>

        {!canShowFutureSlots ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-2)] p-3.5 text-center text-[var(--muted)]">
            Clique em <strong>"Solicitar abertura à Liderança"</strong> ou{' '}
            <strong>"Usar data específica liberada"</strong> acima para visualizar e escolher os
            horários deste dia.
          </div>
        ) : slotInfo.slots.length > 0 ? (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
            {slotInfo.slots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => onChangeHora(slot)}
                className={`rounded-lg border py-1.5 font-mono-num font-semibold transition-colors ${
                  hora === slot
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
                    : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] hover:border-[var(--accent)]'
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-[var(--line)] p-3 text-center text-[var(--muted)]">
            Sem horários padrão neste dia (folga/domingo). Escolha outra data ou defina um encaixe manual abaixo.
          </p>
        )}

        {canShowFutureSlots && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--muted)] whitespace-nowrap">
              Horário manual / encaixe:
            </span>
            <input
              type="time"
              value={hora}
              onChange={(e) => onChangeHora(e.target.value)}
              required
              aria-label="Horário personalizado"
              className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-mono-num text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function formatDateKeyToBr(dateKey: string): string {
  const parts = dateKey.split('-');
  if (parts.length !== 3) return dateKey;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function buildConsultationLinks(proc: string) {
  const slug = proc.replace('#', '').toLowerCase() || '00101';
  const code = slug.toUpperCase();
  return {
    consulta: `https://sala.clickcannabis.com/consulta/${slug}`,
    convidado: `https://sala.clickcannabis.com/convidado/${slug}?perfil=convidado`,
    medico: `https://sala.clickcannabis.com/medico/${slug}`,
    anamnese: `https://app.clickcannabis.com/anamnese/${slug}`,
    nfMedicoNumero: `NF-MED-2026-${code}`,
    nfMedicoLink: `https://nfse.clickcannabis.com/nota/NF-MED-2026-${slug}`,
    nfClickNumero: `NF-CLK-2026-${code}`,
    nfClickLink: `https://nfse.clickcannabis.com/nota/NF-CLK-2026-${slug}`,
    nfLink: `https://nfse.clickcannabis.com/nota/NF-MED-2026-${slug}`,
    nfNumero: `NF-MED-2026-${code}`,
  };
}

function resolveDefaultChatId(
  row: ConsultationRow,
  chatTargets: ChatTargetOption[]
): string {
  if (row.pid && chatTargets.some((c) => c.id === row.pid)) return row.pid;
  const sameProc = chatTargets.find((c) => c.proc === row.proc);
  if (sameProc) return sameProc.id;
  const reag = chatTargets.find((c) => c.id.startsWith('reagendamento'));
  return reag?.id || chatTargets[0]?.id || '';
}

function copyText(text: string, onToast: (msg: string) => void, successMsg: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => onToast(successMsg))
      .catch(() => onToast(successMsg));
  } else {
    onToast(successMsg);
  }
}

/* ---------------- 1. REAGENDAR CONSULTA ---------------- */
export function ReagendarModal({
  row,
  chatTargets,
  onClose,
  onConfirm,
  onRequestLeadership,
}: {
  row: ConsultationRow;
  chatTargets: ChatTargetOption[];
  onClose: () => void;
  onConfirm: (payload: {
    dateKey: string;
    dataBr: string;
    hora: string;
    medico: string;
    regra: string;
    obs: string;
    sendToChat: boolean;
    targetChatId: string;
  }) => void;
  onRequestLeadership?: (info: {
    medico: string;
    dateKey: string;
    dataBr: string;
    motivo: string;
  }) => void;
}) {
  const { todayKey } = getTodayMeta();
  const [medico, setMedico] = useState(
    MEDS.includes(row.medico) ? row.medico : MEDS[0]
  );
  const [dateKey, setDateKey] = useState(todayKey);
  const initialSlots = useMemo(() => getDoctorSlotsForDate(medico, todayKey).slots, [medico, todayKey]);
  const [hora, setHora] = useState(() =>
    initialSlots.includes(row.hora) ? row.hora : initialSlots[0] || row.hora || '14:00'
  );
  const [regra, setRegra] = useState('Aviso prévio ≥ 2h (sem custo adicional)');
  const [obs, setObs] = useState('');
  const [sendToChat, setSendToChat] = useState(Boolean(row.pid || chatTargets.length));
  const [targetChatId, setTargetChatId] = useState(() =>
    resolveDefaultChatId(row, chatTargets)
  );
  const [scheduleAuthorized, setScheduleAuthorized] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateKey || !hora || !scheduleAuthorized) return;
    onConfirm({
      dateKey,
      dataBr: formatDateKeyToBr(dateKey),
      hora,
      medico,
      regra,
      obs: obs.trim(),
      sendToChat: sendToChat && Boolean(targetChatId),
      targetChatId,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[rgba(6,20,12,0.52)] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Reagendar consulta de ${row.nome}`}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl w-full max-w-[660px] max-h-[calc(100vh-32px)] flex flex-col overflow-hidden shadow-2xl"
      >
        <div className="px-5 py-3.5 border-b border-[var(--line)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center shrink-0">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold truncate">Reagendar consulta</h3>
              <p className="text-xs text-[var(--muted)] truncate font-mono-num">
                {row.nome} · {row.proc} · Atual: {row.dataBr} às {row.hora}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="h-8 w-8 rounded-lg border border-[var(--line)] grid place-items-center hover:border-[var(--accent)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          <DoctorSchedulePicker
            medico={medico}
            currentMedico={row.medico}
            dateKey={dateKey}
            hora={hora}
            onChangeMedico={setMedico}
            onChangeDateKey={setDateKey}
            onChangeHora={setHora}
            onRequestLeadership={onRequestLeadership}
            onAuthChange={setScheduleAuthorized}
          />

          {/* Regra / Motivo */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="reag-regra" className="block font-bold text-[var(--ink)]">
                Enquadramento (Regra 2h)
              </label>
              <select
                id="reag-regra"
                value={regra}
                onChange={(e) => setRegra(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
              >
                <option>Aviso prévio ≥ 2h (sem custo adicional)</option>
                <option>Menos de 2h / Falta (novo pagamento necessário)</option>
                <option>Remanejamento de agenda médica</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="reag-obs" className="block font-bold text-[var(--ink)]">
                Observação interna
              </label>
              <input
                id="reag-obs"
                type="text"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Ex.: Paciente solicitou horário da tarde"
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* Encaminhar no chat */}
          {chatTargets.length > 0 && (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 space-y-2">
              <label className="flex items-center gap-2 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendToChat}
                  onChange={(e) => setSendToChat(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                <span>Encaminhar confirmação de reagendamento no chat do paciente</span>
              </label>
              {sendToChat && !row.pid && (
                <select
                  value={targetChatId}
                  onChange={(e) => setTargetChatId(e.target.value)}
                  aria-label="Selecionar chat de destino"
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--ink)]"
                >
                  {chatTargets.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.nome} ({ct.dept})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-2 bg-[var(--surface)]">
          <span className="text-[11px] text-[#c47a1c] dark:text-[#f0b354] font-medium">
            {!scheduleAuthorized
              ? 'Solicite abertura à Liderança ou libere a data específica para confirmar.'
              : ''}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--line)] px-4 py-2 text-xs font-semibold hover:border-[var(--accent)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!scheduleAuthorized}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2 text-xs font-semibold hover:brightness-105 disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Check className="h-3.5 w-3.5" />
              Confirmar reagendamento
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ---------------- 2. ALTERAR MÉDICO ---------------- */
export function ChangeDoctorModal({
  row,
  chatTargets,
  onClose,
  onConfirm,
}: {
  row: ConsultationRow;
  chatTargets: ChatTargetOption[];
  onClose: () => void;
  onConfirm: (payload: {
    medico: string;
    motivo: string;
    sendToChat: boolean;
    targetChatId: string;
  }) => void;
}) {
  const [medico, setMedico] = useState(
    MEDS.find((m) => m !== row.medico) || row.medico
  );
  const [motivo, setMotivo] = useState('Ajuste de disponibilidade da agenda médica');
  const [sendToChat, setSendToChat] = useState(Boolean(row.pid));
  const [targetChatId, setTargetChatId] = useState(() =>
    resolveDefaultChatId(row, chatTargets)
  );
  const medOptions = MEDS.includes(row.medico) ? MEDS : [row.medico, ...MEDS];

  return (
    <div
      className="fixed inset-0 z-50 bg-[rgba(6,20,12,0.52)] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Alterar médico de ${row.nome}`}
    >
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl w-full max-w-[460px] overflow-hidden shadow-2xl">
        <div className="px-5 py-3.5 border-b border-[var(--line)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center shrink-0">
              <UserCog className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">Alterar médico</h3>
              <p className="text-xs text-[var(--muted)] font-mono-num">
                {row.nome} · {row.dataBr} às {row.hora}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="h-8 w-8 rounded-lg border border-[var(--line)] grid place-items-center hover:border-[var(--accent)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5 text-xs">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
            <span className="text-[var(--muted)] block">Médico atual</span>
            <strong className="text-sm">{row.medico}</strong>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="chg-doc" className="block font-bold">
              Novo médico responsável
            </label>
            <select
              id="chg-doc"
              value={medico}
              onChange={(e) => setMedico(e.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink)]"
            >
              {medOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="chg-doc-motivo" className="block font-bold">
              Motivo da alteração
            </label>
            <input
              id="chg-doc-motivo"
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink)]"
            />
          </div>

          {chatTargets.length > 0 && (
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendToChat}
                  onChange={(e) => setSendToChat(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                <span>Avisar paciente no chat sobre o novo médico</span>
              </label>
              {sendToChat && !row.pid && (
                <select
                  value={targetChatId}
                  onChange={(e) => setTargetChatId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs"
                >
                  {chatTargets.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.nome} ({ct.dept})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--line)] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--line)] px-4 py-2 text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm({
                medico,
                motivo,
                sendToChat: sendToChat && Boolean(targetChatId),
                targetChatId,
              })
            }
            className="rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2 text-xs font-semibold"
          >
            Salvar médico
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 3. ALTERAR STATUS ---------------- */
export function ChangeStatusModal({
  row,
  onClose,
  onConfirm,
}: {
  row: ConsultationRow;
  onClose: () => void;
  onConfirm: (nextStatus: string) => void;
}) {
  const [status, setStatus] = useState(row.status);
  const options = [
    'Confirmada',
    'Pendente',
    'Reagendada',
    'Realizada',
    'Não realizada',
    'Cancelada',
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-[rgba(6,20,12,0.52)] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Alterar status da consulta de ${row.nome}`}
    >
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl w-full max-w-[420px] overflow-hidden shadow-2xl">
        <div className="px-5 py-3.5 border-b border-[var(--line)] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">Alterar status da consulta</h3>
            <p className="text-xs text-[var(--muted)]">
              {row.nome} · {row.proc}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="h-8 w-8 rounded-lg border border-[var(--line)] grid place-items-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-2 text-xs">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setStatus(opt)}
              className={`w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 transition-colors ${
                status === opt
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                  : 'border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--accent)]'
              }`}
            >
              <StatusBadge tone={getConsultationTone(opt)}>{opt}</StatusBadge>
              {status === opt && <Check className="h-4 w-4 text-[var(--accent)]" />}
            </button>
          ))}
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--line)] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--line)] px-4 py-2 text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(status)}
            className="rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2 text-xs font-semibold"
          >
            Aplicar status
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 4. ENCAMINHAR LINK (CONSULTA / CONVIDADO) ---------------- */
export function ForwardLinkModal({
  row,
  kind,
  chatTargets,
  onClose,
  onToast,
  onForward,
}: {
  row: ConsultationRow;
  kind: 'consulta' | 'convidado';
  chatTargets: ChatTargetOption[];
  onClose: () => void;
  onToast: (msg: string) => void;
  onForward: (patientId: string, text: string, label: string, openChat: boolean) => void;
}) {
  const links = buildConsultationLinks(row.proc);
  const url = kind === 'consulta' ? links.consulta : links.convidado;
  const title = kind === 'consulta' ? 'Link de consulta' : 'Link de convidado';

  const defaultMessage =
    kind === 'consulta'
      ? `Olá, ${row.nome.split(' ')[0]}! Segue o link da sua consulta com ${row.medico} (${row.dataBr} às ${row.hora}):\n${url}\n\nLembre-se de autorizar câmera e microfone ao entrar.`
      : `Olá, ${row.nome.split(' ')[0]}! Segue o link de convidado/acompanhante para a consulta de ${row.dataBr} às ${row.hora} com ${row.medico}:\n${url}`;

  const [targetChatId, setTargetChatId] = useState(() =>
    resolveDefaultChatId(row, chatTargets)
  );
  const [message, setMessage] = useState(defaultMessage);

  return (
    <div
      className="fixed inset-0 z-50 bg-[rgba(6,20,12,0.52)] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} de ${row.nome}`}
    >
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl w-full max-w-[520px] overflow-hidden shadow-2xl">
        <div className="px-5 py-3.5 border-b border-[var(--line)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center shrink-0">
              {kind === 'consulta' ? (
                <Link2 className="h-4 w-4" />
              ) : (
                <Users className="h-4 w-4" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold">{title}</h3>
              <p className="text-xs text-[var(--muted)]">
                {row.nome} · {row.proc} · {row.dataBr} às {row.hora}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="h-8 w-8 rounded-lg border border-[var(--line)] grid place-items-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="space-y-1.5">
            <span className="font-bold block">URL gerada</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={url}
                className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs font-mono-num text-[var(--ink)]"
              />
              <button
                type="button"
                onClick={() => copyText(url, onToast, `${title} copiado para a área de transferência.`)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-semibold hover:border-[var(--accent)] whitespace-nowrap"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </button>
            </div>
          </div>

          {chatTargets.length > 0 && (
            <>
              <div className="space-y-1.5">
                <label htmlFor="fwd-link-chat" className="block font-bold">
                  Encaminhar no chat de
                </label>
                <select
                  id="fwd-link-chat"
                  value={targetChatId}
                  onChange={(e) => setTargetChatId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink)]"
                >
                  {chatTargets.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.nome} · {ct.dept} ({ct.proc})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="fwd-link-msg" className="block font-bold">
                  Mensagem para envio ao paciente
                </label>
                <textarea
                  id="fwd-link-msg"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 text-xs text-[var(--ink)] resize-y focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--line)] flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--line)] px-3.5 py-2 text-xs font-semibold"
          >
            Fechar
          </button>
          {targetChatId && (
            <>
              <button
                type="button"
                onClick={() => onForward(targetChatId, message, title, false)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] px-3.5 py-2 text-xs font-semibold"
              >
                <Send className="h-3.5 w-3.5" />
                Encaminhar no chat
              </button>
              <button
                type="button"
                onClick={() => onForward(targetChatId, message, title, true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-3.5 py-2 text-xs font-semibold"
              >
                <Send className="h-3.5 w-3.5" />
                Encaminhar e abrir chat
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 5. NOTA FISCAL ---------------- */
export function InvoiceModal({
  row,
  chatTargets,
  onClose,
  onToast,
  onForward,
}: {
  row: ConsultationRow;
  chatTargets: ChatTargetOption[];
  onClose: () => void;
  onToast: (msg: string) => void;
  onForward: (patientId: string, text: string, label: string, openChat: boolean) => void;
}) {
  const links = buildConsultationLinks(row.proc);
  const isFree = norm(row.tipo).includes('gratuit');
  const valorTotal = isFree ? 'R$ 0,00 (Gratuita)' : 'R$ 50,00';
  const [targetChatId, setTargetChatId] = useState(() =>
    resolveDefaultChatId(row, chatTargets)
  );
  const nfMessage = isFree
    ? `Olá, ${row.nome.split(' ')[0]}! Sua consulta com ${row.medico} foi na modalidade Gratuita (R$ 0,00), portanto não há emissão de Nota Fiscal cobrada.`
    : `Olá, ${row.nome.split(' ')[0]}! Seguem as Notas Fiscais referentes à sua ${row.tipo.toLowerCase()} com ${row.medico} (Total ${valorTotal}):\n• NF Médico (${links.nfMedicoNumero} · R$ 45,00): ${links.nfMedicoLink}\n• NF ClickCannabis (${links.nfClickNumero} · R$ 5,00): ${links.nfClickLink}`;
  const [message, setMessage] = useState(nfMessage);

  return (
    <div
      className="fixed inset-0 z-50 bg-[rgba(6,20,12,0.52)] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Nota fiscal de ${row.nome}`}
    >
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl w-full max-w-[580px] overflow-hidden shadow-2xl">
        <div className="px-5 py-3.5 border-b border-[var(--line)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center shrink-0">
              <Receipt className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                Notas Fiscais · {isFree ? 'Gratuita' : 'Médico R$ 45,00 + Click R$ 5,00'}
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Emissão fracionada padrão ClickCannabis (Médico R$ 45,00 · Click R$ 5,00)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar nota fiscal"
            className="h-8 w-8 rounded-lg border border-[var(--line)] grid place-items-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <strong className="text-sm">{row.nome}</strong>
              <StatusBadge tone={isFree ? 'neutral' : 'ok'}>
                {isFree ? 'Isenta (Gratuita)' : '2 NFS-e Emitidas'}
              </StatusBadge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div>
                <span className="text-[var(--muted)] block">Prontuário</span>
                <strong className="font-mono-num">{row.proc}</strong>
              </div>
              <div>
                <span className="text-[var(--muted)] block">Data da consulta</span>
                <strong className="font-mono-num">
                  {row.dataBr} · {row.hora}
                </strong>
              </div>
              <div>
                <span className="text-[var(--muted)] block">Profissional</span>
                <strong className="truncate block">{row.medico}</strong>
              </div>
              <div>
                <span className="text-[var(--muted)] block">Valor total</span>
                <strong className="font-mono-num text-[var(--accent)]">{valorTotal}</strong>
              </div>
            </div>

            {!isFree && (
              <div className="grid sm:grid-cols-2 gap-2.5 pt-2 border-t border-[var(--line)]">
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                      Emissão do Médico
                    </span>
                    <strong className="font-mono-num text-sm text-[var(--accent)]">
                      R$ 45,00
                    </strong>
                  </div>
                  <p className="font-mono-num text-[11px] font-bold text-[var(--ink)]">
                    {links.nfMedicoNumero}
                  </p>
                  <p className="text-[11px] text-[var(--muted)] truncate">
                    {row.medico} · Atendimento clínico
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        links.nfMedicoLink,
                        onToast,
                        `Nota Fiscal do Médico (${links.nfMedicoNumero} · R$ 45,00) copiada.`
                      )
                    }
                    className="w-full inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1.5 font-semibold hover:border-[var(--accent)]"
                  >
                    <Copy className="h-3 w-3" />
                    Copiar NF Médico (R$ 45)
                  </button>
                </div>

                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                      Emissão da ClickCannabis
                    </span>
                    <strong className="font-mono-num text-sm text-[var(--accent)]">
                      R$ 5,00
                    </strong>
                  </div>
                  <p className="font-mono-num text-[11px] font-bold text-[var(--ink)]">
                    {links.nfClickNumero}
                  </p>
                  <p className="text-[11px] text-[var(--muted)] truncate">
                    ClickCannabis · Taxa plataforma
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        links.nfClickLink,
                        onToast,
                        `Nota Fiscal da ClickCannabis (${links.nfClickNumero} · R$ 5,00) copiada.`
                      )
                    }
                    className="w-full inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1.5 font-semibold hover:border-[var(--accent)]"
                  >
                    <Copy className="h-3 w-3" />
                    Copiar NF Click (R$ 5)
                  </button>
                </div>
              </div>
            )}
          </div>

          {chatTargets.length > 0 && (
            <>
              <div className="space-y-1.5">
                <label htmlFor="nf-chat" className="block font-bold">
                  Encaminhar Nota Fiscal no chat de
                </label>
                <select
                  id="nf-chat"
                  value={targetChatId}
                  onChange={(e) => setTargetChatId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink)]"
                >
                  {chatTargets.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.nome} · {ct.dept} ({ct.proc})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="nf-msg" className="block font-bold">
                  Mensagem com a Nota Fiscal
                </label>
                <textarea
                  id="nf-msg"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 text-xs text-[var(--ink)] resize-y focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--line)] flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--line)] px-3.5 py-2 text-xs font-semibold"
          >
            Fechar
          </button>
          {targetChatId && (
            <>
              <button
                type="button"
                onClick={() => onForward(targetChatId, message, 'Nota fiscal', false)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] px-3.5 py-2 text-xs font-semibold"
              >
                <Send className="h-3.5 w-3.5" />
                Encaminhar Nota Fiscal
              </button>
              <button
                type="button"
                onClick={() => onForward(targetChatId, message, 'Nota fiscal', true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-3.5 py-2 text-xs font-semibold"
              >
                <Send className="h-3.5 w-3.5" />
                Encaminhar e abrir chat
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 6. VER HISTÓRICO ---------------- */
export function HistoryModal({
  row,
  allRows,
  onClose,
  onOpenReagendar,
  onOpenAnamnese,
}: {
  row: ConsultationRow;
  allRows: ConsultationRow[];
  onClose: () => void;
  onOpenReagendar: () => void;
  onOpenAnamnese: () => void;
}) {
  const related = allRows.filter(
    (r) => r.proc === row.proc || r.nome.toLowerCase() === row.nome.toLowerCase()
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-[rgba(6,20,12,0.52)] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Histórico de ${row.nome}`}
    >
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl w-full max-w-[540px] max-h-[calc(100vh-32px)] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-5 py-3.5 border-b border-[var(--line)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center shrink-0">
              <History className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">Histórico do paciente</h3>
              <p className="text-xs text-[var(--muted)] font-mono-num">
                {row.nome} · {row.proc}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar histórico"
            className="h-8 w-8 rounded-lg border border-[var(--line)] grid place-items-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto text-xs">
          {related.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <strong className="font-mono-num">
                  {item.dataBr} às {item.hora}
                </strong>
                <StatusBadge tone={getConsultationTone(item.status)}>
                  {item.status}
                </StatusBadge>
              </div>
              <p className="text-[var(--muted)]">
                {item.medico} · {item.tipo} · Anamnese:{' '}
                <strong className="text-[var(--ink)]">
                  {item.anamnese ? 'Preenchida' : 'Não preenchida'}
                </strong>
              </p>
            </div>
          ))}
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--line)] flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onOpenAnamnese}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-3.5 py-2 text-xs font-semibold hover:border-[var(--accent)]"
          >
            <FileText className="h-3.5 w-3.5" />
            Ver anamnese
          </button>
          <button
            type="button"
            onClick={onOpenReagendar}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-3.5 py-2 text-xs font-semibold"
          >
            <Calendar className="h-3.5 w-3.5" />
            Reagendar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 7. CANCELAR CONSULTA ---------------- */
export function CancelConsultationModal({
  row,
  onClose,
  onConfirm,
}: {
  row: ConsultationRow;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState('Solicitação do paciente');

  return (
    <div
      className="fixed inset-0 z-50 bg-[rgba(6,20,12,0.52)] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Cancelar consulta de ${row.nome}`}
    >
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl w-full max-w-[440px] overflow-hidden shadow-2xl">
        <div className="px-5 py-3.5 border-b border-[var(--line)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[var(--danger-soft)] text-[var(--danger)] grid place-items-center shrink-0">
              <XCircle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">Cancelar consulta</h3>
              <p className="text-xs text-[var(--muted)]">
                {row.nome} · {row.dataBr} às {row.hora}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="h-8 w-8 rounded-lg border border-[var(--line)] grid place-items-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 text-xs">
          <p className="text-[var(--muted)] leading-relaxed">
            A consulta será marcada como <strong className="text-[var(--danger)]">Cancelada</strong> na agenda de{' '}
            <strong className="text-[var(--ink)]">{row.medico}</strong>.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="cancel-motivo" className="block font-bold">
              Motivo do cancelamento
            </label>
            <select
              id="cancel-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink)]"
            >
              <option>Solicitação do paciente</option>
              <option>Falta / Sem aviso prévio (regra 2h)</option>
              <option>Duplicidade de agendamento</option>
              <option>Indisponibilidade médica</option>
            </select>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--line)] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--line)] px-4 py-2 text-xs font-semibold"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(motivo)}
            className="rounded-xl bg-[var(--danger)] text-white px-4 py-2 text-xs font-semibold"
          >
            Confirmar cancelamento
          </button>
        </div>
      </div>
    </div>
  );
}
