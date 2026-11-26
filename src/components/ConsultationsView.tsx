import React, { useState } from 'react';
import { Calendar, ChevronDown, MoreVertical, X } from 'lucide-react';
import type { AppView, ConsultationRow } from '../types';
import { getTodayMeta, initials, norm, nowTime, pad } from '../utils/helpers';
import { getConsultationTone, StatusBadge } from './StatusBadge';

interface ConsultationsViewProps {
  rows: ConsultationRow[];
  onStartConfirmTour: () => void;
  onAccessChat: (patientId: string) => void;
  onGoView: (view: AppView) => void;
  onToast: (msg: string) => void;
}

export function ConsultationsView({
  rows,
  onStartConfirmTour,
  onAccessChat,
  onGoView,
  onToast,
}: ConsultationsViewProps) {
  const { today, todayKey } = getTodayMeta();
  const [tagStatus, setTagStatus] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [applied, setApplied] = useState<{ day: string; start: string; end: string } | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const qNorm = norm(query.trim());
  const filteredRows = rows.filter(
    (r) =>
      (!tagStatus || r.status === 'Confirmada') &&
      (!applied || (r.dateKey === applied.day && r.hora >= applied.start && r.hora <= applied.end)) &&
      (!qNorm || norm(r.nome).includes(qNorm))
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const stats = {
    conf: rows.filter((r) => r.status === 'Confirmada' || r.status === 'Reagendada').length,
    reag: rows.filter((r) => r.status === 'Reagendada').length,
    real: rows.filter((r) => r.status === 'Realizada').length,
    nao: rows.filter((r) => r.status === 'Não realizada').length,
  };

  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

  const handleApplyDate = () => {
    if (!day || !start || !end) {
      onToast('Escolha o dia e os dois horários.');
      return;
    }
    setApplied({ day, start, end });
    setPanelOpen(false);
    setPage(1);
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--muted)]">Ambiente de treino · Dados fictícios</p>
          <h1 className="text-2xl font-bold mt-0.5">Sistema de Consultas</h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Réplica operacional da tela de consultas usada no passo a passo de Confirmação.
          </p>
        </div>
        <button
          type="button"
          onClick={onStartConfirmTour}
          className="rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2 text-xs font-semibold whitespace-nowrap hover:brightness-105"
        >
          Iniciar passo a passo: Confirmação
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[210px_minmax(0,1fr)] rounded-2xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
        <nav
          aria-label="Menu interno de consultas"
          className="border-b lg:border-b-0 lg:border-r border-[var(--line)] p-3 flex flex-col gap-0.5 text-xs"
        >
          <button
            type="button"
            onClick={() => onToast('Home do sistema: demonstração.')}
            className="text-left px-3 py-2 rounded-lg hover:bg-[var(--surface-2)] font-medium"
          >
            Home
          </button>
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--surface-2)] font-bold">
            <span>Consultas</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </div>
          <div className="ml-3 pl-2 border-l border-[var(--line)] flex flex-col gap-0.5 my-1">
            <button
              type="button"
              data-coach="todas-consultas"
              className="text-left px-2.5 py-1.5 rounded-r-lg bg-[var(--accent-soft)] font-bold text-[var(--ink)]"
            >
              Todas as consultas
            </button>
            {['Acompanhar', 'Consultas Agendadas', 'Histórico de consultas', 'Prontuários'].map(
              (sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => onToast(`"${sec}" não faz parte deste treino. Use "Todas as consultas".`)}
                  className="text-left px-2.5 py-1.5 rounded-r-lg text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                >
                  {sec}
                </button>
              )
            )}
          </div>
          <button
            type="button"
            onClick={() => onGoView('crm')}
            className="text-left px-3 py-2 rounded-lg hover:bg-[var(--surface-2)] font-medium"
          >
            CRM
          </button>
          <button
            type="button"
            onClick={() => onGoView('simulacao')}
            className="text-left px-3 py-2 rounded-lg hover:bg-[var(--surface-2)] font-medium"
          >
            Chat (Simulador)
          </button>
        </nav>

        <section className="p-4 md:p-5 space-y-4 min-w-0">
          <p className="text-xs text-[var(--muted)]">Home · Consultas · Todas as consultas</p>

          <div>
            <h2 className="text-xl font-bold">Consultas</h2>
            <p className="text-xs text-[var(--muted)]">
              Gerencie todas as consultas, seus status e dados referentes aos agendamentos.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-[var(--line)] p-3">
              <span className="text-xs text-[var(--muted)] block">Horários livres</span>
              <strong className="font-display text-2xl tabular-nums">6</strong>
              <span className="text-[11px] text-[var(--muted)] block font-mono-num">
                Atualizado às {nowTime()}
              </span>
            </div>
            <div className="rounded-xl border border-[var(--ink)] p-3">
              <span className="text-xs text-[var(--muted)] block">Confirmadas / Reagendadas</span>
              <strong className="font-display text-2xl tabular-nums">{stats.conf}</strong>
              <span className="text-[11px] text-[var(--muted)] block tabular-nums">
                {stats.reag} reagendadas
              </span>
            </div>
            <div className="rounded-xl border border-[var(--line)] p-3">
              <span className="text-xs text-[var(--muted)] block">Realizadas</span>
              <strong className="font-display text-2xl tabular-nums">{stats.real}</strong>
            </div>
            <div className="rounded-xl border border-[var(--line)] p-3">
              <span className="text-xs text-[var(--muted)] block">Não realizadas</span>
              <strong className="font-display text-2xl tabular-nums">{stats.nao}</strong>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold">Todas as consultas</h3>
            <div className="flex-1" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Pesquisar pacientes"
              aria-label="Pesquisar pacientes"
              className="w-52 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--accent)]"
            />
            <div className="relative">
              <button
                type="button"
                data-coach="btn-data"
                onClick={() => setPanelOpen((o) => !o)}
                aria-label="Filtrar por data e horário"
                className="h-8 w-8 rounded-lg border border-[var(--line)] grid place-items-center hover:border-[var(--accent)]"
              >
                <Calendar className="h-4 w-4" />
              </button>

              {panelOpen && (
                <div className="absolute right-0 top-full mt-2 w-[300px] rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl p-3.5 z-30 space-y-3">
                  <p className="text-xs font-bold">
                    {monthNames[month]} {year}
                  </p>
                  <div className="grid grid-cols-7 gap-1 text-center text-xs">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, idx) => (
                      <span key={idx} className="text-[10px] font-bold text-[var(--muted)]">
                        {d}
                      </span>
                    ))}
                    {Array.from({ length: firstDow }).map((_, idx) => (
                      <span key={`empty-${idx}`} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, idx) => {
                      const dNum = idx + 1;
                      const key = `${year}-${pad(month + 1)}-${pad(dNum)}`;
                      const isToday = key === todayKey;
                      const isSel = day === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          data-coach={isToday ? 'cal-today' : undefined}
                          onClick={() => setDay(key)}
                          className={`rounded-lg py-1.5 font-mono-num text-xs ${
                            isSel
                              ? 'bg-[var(--accent)] text-[var(--accent-ink)] font-bold'
                              : isToday
                                ? 'border border-[var(--accent)] font-bold'
                                : 'hover:bg-[var(--surface-2)]'
                          }`}
                        >
                          {dNum}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] font-semibold text-[var(--muted)] space-y-1">
                      <span>Horário inicial</span>
                      <input
                        id="f-start"
                        type="time"
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                        className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--ink)]"
                      />
                    </label>
                    <label className="text-[11px] font-semibold text-[var(--muted)] space-y-1">
                      <span>Horário final</span>
                      <input
                        id="f-end"
                        type="time"
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                        className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--ink)]"
                      />
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPanelOpen(false)}
                      className="flex-1 rounded-lg border border-[var(--line)] py-1.5 text-xs font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      data-coach="aplicar"
                      onClick={handleApplyDate}
                      className="flex-1 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] py-1.5 text-xs font-semibold"
                    >
                      Aplicar filtro
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {tagStatus && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 font-semibold">
                Status: Confirmadas
                <button
                  type="button"
                  data-coach="tag-x"
                  onClick={() => {
                    setTagStatus(false);
                    setPage(1);
                  }}
                  aria-label="Remover filtro Status: Confirmadas"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            {applied && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 font-semibold font-mono-num">
                Data: {applied.day.split('-').reverse().join('/')} · {applied.start} às{' '}
                {applied.end}
                <button
                  type="button"
                  onClick={() => setApplied(null)}
                  aria-label="Remover filtro de data"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            {!tagStatus && !applied && (
              <span className="text-[var(--muted)]">Sem filtros aplicados</span>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full min-w-[760px] text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--surface-2)] text-[var(--muted)] uppercase tracking-wider text-[10px] border-b border-[var(--line)]">
                  <th className="text-left px-3 py-2.5">Paciente</th>
                  <th className="text-left px-3 py-2.5">Médico</th>
                  <th className="text-left px-3 py-2.5">Tipo</th>
                  <th className="text-left px-3 py-2.5">Status</th>
                  <th className="text-left px-3 py-2.5">Data e hora</th>
                  <th className="text-left px-3 py-2.5">Anamnese</th>
                  <th className="px-3 py-2.5"></th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {slice.length ? (
                  slice.map((r) => {
                    const isTarget = r.id === 'rconfirmacao6';
                    return (
                      <tr key={r.id} className="hover:bg-[var(--surface-2)]">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="h-7 w-7 rounded-full bg-[var(--sunk)] text-[var(--accent)] font-bold text-[10px] grid place-items-center shrink-0">
                              {initials(r.nome)}
                            </span>
                            <div>
                              <strong className="block">{r.nome}</strong>
                              <span className="text-[11px] text-[var(--muted)] font-mono-num">
                                {r.proc}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">{r.medico}</td>
                        <td className="px-3 py-2.5">{r.tipo}</td>
                        <td className="px-3 py-2.5">
                          <StatusBadge tone={getConsultationTone(r.status)}>
                            {r.status}
                          </StatusBadge>
                        </td>
                        <td className="px-3 py-2.5 font-mono-num">
                          {r.dataBr} às {r.hora}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge tone={r.anamnese ? 'ok' : 'bad'}>
                            {r.anamnese ? 'Preenchida' : 'Não preenchida'}
                          </StatusBadge>
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => onToast('Reagendar: use o Simulador para praticar.')}
                            className="text-[var(--accent)] font-semibold hover:underline"
                          >
                            Reagendar
                          </button>
                        </td>
                        <td className="px-3 py-2.5 relative">
                          <button
                            type="button"
                            data-coach={isTarget ? 'row-menu' : undefined}
                            onClick={() =>
                              setRowMenuId((cur) => (cur === r.id ? null : r.id))
                            }
                            aria-label="Mais ações"
                            className="h-7 w-7 rounded-lg border border-[var(--line)] grid place-items-center hover:border-[var(--accent)]"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>

                          {rowMenuId === r.id && (
                            <div className="absolute right-3 top-10 z-30 min-w-[190px] rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl p-1 text-xs">
                              <button
                                type="button"
                                data-coach={isTarget ? 'acessar-chat' : undefined}
                                onClick={() => {
                                  setRowMenuId(null);
                                  if (!r.pid) {
                                    onToast(
                                      'Esta consulta não faz parte da simulação de chat.'
                                    );
                                    return;
                                  }
                                  onAccessChat(r.pid);
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)] font-semibold"
                              >
                                Acessar chat
                              </button>
                              {[
                                'Ver histórico',
                                'Link de consulta copiado',
                                'Link de convidado copiado',
                                'Alterar médico',
                                'Nota fiscal',
                              ].map((act) => (
                                <button
                                  key={act}
                                  type="button"
                                  onClick={() => {
                                    setRowMenuId(null);
                                    onToast(`${act} (demonstração).`);
                                  }}
                                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)]"
                                >
                                  {act}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-[var(--muted)]">
                      Nenhuma consulta encontrada com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 text-xs text-[var(--muted)]">
            <label htmlFor="page-size">Linhas por página</label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--ink)]"
            >
              {[10, 15, 20, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="font-mono-num">
              {filteredRows.length ? (safePage - 1) * pageSize + 1 : 0}–
              {Math.min(filteredRows.length, safePage * pageSize)} de {filteredRows.length}
            </span>
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-[var(--line)] px-2.5 py-1 font-semibold disabled:opacity-45"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[var(--line)] px-2.5 py-1 font-semibold disabled:opacity-45"
            >
              Próxima
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
