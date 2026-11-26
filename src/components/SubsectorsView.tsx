import React, { useState } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import type { PortalConfig } from '../types';
import { deptKey } from '../utils/helpers';
import { buildTourSteps } from '../data/tours';

interface SubsectorsViewProps {
  cfg: PortalConfig;
  onStartTour: (tourKey: string) => void;
}

const SUPPORTED_TOURS = new Set([
  'geral',
  'agendamento',
  'confirmacao',
  'andamento',
  'reagendamento',
  'medicos',
]);

export function SubsectorsView({ cfg, onStartTour }: SubsectorsViewProps) {
  const [subTab, setSubTab] = useState(0);
  const [guideDet, setGuideDet] = useState<number | null>(null);

  const subs = cfg.subsetores || [];
  const idx = Math.min(subTab, Math.max(0, subs.length - 1));
  const current = subs[idx];
  const tourKey = current ? current.tour || deptKey(current.nome) : '';
  const hasTour = SUPPORTED_TOURS.has(tourKey) && Boolean(buildTourSteps);
  const steps = current
    ? String(current.passos || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="max-w-[1380px] mx-auto space-y-5">
      <div>
        <p className="text-xs text-[var(--muted)]">Desenvolvimento & Treinamento</p>
        <h1 className="text-2xl font-bold mt-0.5">Passo a Passo dos Subsetores</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Escolha o departamento, revise o procedimento padrão e inicie o treino guiado. As setas
          mostram onde clicar sem travar a tela.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        {subs.map((sub, i) => (
          <button
            key={sub.nome}
            type="button"
            role="tab"
            aria-selected={idx === i}
            onClick={() => setSubTab(i)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              idx === i
                ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-ink)]'
                : 'bg-[var(--surface)] border-[var(--line)] hover:border-[var(--accent)]'
            }`}
          >
            {sub.nome}
          </button>
        ))}
      </div>

      {current ? (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 md:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{current.nome}</h2>
              {current.desc && <p className="text-sm text-[var(--muted)]">{current.desc}</p>}
            </div>
            {hasTour && (
              <button
                type="button"
                onClick={() => onStartTour(tourKey)}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2 text-xs font-semibold whitespace-nowrap hover:brightness-105"
              >
                <Play className="h-3.5 w-3.5" />
                Iniciar passo a passo guiado
              </button>
            )}
          </div>

          {steps.length ? (
            <ol className="space-y-2.5">
              {steps.map((step, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 items-start text-sm max-w-[82ch]"
                >
                  <span className="h-7 w-7 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-bold text-xs grid place-items-center tabular-nums">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-[var(--muted)]">Nenhum passo cadastrado ainda.</p>
          )}

          {hasTour && (
            <p className="text-xs text-[var(--muted)] pt-2 border-t border-[var(--line)]">
              O treino guiado reinicia os pacientes fictícios no Simulador. Em cada seta você pode
              usar "Tirar dúvida com a IA".
            </p>
          )}
        </section>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--line)] p-6 text-center text-sm text-[var(--muted)]">
          Nenhum subsetor cadastrado.
        </div>
      )}

      {tourKey === 'confirmacao' && (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 md:p-6 space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Setor de Confirmação
            </p>
            <h2 className="text-lg font-bold mt-0.5">Lembretes e confirmação da agenda (4.1 a 4.4)</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cfg.guia.map((step, i) => {
              const isOpen = guideDet === i;
              return (
                <div key={step.quando} className="relative flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => setGuideDet(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className={`w-full text-left rounded-xl border p-3.5 transition-colors flex flex-col justify-between gap-2 ${
                      isOpen
                        ? 'border-[var(--accent)] bg-[var(--surface-2)]'
                        : 'border-[var(--line)] bg-[var(--surface-2)] hover:border-[var(--accent)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="h-5 w-5 rounded-full bg-[var(--accent)] text-[var(--accent-ink)] text-[11px] font-bold grid place-items-center shrink-0">
                          {i + 1}
                        </span>
                        <h3 className="text-sm font-bold leading-snug">{step.titulo}</h3>
                      </div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)] mt-2">
                        {step.quando}
                      </p>
                      <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
                        {step.texto}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[var(--accent)]">
                      {isOpen ? 'Fechar detalhe' : 'Ver passo completo'}
                    </span>
                  </button>
                  {i < cfg.guia.length - 1 && (
                    <ArrowRight className="hidden lg:block h-4 w-4 text-[var(--accent)] self-center shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {guideDet !== null && cfg.guia[guideDet] && (
            <div className="rounded-xl border border-[var(--accent)] bg-[var(--surface-2)] p-4 space-y-2">
              <h3 className="text-sm font-bold">
                {cfg.guia[guideDet].quando} · {cfg.guia[guideDet].titulo}
              </h3>
              <p className="text-sm whitespace-pre-line text-[var(--ink)] max-w-[75ch] leading-relaxed">
                {cfg.guia[guideDet].detalhe || cfg.guia[guideDet].texto}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
