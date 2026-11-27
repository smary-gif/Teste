import React, { useState } from 'react';
import { Bot, ChevronDown, MessageCircle, Paperclip, User } from 'lucide-react';
import type { PatientCase, SolStatus } from '../types';
import { norm } from '../utils/helpers';
import { StatusBadge, type BadgeTone } from './StatusBadge';

interface SolicitationsViewProps {
  patients: PatientCase[];
  onOpenModal: (patientId: string | null, mode: 'new' | 'edit') => void;
  onMoveStatus: (patientId: string, nextStatus: SolStatus) => void;
  onOpenChat: (patientId: string) => void;
  onOpenQuickSim?: (deptKey?: string, patientId?: string) => void;
}

const SOL_COLUMNS: Array<{ key: SolStatus; label: string; tone: BadgeTone }> = [
  { key: 'pendente', label: 'Pendente', tone: 'bad' },
  { key: 'intervencao', label: 'Intervenção', tone: 'info' },
  { key: 'medico', label: 'Solicitado ao médico', tone: 'teal' },
  { key: 'atraso', label: 'Em atraso', tone: 'warn' },
  { key: 'concluido', label: 'Concluído', tone: 'ok' },
];

const SOL_NEXT: Record<SolStatus, Array<[SolStatus, string]>> = {
  pendente: [['medico', 'Enviar ao médico']],
  medico: [
    ['intervencao', 'Médico devolveu (intervenção)'],
    ['atraso', 'Marcar em atraso'],
    ['concluido', 'Concluir'],
  ],
  intervencao: [
    ['medico', 'Reenviar ao médico'],
    ['concluido', 'Concluir'],
  ],
  atraso: [
    ['medico', 'Cobrar o médico'],
    ['concluido', 'Concluir'],
  ],
  concluido: [['pendente', 'Reabrir']],
};

const SOL_BASE_CONCLUIDO = 948;

export function SolicitationsView({
  patients,
  onOpenModal,
  onMoveStatus,
  onOpenChat,
  onOpenQuickSim,
}: SolicitationsViewProps) {
  const [query, setQuery] = useState('');
  const [openPopId, setOpenPopId] = useState<string | null>(null);

  const q = norm(query.trim());
  const items = patients.filter(
    (p) =>
      p.sol &&
      (!q || norm(`${p.nome} ${p.sol.tipo} ${p.sol.medico}`).includes(q))
  );

  return (
    <div className="max-w-[1460px] mx-auto space-y-4">
      <div>
        <p className="text-xs text-[var(--muted)]">Home · Solicitações</p>
        <div className="flex flex-wrap items-end justify-between gap-3 mt-0.5">
          <div>
            <h1 className="text-2xl font-bold">Acompanhamento de Solicitações</h1>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Acompanhe o status das suas solicitações médicas · Últimos 30 dias
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar solicitações"
              aria-label="Pesquisar solicitações"
              className="w-60 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs focus:outline-none focus:border-[var(--accent)]"
            />
            {onOpenQuickSim && (
              <button
                type="button"
                onClick={() => onOpenQuickSim('solicitacoes')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
              >
                <Bot className="h-3.5 w-3.5 text-[var(--accent)]" />
                Simular caso
              </button>
            )}
            <button
              type="button"
              data-coach="sol-modal"
              onClick={() => onOpenModal(null, 'new')}
              className="rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2 text-xs font-semibold whitespace-nowrap hover:brightness-105"
            >
              Nova solicitação
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3 items-start">
        {SOL_COLUMNS.map((col) => {
          const list = items.filter((p) => p.sol?.st === col.key);
          const total = list.length + (col.key === 'concluido' && !q ? SOL_BASE_CONCLUIDO : 0);
          return (
            <section
              key={col.key}
              className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-2.5 space-y-2.5 max-h-[72vh] overflow-y-auto min-h-[240px]"
            >
              <div className="flex items-center justify-between px-1 pt-0.5">
                <StatusBadge tone={col.tone}>
                  {col.label} · {total}
                </StatusBadge>
              </div>

              {list.length ? (
                list.map((p) => {
                  const sol = p.sol!;
                  return (
                    <div
                      key={p.id}
                      className="relative rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[var(--muted)]">Paciente</span>
                        {sol.urg && <StatusBadge tone="bad">Urgente</StatusBadge>}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <User className="h-3.5 w-3.5 text-[var(--muted)] shrink-0" />
                        <span className="truncate">{p.nome}</span>
                      </div>

                      <span className="text-[11px] text-[var(--muted)] block pt-0.5">
                        Motivo
                      </span>
                      <span className="text-xs font-medium block">{sol.tipo}</span>

                      <span className="text-[11px] text-[var(--muted)] block pt-0.5">
                        Médico
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{sol.medico}</span>
                      </div>

                      {sol.anexos.length > 0 && (
                        <div className="flex items-center gap-1 text-[11px] text-[var(--muted)] pt-0.5">
                          <Paperclip className="h-3 w-3" />
                          <span>
                            {sol.anexos.length} anexo{sol.anexos.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 mt-1 border-t border-[var(--line)]">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenPopId(null);
                            onOpenModal(p.id, 'edit');
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
                        >
                          Abrir detalhes
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenPopId((cur) => (cur === p.id ? null : p.id))
                          }
                          aria-label={`Ações de ${p.nome}`}
                          className="h-7 w-7 rounded-lg border border-[var(--line)] grid place-items-center hover:border-[var(--accent)]"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {openPopId === p.id && (
                        <div className="absolute right-2 bottom-10 z-20 min-w-[200px] rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xl p-1 text-xs">
                          {SOL_NEXT[col.key].map(([nextSt, label]) => (
                            <button
                              key={nextSt}
                              type="button"
                              onClick={() => {
                                setOpenPopId(null);
                                onMoveStatus(p.id, nextSt);
                              }}
                              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)]"
                            >
                              {label}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setOpenPopId(null);
                              onOpenModal(p.id, 'edit');
                            }}
                            className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)]"
                          >
                            Editar solicitação
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenPopId(null);
                              onOpenChat(p.id);
                            }}
                            className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)]"
                          >
                            Chat do paciente
                          </button>
                          {onOpenQuickSim && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenPopId(null);
                                onOpenQuickSim(p.key, p.id);
                              }}
                              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
                            >
                              Simulador rápido (aqui)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--line)] p-4 text-center text-xs text-[var(--muted)]">
                  Nenhuma solicitação aqui
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
