import React from 'react';
import { Loader2, ShieldCheck, X } from 'lucide-react';
import { ClickCannabisLogo } from './ClickCannabisLogo';

interface GoogleSignInButtonProps {
  onClick: () => void;
  loading?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function GoogleGIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      className={`${className} shrink-0 block`}
      aria-hidden="true"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

export function GoogleSignInButton({
  onClick,
  loading = false,
  label = 'Acessar com o Google',
  size = 'md',
  className = '',
}: GoogleSignInButtonProps) {
  const sizing =
    size === 'sm'
      ? 'px-2.5 py-1 text-xs rounded-lg gap-1.5'
      : size === 'lg'
        ? 'px-5 py-3 text-sm rounded-xl gap-2.5'
        : 'px-3.5 py-2 text-xs rounded-xl gap-2';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`gsi-material-button inline-flex items-center justify-center font-semibold bg-white text-[#1f1f1f] border border-[#cbd5e1] hover:bg-[#f8fafc] active:bg-[#f1f5f9] shadow-xs transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 ${sizing} ${className}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-[#4285F4] shrink-0" />
      ) : (
        <GoogleGIcon className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} />
      )}
      <span>{loading ? 'Conectando...' : label}</span>
    </button>
  );
}

interface GoogleAccessModalProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  onGoogleSignIn: () => void;
  onContinueWithoutLogin: () => void;
}

export function GoogleAccessModal({
  open,
  loading,
  error,
  onGoogleSignIn,
  onContinueWithoutLogin,
}: GoogleAccessModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-access-title"
      className="no-print fixed inset-0 z-[75] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="w-full max-w-[440px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-5 border-b border-[var(--line)] flex items-start justify-between gap-3">
          <div className="space-y-3">
            <ClickCannabisLogo subtitle="Academia Corporativa · Acesso" />
            <div>
              <h2 id="google-access-title" className="text-xl font-bold text-[var(--ink)]">
                Acessar Central de Treinamentos
              </h2>
              <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
                Entre com sua conta Google da Click para puxar seu perfil automaticamente e
                acessar simulações, treinamentos, notas das provas e reciclagem.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onContinueWithoutLogin}
            aria-label="Fechar janela de acesso"
            className="h-8 w-8 rounded-lg border border-[var(--line)] grid place-items-center text-[var(--muted)] hover:text-[var(--ink)] shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <GoogleSignInButton
            size="lg"
            label="Acessar com o Google"
            loading={loading}
            onClick={onGoogleSignIn}
            className="w-full"
          />

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] px-3.5 py-2.5 text-xs text-[var(--danger)]"
            >
              {error}
            </div>
          )}

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-[var(--muted)]">
            <ShieldCheck className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Seu nome e e-mail do Google são usados apenas para identificar sua ficha individual e
              salvar seu progresso de treinamento.
            </p>
          </div>

          <button
            type="button"
            onClick={onContinueWithoutLogin}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] py-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--accent)] transition-colors"
          >
            Continuar sem conta Google (escolher nome manualmente)
          </button>
        </div>
      </div>
    </div>
  );
}
