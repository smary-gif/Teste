import React, { useState } from 'react';
import { Award, Bot, ChevronRight, LogOut, ShieldCheck, UserCheck, UserPlus, X } from 'lucide-react';
import type { GoogleAuthProfile } from '../lib/googleAuth';
import type { AppView, TraineeSummary } from '../types';
import { ClickCannabisLogo } from './ClickCannabisLogo';
import { GoogleSignInButton } from './GoogleSignInButton';

interface TopEnterpriseBarProps {
  activeCollaborator: string;
  collaborators: string[];
  onChangeCollaborator: (name: string) => void;
  onAddCollaborator: (name: string) => void;
  summary: TraineeSummary;
  onOpenQuickSim: (deptKey?: string) => void;
  onGoView: (view: AppView) => void;
  googleUser: GoogleAuthProfile | null;
  googleAuthLoading: boolean;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  isAdmin?: boolean;
  activeAdminLabel?: string | null;
}

export function TopEnterpriseBar({
  activeCollaborator,
  collaborators,
  onChangeCollaborator,
  onAddCollaborator,
  summary,
  onOpenQuickSim,
  onGoView,
  googleUser,
  googleAuthLoading,
  onGoogleSignIn,
  onGoogleSignOut,
  isAdmin = false,
  activeAdminLabel = null,
}: TopEnterpriseBarProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const lockTraineeSwitch = Boolean(googleUser) && !isAdmin;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newName.trim();
    if (!clean) return;
    onAddCollaborator(clean);
    setNewName('');
    setAdding(false);
  };

  return (
    <header className="no-print sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-xs px-4 md:px-6 py-2.5">
      <div className="max-w-[1460px] mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <ClickCannabisLogo subtitle="Academia Corporativa · Trainee" />
          <span className="hidden sm:inline text-[var(--line)]">/</span>
          {isAdmin && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] border border-[var(--accent)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--accent)] whitespace-nowrap">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              ADM · {activeAdminLabel || 'Liderança'}
            </span>
          )}
          {lockTraineeSwitch ? (
            <span className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-semibold text-[var(--ink)]">
              <UserCheck className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
              <span>{activeCollaborator}</span>
            </span>
          ) : (
            <>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]">
                <UserCheck className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
                <span className="hidden md:inline whitespace-nowrap">
                  {isAdmin ? 'Trainee:' : 'Colaboradora:'}
                </span>
                <select
                  value={activeCollaborator}
                  onChange={(e) => onChangeCollaborator(e.target.value)}
                  aria-label="Selecionar colaboradora em treinamento"
                  className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-bold text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
                >
                  {collaborators.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>

              {adding ? (
                <form onSubmit={handleSubmit} className="inline-flex items-center gap-1.5">
                  <input
                    type="text"
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Digite seu nome..."
                    aria-label="Nome da colaboradora"
                    className="w-36 rounded-lg border border-[var(--accent)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--ink)] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      setNewName('');
                    }}
                    aria-label="Cancelar"
                    className="h-6 w-6 rounded-md border border-[var(--line)] grid place-items-center text-[var(--muted)] hover:text-[var(--ink)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-semibold text-[var(--ink)] hover:border-[var(--accent)] whitespace-nowrap"
                >
                  <UserPlus className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span>{isAdmin ? 'Adicionar trainee' : 'Colocar meu nome'}</span>
                </button>
              )}
            </>
          )}

          {googleUser ? (
            <div
              title={`Conectada via Google: ${googleUser.email}`}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] pl-1.5 pr-2 py-1 text-xs"
            >
              {googleUser.photoURL ? (
                <img
                  src={googleUser.photoURL}
                  alt={googleUser.displayName}
                  referrerPolicy="no-referrer"
                  className="h-5 w-5 rounded-full object-cover shrink-0"
                />
              ) : (
                <span className="h-5 w-5 rounded-full bg-[var(--accent)] text-[var(--accent-ink)] text-[10px] font-bold grid place-items-center shrink-0">
                  {googleUser.displayName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="font-semibold text-[var(--ink)] max-w-[160px] truncate hidden sm:inline">
                {googleUser.displayName}
              </span>
              <button
                type="button"
                onClick={onGoogleSignOut}
                title="Sair da conta Google"
                aria-label="Sair da conta Google"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--danger)] pl-1 border-l border-[var(--line)]"
              >
                <LogOut className="h-3 w-3" />
                <span className="hidden lg:inline">Sair</span>
              </button>
            </div>
          ) : (
            <GoogleSignInButton
              size="sm"
              label="Acessar com o Google"
              loading={googleAuthLoading}
              onClick={onGoogleSignIn}
            />
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => onGoView('trainee')}
            title="Ver progresso do Programa Trainee"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs hover:border-[var(--accent)] transition-colors whitespace-nowrap"
          >
            <Award className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
            <span className="font-semibold text-[var(--ink)]">{summary.currentStageLabel}</span>
            <span className="text-[var(--muted)]">·</span>
            <span className="font-mono-num font-bold text-[var(--accent)]">
              {summary.completedStages}/{summary.totalStages} provas
            </span>
            <ChevronRight className="h-3 w-3 text-[var(--muted)]" />
          </button>

          <button
            type="button"
            onClick={() => onOpenQuickSim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap hover:brightness-105"
          >
            <Bot className="h-3.5 w-3.5 shrink-0" />
            <span>Simulador Rápido</span>
          </button>
        </div>
      </div>
    </header>
  );
}
