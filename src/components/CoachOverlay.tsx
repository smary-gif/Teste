import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CoachStep, PortalConfig } from '../types';

interface CoachOverlayProps {
  active: boolean;
  steps: CoachStep[];
  stepIndex: number;
  onAdvance: () => void;
  onStop: (msg?: string) => void;
  cfg: PortalConfig;
}

export function CoachOverlay({
  active,
  steps,
  stepIndex,
  onAdvance,
  onStop,
  cfg,
}: CoachOverlayProps) {
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    below: boolean;
    arrowLeft: number;
    visible: boolean;
  }>({ top: 80, left: 80, below: true, arrowLeft: 140, visible: false });

  const [askOpen, setAskOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<number>(-1);

  const cur = active ? steps[stepIndex] : undefined;

  useEffect(() => {
    setAskOpen(false);
    setAnswer('');
    setQuestion('');
    pendingRef.current = -1;
  }, [stepIndex, active]);

  // Highlight target and compute placement
  useLayoutEffect(() => {
    document.querySelectorAll('.coach-target').forEach((el) => el.classList.remove('coach-target'));
    if (!active || !cur) {
      setPos((p) => ({ ...p, visible: false }));
      return;
    }

    let rafId = 0;
    let tries = 0;

    const place = (scrollIntoView: boolean) => {
      const target = document.querySelector(cur.sel) as HTMLElement | null;
      document.querySelectorAll('.coach-target').forEach((el) => {
        if (el !== target) el.classList.remove('coach-target');
      });

      if (!target || !target.getClientRects().length) {
        setPos((p) => ({ ...p, visible: false }));
        if (tries < 60) {
          tries++;
          rafId = requestAnimationFrame(() => place(scrollIntoView));
        }
        return;
      }

      target.classList.add('coach-target');
      if (scrollIntoView) {
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }

      const r = target.getBoundingClientRect();
      const bw = boxRef.current?.offsetWidth || 320;
      const bh = boxRef.current?.offsetHeight || 160;
      const below = r.bottom + 18 + bh < window.innerHeight || r.top - 18 - bh < 0;
      const top = Math.max(12, below ? r.bottom + 14 : r.top - 14 - bh);
      const left = Math.max(12, Math.min(window.innerWidth - bw - 12, r.left + r.width / 2 - bw / 2));
      const arrowLeft = Math.max(14, Math.min(bw - 30, r.left + r.width / 2 - left - 9));

      setPos({ top, left, below, arrowLeft, visible: true });
    };

    place(true);

    const onReflow = () => place(false);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    const interval = window.setInterval(() => place(false), 350);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(interval);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
      document.querySelectorAll('.coach-target').forEach((el) => el.classList.remove('coach-target'));
    };
  }, [active, cur, stepIndex, askOpen, answer]);

  // Listen for user clicks & inputs matching the current step
  useEffect(() => {
    if (!active || !cur) return;

    const triggerNext = () => {
      if (pendingRef.current === stepIndex) return;
      pendingRef.current = stepIndex;
      window.setTimeout(() => {
        onAdvance();
      }, 60);
    };

    const onClick = (e: MouseEvent) => {
      if (boxRef.current && boxRef.current.contains(e.target as Node)) return;
      if (cur.check || cur.sig) return;
      const target = document.querySelector(cur.sel);
      if (target && target.contains(e.target as Node)) {
        triggerNext();
      }
    };

    const onInputOrChange = (e: Event) => {
      if (!cur.check) return;
      const target = document.querySelector(cur.sel);
      const el = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (target && (target === el || target.contains(el)) && cur.check(el.value)) {
        triggerNext();
      }
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('input', onInputOrChange, true);
    document.addEventListener('change', onInputOrChange, true);

    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('input', onInputOrChange, true);
      document.removeEventListener('change', onInputOrChange, true);
    };
  }, [active, cur, stepIndex, onAdvance]);

  async function handleAskAi(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || asking) return;
    setAsking(true);
    setAnswer('Consultando Guia IA...');
    try {
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          currentStep: cur?.text || 'Treino livre',
          subsetoresText: cfg.subsetores.map((s) => `${s.nome}:\n${s.passos}`).join('\n\n'),
          rulesText: cfg.guia.map((g) => `${g.quando} – ${g.titulo}: ${g.detalhe || g.texto}`).join('\n'),
          shortcutsText: cfg.atalhos.map((a) => `${a.cmd}: ${a.texto.replace(/\n/g, ' ')}`).join('\n'),
        }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok) {
        setAnswer(data.error || 'Erro ao consultar o Guia IA.');
      } else {
        setAnswer(data.answer || 'Sem resposta.');
      }
    } catch {
      setAnswer('Erro de rede ao consultar o Guia IA.');
    } finally {
      setAsking(false);
    }
  }

  if (!active || !cur || !pos.visible) return null;

  return (
    <div
      ref={boxRef}
      style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
      className="no-print fixed z-[60] w-[320px] max-w-[calc(100vw-24px)] rounded-xl bg-[var(--ink)] text-[var(--bg)] p-3.5 shadow-2xl text-[13px]"
      role="status"
      aria-live="polite"
    >
      <div
        style={{ left: `${pos.arrowLeft}px` }}
        className={`absolute w-0 h-0 border-[9px] border-transparent ${
          pos.below ? '-top-[18px] border-b-[var(--ink)]' : '-bottom-[18px] border-t-[var(--ink)]'
        }`}
      />
      <div className="flex items-center gap-2 mb-1.5">
        <span className="bg-[var(--mint)] text-[#0f2a1b] text-[10px] font-extrabold px-2 py-0.5 rounded-full tracking-wide uppercase">
          Guia IA
        </span>
        <span className="text-[11px] uppercase tracking-wider opacity-80 font-bold tabular-nums">
          Passo {stepIndex + 1} de {steps.length}
        </span>
      </div>

      <p className="leading-snug">{cur.text}</p>

      {askOpen && (
        <form onSubmit={handleAskAi} className="mt-2.5 flex flex-col gap-1.5">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Pergunte ao Guia IA e tecle Enter"
            aria-label="Pergunta para o Guia IA"
            autoFocus
            className="w-full rounded-lg px-2.5 py-1.5 bg-[var(--bg)] text-[var(--ink)] text-xs focus:outline-none"
          />
          {answer && (
            <div className="max-h-36 overflow-y-auto text-xs leading-relaxed bg-[rgba(255,255,255,0.08)] rounded-lg p-2 whitespace-pre-wrap">
              {answer}
            </div>
          )}
        </form>
      )}

      <div className="flex items-center justify-between gap-2 mt-3 text-[11px]">
        <button
          type="button"
          onClick={() => setAskOpen((o) => !o)}
          className="underline opacity-90 hover:opacity-100"
        >
          {askOpen ? 'Fechar IA' : 'Tirar dúvida com a IA'}
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onAdvance}
            className="underline opacity-90 hover:opacity-100"
          >
            Pular passo
          </button>
          <button
            type="button"
            onClick={() => onStop('Passo a passo encerrado.')}
            className="underline opacity-80 hover:opacity-100"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
