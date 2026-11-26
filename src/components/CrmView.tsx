import React, { useState } from 'react';
import { ChevronDown, MessageCircle, User, X } from 'lucide-react';
import type { CrmStatus, PatientCase } from '../types';
import { initials, norm } from '../utils/helpers';
import { StatusBadge, type BadgeTone } from './StatusBadge';

interface CrmViewProps {
  patients: PatientCase[];
  onOpenPatientChat: (patientId: string) => void;
  onBackToSim: () => void;
}

const CRM_COLS: Array<{ status: CrmStatus; tone: BadgeTone }> = [
  { status: 'Aguardando', tone: 'warn' },
  { status: 'Em andamento', tone: 'info' },
  { status: 'Faltou', tone: 'bad' },
];

export function CrmView({ patients, onOpenPatientChat, onBackToSim }: CrmViewProps) {
  const [query, setQuery] = useState('');
  const [moreId, setMoreId] = useState<string | null>(null);
  const [popId, setPopId] = useState<string | null>(null);
  const [medDrawerPatient, setMedDrawerPatient] = useState<PatientCase | null>(null);

  const qNorm = norm(query.trim());
  const items = patients.filter(
    (p) => p.crm && (!qNorm || norm(`${p.nome} ${p.medico}`).includes(qNorm))
  );

  return (
    <div className="max-w-[1440px] mx-auto space-y-4">
      <div>
        <p className="text-xs text-[var(--muted)]">
          Home · Consultas · Acompanhamento de consultas
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3 mt-0.5">
          <div>
            <h1 className="text-2xl font-bold">Acompanhamento de consultas (CRM)</h1>
            <p className="text-xs text-[var(--muted)] mt-0.5 font-mono-num">
              Agendas hoje · Ativas {items.filter((p) => p.crm !== 'Faltou').length} · Faltas{' '}
              {items.filter((p) => p.crm === 'Faltou').length}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar por paciente ou médico"
              aria-label="Pesquisar no CRM"
              className="w-60 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              data-coach="crm-back"
              onClick={onBackToSim}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2 text-xs font-semibold whitespace-nowrap"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Voltar ao chat
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {CRM_COLS.map(({ status, tone }) => {
          const list = items.filter((p) => p.crm === status);
          return (
            <section
              key={status}
              className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-3 space-y-2.5 min-h-[260px]"
            >
              <div className="flex items-center justify-between px-1">
                <StatusBadge tone={tone}>
                  {status} · {list.length}
                </StatusBadge>
              </div>

              {list.length ? (
                list.map((p) => (
                  <div
                    key={p.id}
                    className="relative rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[var(--muted)]">Paciente</span>
                      <StatusBadge tone={tone}>
                        {status}
                        {status === 'Aguardando' ? ` · ${p.hora}` : ''}
                      </StatusBadge>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <User className="h-3.5 w-3.5 text-[var(--muted)] shrink-0" />
                      <span className="truncate">{p.nome}</span>
                    </div>

                    <span className="text-[11px] text-[var(--muted)] block pt-0.5">
                      Médico responsável
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{p.medico}</span>
                    </div>

                    {moreId === p.id && (
                      <div className="rounded-lg bg-[var(--surface-2)] p-2 text-[11px] text-[var(--muted)] font-mono-num">
                        {p.proc} · consulta às {p.hora}
                        <br />
                        {p.tel} · atendimento: {p.atend}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 mt-1 border-t border-[var(--line)]">
                      <button
                        type="button"
                        onClick={() => setMoreId((cur) => (cur === p.id ? null : p.id))}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
                      >
                        Ver mais
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        data-coach={`crm-msg-${p.id}`}
                        onClick={() => setPopId((cur) => (cur === p.id ? null : p.id))}
                        aria-label={`Mensagens de ${p.nome}`}
                        className="h-7 w-7 rounded-lg border border-[var(--line)] grid place-items-center hover:border-[var(--accent)]"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {popId === p.id && (
                      <div className="absolute right-2 bottom-10 z-20 min-w-[180px] rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xl p-1 text-xs">
                        <button
                          type="button"
                          data-coach={`crm-pac-${p.id}`}
                          onClick={() => {
                            setPopId(null);
                            onOpenPatientChat(p.id);
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)] font-semibold"
                        >
                          Chat do paciente
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPopId(null);
                            setMedDrawerPatient(p);
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--accent-soft)]"
                        >
                          Chat com o médico
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--line)] p-6 text-center text-xs text-[var(--muted)]">
                  Nenhum card nesta coluna
                </div>
              )}
            </section>
          );
        })}
      </div>

      {medDrawerPatient && (
        <div
          className="fixed inset-0 z-40 bg-[rgba(6,20,12,0.45)] flex justify-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMedDrawerPatient(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Chat com o médico"
        >
          <aside className="bg-[var(--surface)] w-full max-w-[460px] h-full flex flex-col shadow-2xl border-l border-[var(--line)]">
            <div className="p-4 border-b border-[var(--line)] flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[var(--sunk)] text-[var(--accent)] font-bold text-xs grid place-items-center shrink-0">
                {initials(medDrawerPatient.medico)}
              </div>
              <div className="min-w-0 flex-1">
                <strong className="text-sm block truncate">{medDrawerPatient.medico}</strong>
                <span className="text-xs text-[var(--muted)] block truncate">
                  Chat com o médico · paciente {medDrawerPatient.nome}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMedDrawerPatient(null)}
                aria-label="Fechar"
                className="h-8 w-8 rounded-lg border border-[var(--line)] grid place-items-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-[var(--surface-2)]">
              {medDrawerPatient.medMsgs.map((t, i) => (
                <div
                  key={i}
                  className="max-w-[85%] rounded-xl border border-[var(--line)] bg-[var(--bubble-in)] p-3 text-xs space-y-1"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] block">
                    {medDrawerPatient.medico}
                  </span>
                  <p>{t}</p>
                </div>
              ))}
              <div className="rounded-xl bg-[var(--info-soft)] text-[var(--info)] p-3 text-xs">
                Use "Chat do paciente" para falar com o paciente. Este painel exibe os recados do
                médico para a consulta.
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
