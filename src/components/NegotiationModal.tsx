import React, { useState } from 'react';
import { ChevronDown, Package, Stethoscope, X } from 'lucide-react';
import type { PatientCase } from '../types';
import { initials } from '../utils/helpers';
import { StatusBadge } from './StatusBadge';

interface NegotiationModalProps {
  patient: PatientCase;
  initialTab?: 'consultas' | 'entregas';
  onClose: () => void;
  onToast: (msg: string) => void;
}

export function NegotiationModal({
  patient,
  initialTab = 'consultas',
  onClose,
  onToast,
}: NegotiationModalProps) {
  const [tab, setTab] = useState<'consultas' | 'entregas'>(initialTab);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const consultas = [
    {
      num: `#${284500 + patient.k}`,
      data: patient.data.replaceAll('-', '/'),
      tipo: patient.tipo === 'Gratuita' ? 'Gratuita' : 'Consulta Médica',
      medico: patient.medico,
      status: 'Agendada',
      obs: `Consulta de hoje às ${patient.hora}.`,
    },
    ...patient.hist.consultas.map((c) => ({ ...c, status: 'Consulta realizada' })),
  ];

  return (
    <div
      className="fixed inset-0 z-40 bg-[rgba(6,20,12,0.5)] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Negociação de ${patient.nome}`}
    >
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl w-full max-w-[980px] max-h-[calc(100vh-32px)] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-5 py-3.5 border-b border-[var(--line)] flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted)]">
              Negociação · Dados fictícios de treino
            </p>
            <h2 className="text-lg font-bold">{patient.nome}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-coach="neg-close"
            aria-label="Fechar negociação"
            className="h-9 w-9 rounded-lg border border-[var(--line)] grid place-items-center hover:border-[var(--accent)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid md:grid-cols-[290px_minmax(0,1fr)] overflow-y-auto flex-1">
          <aside className="bg-[var(--surface-2)] border-b md:border-b-0 md:border-r border-[var(--line)] p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-[var(--sunk)] text-[var(--accent)] font-bold grid place-items-center shrink-0">
                {initials(patient.nome)}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{patient.nome}</p>
                <p className="text-xs text-[var(--muted)] font-mono-num">
                  {patient.proc} · {patient.tipo}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onToast('Alterar pipeline e etapa: disponível apenas na operação real.')}
              className="w-full rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] py-2 px-3 text-xs font-semibold"
            >
              Alterar Pipeline e etapa
            </button>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-2 text-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Formas de contato
              </p>
              <div className="flex justify-between gap-2">
                <span className="text-[var(--muted)]">Telefone</span>
                <strong className="font-mono-num">{patient.tel}</strong>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[var(--muted)]">E-mail</span>
                <strong className="break-all text-right">{patient.email}</strong>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Avaliações
              </p>
              <div className="flex items-center gap-3">
                <strong className="font-display text-2xl tabular-nums">5,0</strong>
                <div className="text-xs">
                  <span className="font-medium block">Consulta</span>
                  <span className="text-[var(--muted)]">
                    Enviada em {patient.hist.consultas[0]?.data || '—'}
                  </span>
                </div>
              </div>
            </div>
          </aside>

          <section className="flex flex-col min-w-0">
            <div className="flex gap-2 px-5 border-b border-[var(--line)]" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'consultas'}
                onClick={() => {
                  setTab('consultas');
                  setExpandedIdx(null);
                }}
                data-coach="neg-tab-consultas"
                className={`inline-flex items-center gap-2 py-3 px-2 text-sm font-semibold border-b-2 transition-colors ${
                  tab === 'consultas'
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <Stethoscope className="h-4 w-4" />
                Consultas
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'entregas'}
                onClick={() => {
                  setTab('entregas');
                  setExpandedIdx(null);
                }}
                data-coach="neg-tab-entregas"
                className={`inline-flex items-center gap-2 py-3 px-2 text-sm font-semibold border-b-2 transition-colors ${
                  tab === 'entregas'
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <Package className="h-4 w-4" />
                Entregas
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto">
              {tab === 'consultas' ? (
                <>
                  <p className="text-xs text-[var(--muted)]">
                    {patient.isMed
                      ? 'Profissional parceiro(a): consultas atendidas aparecem na agenda do CRM.'
                      : `O paciente passou por ${patient.hist.consultas.length} consulta${
                          patient.hist.consultas.length === 1 ? '' : 's'
                        } realizada${patient.hist.consultas.length === 1 ? '' : 's'}.`}
                  </p>
                  {consultas.map((c, idx) => (
                    <div
                      key={c.num}
                      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold">
                          {c.tipo === 'Gratuita' ? 'Consulta Médica' : c.tipo} - {c.num}
                        </h3>
                        <div className="flex items-center gap-2">
                          <StatusBadge tone={c.status === 'Agendada' ? 'info' : 'ok'}>
                            {c.status}
                          </StatusBadge>
                          <span className="text-xs text-[var(--muted)]">
                            {c.tipo === 'Consulta Médica' ? 'Recorrência' : c.tipo}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[var(--muted)] block">Médico Responsável</span>
                          <strong>{c.medico}</strong>
                        </div>
                        <div>
                          <span className="text-[var(--muted)] block">Paciente</span>
                          <span>{patient.nome}</span>
                        </div>
                      </div>

                      {expandedIdx === idx && (
                        <div className="rounded-lg bg-[var(--surface-2)] p-2.5 text-xs text-[var(--muted)]">
                          Data: {c.data} · Tipo: {c.tipo}
                          <br />
                          {c.obs}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--line)]">
                        <button
                          type="button"
                          onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
                        >
                          Mais informações
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onToast('Receita fictícia: disponível apenas para consulta visual.')
                            }
                            className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-xs font-semibold hover:border-[var(--accent)]"
                          >
                            Ver receita
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                            className="rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] px-2.5 py-1 text-xs font-semibold"
                          >
                            Ver detalhes
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              ) : patient.hist.entregas.length ? (
                <>
                  <p className="text-xs text-[var(--muted)]">
                    O paciente já comprou. Histórico de pedidos:
                  </p>
                  {patient.hist.entregas.map((e) => (
                    <div
                      key={e.pedido}
                      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-1.5 text-xs"
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
                  ))}
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--line)] p-6 text-center text-sm text-[var(--muted)]">
                  Este paciente ainda não comprou. Nenhuma entrega registrada.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
