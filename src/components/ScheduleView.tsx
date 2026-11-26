import React, { useState } from 'react';
import { TR_DIAS, TR_HOL, TR_NIV, TR_SUBS } from '../data/defaults';
import type { CronoRecord, PortalConfig } from '../types';
import { cloneData, fmtTs, initials, norm, pad } from '../utils/helpers';
import { StatusBadge, type BadgeTone } from './StatusBadge';

interface ScheduleViewProps {
  cfg: PortalConfig;
  onUpdateConfig: (next: PortalConfig) => void;
  records: Record<string, CronoRecord>;
  onSaveRecord: (personName: string, rec: CronoRecord) => void;
  isAdmin: boolean;
  traineeName: string;
  onToast: (msg: string) => void;
}

const toIso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const fmtDayMonth = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

const STATUS_TONE: Record<string, BadgeTone> = {
  Aguardando: 'neutral',
  'Em treinamento': 'info',
  'Teoria concluída': 'warn',
  'Na prática': 'warn',
  Concluído: 'ok',
  Pausado: 'bad',
};

export function ScheduleView({
  cfg,
  onUpdateConfig,
  records,
  onSaveRecord,
  isAdmin,
  traineeName,
  onToast,
}: ScheduleViewProps) {
  const [tab, setTab] = useState<'crono' | 'acomp'>('crono');
  const [selectedPerson, setSelectedPerson] = useState<string>('');
  const [draftMap, setDraftMap] = useState<Record<string, CronoRecord>>({});

  const ordem = cfg.treinoOrdem;
  const inicio = cfg.treinoInicio;
  const todayIso = toIso(new Date());

  const weeks = ordem.map((nome, idx) => {
    const base = new Date(`${inicio}T12:00`);
    base.setDate(base.getDate() + 7 * idx);
    const days = [0, 1, 2, 3, 4].map((offset) => {
      const d = new Date(base);
      d.setDate(d.getDate() + offset);
      return toIso(d);
    });
    return { nome, idx, days, from: days[0], to: days[4] };
  });

  const getRec = (name: string): CronoRecord =>
    records[name] || { nome: name, subs: {} };

  const getProgress = (name: string) => {
    const rec = getRec(name);
    const t = TR_SUBS.filter((s) => rec.subs[s]?.teoria).length;
    const p = TR_SUBS.filter((s) => rec.subs[s]?.pratica).length;
    return { t, p, all: (t + p) / (TR_SUBS.length * 2) };
  };

  const getStatus = (w: (typeof weeks)[number]) => {
    const rec = getRec(w.nome);
    const prog = getProgress(w.nome);
    if (rec.statusManual) return rec.statusManual;
    if (prog.t === TR_SUBS.length && prog.p === TR_SUBS.length) return 'Concluído';
    if (todayIso < w.from) return 'Aguardando';
    if (todayIso <= w.to) return 'Em treinamento';
    return prog.p ? 'Na prática' : 'Teoria concluída';
  };

  const currentWeek = weeks.find((w) => todayIso >= w.from && todayIso <= w.to);
  const doneTotal = weeks.filter((w) => getStatus(w) === 'Concluído').length;

  const isMe = (name: string) => {
    const firstMe = norm(traineeName).split(' ')[0];
    return Boolean(firstMe) && norm(name).split(' ')[0] === firstMe;
  };

  const activeName =
    selectedPerson && ordem.includes(selectedPerson)
      ? selectedPerson
      : (weeks.find((w) => isMe(w.nome)) || currentWeek || weeks[0])?.nome || ordem[0];

  const activeWeek = weeks.find((w) => w.nome === activeName) || weeks[0];
  const activeDraft: CronoRecord =
    draftMap[activeName] || cloneData(getRec(activeName));

  const mutateDraftSub = (
    sub: string,
    field: 'teoria' | 'pratica' | 'pData' | 'nivel' | 'obs',
    value: string | boolean
  ) => {
    const base = cloneData(activeDraft);
    base.subs = base.subs || {};
    const entry = (base.subs[sub] = base.subs[sub] || {});
    (entry as Record<string, string | boolean>)[field] = value;
    if (field === 'teoria' && value === true && !entry.tData) {
      entry.tData = todayIso;
    }
    if (field === 'pData' && value) {
      entry.pratica = true;
    }
    setDraftMap((prev) => ({ ...prev, [activeName]: base }));
  };

  const mutateDraftRoot = (field: 'obsGeral' | 'statusManual', value: string) => {
    const base = cloneData(activeDraft);
    base[field] = value;
    setDraftMap((prev) => ({ ...prev, [activeName]: base }));
  };

  const handleSavePerson = () => {
    if (!isAdmin) return;
    const payload: CronoRecord = {
      ...activeDraft,
      nome: activeName,
      at: Date.now(),
      por: cfg.madrinha.nome || 'Instrutora',
    };
    onSaveRecord(activeName, payload);
    onToast(`Acompanhamento de ${activeName} salvo.`);
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-5">
      <div>
        <p className="text-xs text-[var(--muted)]">Desenvolvimento & Treinamento</p>
        <h1 className="text-2xl font-bold mt-0.5">Cronograma de Treinamento</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Uma colaboradora por semana, de segunda a sexta, passando pelos {TR_SUBS.length}{' '}
          subsetores, seguido de prática em cada departamento.
        </p>
      </div>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 flex flex-wrap items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-bold text-base grid place-items-center shrink-0">
          {initials(cfg.madrinha.nome)}
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)] block">
            Instrutora do treinamento
          </span>
          <strong className="text-base block">{cfg.madrinha.nome}</strong>
          <span className="text-xs text-[var(--muted)]">{cfg.madrinha.cargo}</span>
        </div>

        <div className="ml-auto flex flex-wrap gap-3">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2">
            <strong className="text-lg font-display block tabular-nums">{weeks.length}</strong>
            <span className="text-[11px] text-[var(--muted)]">colaboradoras</span>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2">
            <strong className="text-lg font-display block">
              {currentWeek ? currentWeek.nome : '—'}
            </strong>
            <span className="text-[11px] text-[var(--muted)]">semana atual</span>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2">
            <strong className="text-lg font-display block tabular-nums">{doneTotal}</strong>
            <span className="text-[11px] text-[var(--muted)]">concluíram tudo</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {TR_DIAS.map(([dayName, , subs]) => (
          <div
            key={dayName}
            className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-1"
          >
            <span className="text-[11px] font-bold text-[var(--muted)]">{dayName}</span>
            <p className="text-xs font-semibold leading-snug">{subs.join(' · ')}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('crono')}
          className={`rounded-full border px-4 py-1.5 text-xs font-semibold ${
            tab === 'crono'
              ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-ink)]'
              : 'bg-[var(--surface)] border-[var(--line)]'
          }`}
        >
          Cronograma
        </button>
        <button
          type="button"
          onClick={() => setTab('acomp')}
          className={`rounded-full border px-4 py-1.5 text-xs font-semibold ${
            tab === 'acomp'
              ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-ink)]'
              : 'bg-[var(--surface)] border-[var(--line)]'
          }`}
        >
          Acompanhamento individual
        </button>
      </div>

      {tab === 'crono' ? (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold">Semanas de treinamento</h2>
            {isAdmin && (
              <label className="flex items-center gap-2 text-xs font-semibold">
                <span>Início da 1ª semana</span>
                <input
                  type="date"
                  value={inicio}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    onUpdateConfig({ ...cfg, treinoInicio: e.target.value });
                    onToast('Início do cronograma atualizado.');
                  }}
                  className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs"
                />
              </label>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--line)] text-[var(--muted)] text-left">
                  <th className="py-2 px-2">Semana</th>
                  <th className="py-2 px-2">Colaboradora</th>
                  {TR_DIAS.map(([d]) => (
                    <th key={d} className="py-2 px-2">
                      {d.replace('-feira', '')}
                    </th>
                  ))}
                  <th className="py-2 px-2">Situação</th>
                  <th className="py-2 px-2">Progresso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {weeks.map((w) => {
                  const st = getStatus(w);
                  const prog = getProgress(w.nome);
                  const isCur = currentWeek?.idx === w.idx;
                  const rec = getRec(w.nome);
                  return (
                    <tr
                      key={w.nome}
                      className={isCur ? 'bg-[var(--warn-soft)]/35' : 'hover:bg-[var(--surface-2)]'}
                    >
                      <td className="py-2.5 px-2 font-mono-num">
                        <strong>{w.idx + 1}ª</strong>
                        <span className="block text-[11px] text-[var(--muted)]">
                          {fmtDayMonth(w.from)} a {fmtDayMonth(w.to)}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPerson(w.nome);
                            setTab('acomp');
                          }}
                          className="font-bold text-[var(--ink)] underline decoration-[var(--accent)] underline-offset-4 hover:text-[var(--accent)]"
                        >
                          {w.nome}
                        </button>
                      </td>
                      {w.days.map((d, di) => (
                        <td
                          key={d}
                          className={`py-2.5 px-2 align-top ${
                            TR_HOL[d] ? 'bg-[var(--danger-soft)]/40' : ''
                          }`}
                        >
                          <span className="block text-[11px] text-[var(--muted)] font-mono-num mb-1">
                            {fmtDayMonth(d)}
                          </span>
                          {TR_HOL[d] ? (
                            <StatusBadge tone="bad">{TR_HOL[d]}</StatusBadge>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {TR_DIAS[di][2].map((sub) => {
                                const ok = rec.subs[sub]?.teoria;
                                return (
                                  <span
                                    key={sub}
                                    className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] border ${
                                      ok
                                        ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] font-semibold'
                                        : 'bg-[var(--surface-2)] border-[var(--line)]'
                                    }`}
                                  >
                                    {sub}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      ))}
                      <td className="py-2.5 px-2">
                        <StatusBadge tone={STATUS_TONE[st] || 'neutral'}>{st}</StatusBadge>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="h-2 w-24 rounded-full bg-[var(--sunk)] overflow-hidden mb-1">
                          <div
                            className="h-full bg-[var(--accent)]"
                            style={{ width: `${Math.round(prog.all * 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-[var(--muted)] font-mono-num">
                          teoria {prog.t}/7 · prática {prog.p}/7
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-4 items-start">
          <aside className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5 space-y-1 max-h-[620px] overflow-y-auto">
            {weeks.map((w) => {
              const prog = getProgress(w.nome);
              const isSel = w.nome === activeName;
              return (
                <button
                  key={w.nome}
                  type="button"
                  onClick={() => setSelectedPerson(w.nome)}
                  className={`w-full text-left rounded-xl border p-2.5 space-y-1 transition-colors ${
                    isSel
                      ? 'bg-[var(--accent-soft)] border-[var(--accent)]'
                      : 'border-transparent hover:bg-[var(--surface-2)]'
                  }`}
                >
                  <strong className="text-xs block">{w.nome}</strong>
                  <span className="text-[11px] text-[var(--muted)] block">
                    {w.idx + 1}ª semana · {getStatus(w)}
                  </span>
                  <div className="h-1.5 rounded-full bg-[var(--sunk)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)]"
                      style={{ width: `${Math.round(prog.all * 100)}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </aside>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{activeName}</h2>
                <p className="text-xs text-[var(--muted)] font-mono-num">
                  {activeWeek.idx + 1}ª semana · {fmtDayMonth(activeWeek.from)} a{' '}
                  {fmtDayMonth(activeWeek.to)}
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleSavePerson}
                  className="rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2 text-xs font-semibold"
                >
                  Salvar acompanhamento
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--line)] text-[var(--muted)] text-left">
                    <th className="py-2 px-2">Subsetor</th>
                    <th className="py-2 px-2">Teoria</th>
                    <th className="py-2 px-2">Prática no departamento</th>
                    <th className="py-2 px-2">Avaliação</th>
                    <th className="py-2 px-2">Observação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {TR_SUBS.map((sub) => {
                    const s = activeDraft.subs[sub] || {};
                    return (
                      <tr key={sub}>
                        <td className="py-2.5 px-2 font-semibold">{sub}</td>
                        <td className="py-2.5 px-2">
                          <label className="inline-flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              disabled={!isAdmin}
                              checked={Boolean(s.teoria)}
                              onChange={(e) => mutateDraftSub(sub, 'teoria', e.target.checked)}
                              className="accent-[var(--accent)]"
                            />
                            Aprendeu
                          </label>
                        </td>
                        <td className="py-2.5 px-2 space-y-1">
                          <label className="inline-flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              disabled={!isAdmin}
                              checked={Boolean(s.pratica)}
                              onChange={(e) => mutateDraftSub(sub, 'pratica', e.target.checked)}
                              className="accent-[var(--accent)]"
                            />
                            Feita
                          </label>
                          <input
                            type="date"
                            disabled={!isAdmin}
                            value={s.pData || ''}
                            onChange={(e) => mutateDraftSub(sub, 'pData', e.target.value)}
                            className="block rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11px]"
                          />
                        </td>
                        <td className="py-2.5 px-2">
                          <select
                            disabled={!isAdmin}
                            value={s.nivel || ''}
                            onChange={(e) => mutateDraftSub(sub, 'nivel', e.target.value)}
                            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs"
                          >
                            {TR_NIV.map((niv) => (
                              <option key={niv} value={niv}>
                                {niv || '—'}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="text"
                            disabled={!isAdmin}
                            value={s.obs || ''}
                            onChange={(e) => mutateDraftSub(sub, 'obs', e.target.value)}
                            placeholder={isAdmin ? 'Ex.: revisar atalho /devido' : ''}
                            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid sm:grid-cols-[1fr_220px] gap-3 pt-2">
              <label className="text-xs font-semibold text-[var(--muted)] space-y-1">
                <span>Observações gerais</span>
                <textarea
                  rows={3}
                  disabled={!isAdmin}
                  value={activeDraft.obsGeral || ''}
                  onChange={(e) => mutateDraftRoot('obsGeral', e.target.value)}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 text-xs text-[var(--ink)] font-normal"
                />
              </label>

              <label className="text-xs font-semibold text-[var(--muted)] space-y-1">
                <span>Situação</span>
                <select
                  disabled={!isAdmin}
                  value={activeDraft.statusManual || ''}
                  onChange={(e) => mutateDraftRoot('statusManual', e.target.value)}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)] font-normal"
                >
                  {[
                    '',
                    'Em treinamento',
                    'Teoria concluída',
                    'Na prática',
                    'Pausado',
                    'Concluído',
                  ].map((st) => (
                    <option key={st} value={st}>
                      {st || 'Automática (pela data)'}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {getRec(activeName).at && (
              <p className="text-[11px] text-[var(--muted)]">
                Última atualização: {fmtTs(getRec(activeName).at!)} · {getRec(activeName).por}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
