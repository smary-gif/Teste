import React from 'react';
import {
  Award,
  Bot,
  Calendar,
  CheckCircle2,
  Columns3,
  Heart,
  LayoutList,
  ListChecks,
  Lock,
  LogOut,
  Moon,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { ADMIN_DIRECTORY } from '../data/defaults';
import type { GoogleAuthProfile } from '../lib/googleAuth';
import type { AppView } from '../types';
import { ClickCannabisLogo } from './ClickCannabisLogo';
import { GoogleSignInButton } from './GoogleSignInButton';

interface SidebarProps {
  currentView: AppView;
  onSelectView: (view: AppView) => void;
  portalName: string;
  portalSub: string;
  isAdmin: boolean;
  activeAdminLabel?: string | null;
  onSelectAdminLabel?: (label: string) => void;
  onToggleRole: () => void;
  traineeUnlocked: boolean;
  darkMode: boolean;
  onToggleTheme: () => void;
  traineeName: string;
  collaborators: string[];
  onChangeTraineeName: (name: string) => void;
  googleUser: GoogleAuthProfile | null;
  googleAuthLoading: boolean;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
}

interface NavItemDef {
  id: AppView;
  label: string;
  icon: React.ReactNode;
  section?: string;
  adminOnly?: boolean;
  requiresTraineeUnlock?: boolean;
}

const NAV_ITEMS: NavItemDef[] = [
  {
    id: 'trainee',
    label: 'Treinamento Trainee (3 dias)',
    icon: <Award className="h-4 w-4 shrink-0" />,
    section: 'Programa Trainee',
    requiresTraineeUnlock: true,
  },
  {
    id: 'reciclagem',
    label: 'Reciclagem (Veteranas)',
    icon: <RefreshCw className="h-4 w-4 shrink-0" />,
  },
  {
    id: 'simulacao',
    label: 'Simulador de IA (Treino)',
    icon: <Bot className="h-4 w-4 shrink-0" />,
  },
  {
    id: 'subsetores',
    label: 'Passo a Passo Subsetores',
    icon: <ListChecks className="h-4 w-4 shrink-0" />,
  },
  {
    id: 'trilha',
    label: 'Trilha de Integração',
    icon: <LayoutList className="h-4 w-4 shrink-0" />,
  },
  {
    id: 'treinamento',
    label: 'Cronograma Semanal',
    icon: <Calendar className="h-4 w-4 shrink-0" />,
  },
  {
    id: 'apadrinhamento',
    label: 'Portal de Apadrinhamento',
    icon: <Heart className="h-4 w-4 shrink-0" />,
  },
  {
    id: 'solicitacoes',
    label: 'Solicitações',
    icon: <Columns3 className="h-4 w-4 shrink-0" />,
    section: 'Operação Simulada',
  },
  {
    id: 'confirmacao',
    label: 'Confirmação',
    icon: <CheckCircle2 className="h-4 w-4 shrink-0" />,
  },
  {
    id: 'consultas',
    label: 'Consultas',
    icon: <Calendar className="h-4 w-4 shrink-0" />,
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: <Columns3 className="h-4 w-4 shrink-0" />,
  },
  {
    id: 'administracao',
    label: 'Administração',
    icon: <Settings className="h-4 w-4 shrink-0" />,
    section: 'Gestão',
    adminOnly: true,
  },
];

export function Sidebar({
  currentView,
  onSelectView,
  portalName,
  portalSub,
  isAdmin,
  activeAdminLabel,
  onSelectAdminLabel,
  onToggleRole,
  traineeUnlocked,
  darkMode,
  onToggleTheme,
  traineeName,
  collaborators,
  onChangeTraineeName,
  googleUser,
  googleAuthLoading,
  onGoogleSignIn,
  onGoogleSignOut,
}: SidebarProps) {
  const lockGoogleSelect = Boolean(googleUser) && !isAdmin;

  return (
    <aside
      className="no-print bg-[var(--nav)] text-[var(--nav-ink)] flex md:flex-col gap-1 px-3 py-2.5 md:py-5 md:px-3.5 md:sticky md:top-0 md:h-screen overflow-x-auto md:overflow-y-auto shrink-0 border-b md:border-b-0 md:border-r border-[#1c402a]"
      aria-label="Navegação principal"
    >
      <div className="hidden md:flex flex-col gap-2 px-1.5 pb-3.5 border-b border-[rgba(143,232,156,0.14)]">
        <ClickCannabisLogo onDark subtitle={portalName} />
        <p className="text-[11px] text-[var(--nav-muted)] truncate pl-1">{portalSub}</p>
      </div>

      <div className="flex md:flex-col gap-1 md:mt-2 flex-1">
        {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
          const active = currentView === item.id;
          const isLocked = Boolean(item.requiresTraineeUnlock && !traineeUnlocked && !isAdmin);
          return (
            <React.Fragment key={item.id}>
              {item.section && (
                <p className="hidden md:block text-[10px] font-bold uppercase tracking-wider text-[var(--nav-muted)] px-2.5 pt-3 pb-1">
                  {item.section}
                </p>
              )}
              <button
                type="button"
                onClick={() => onSelectView(item.id)}
                data-coach={`nav-${item.id}`}
                title={
                  isLocked
                    ? `${item.label} bloqueado com cadeado — conclua a Trilha de Integração ou a Reciclagem para desbloquear`
                    : undefined
                }
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors text-left ${
                  active
                    ? 'bg-[var(--mint)] text-[#0f2a1b] font-semibold'
                    : isLocked
                      ? 'text-[var(--nav-muted)] hover:bg-[rgba(143,232,156,0.08)]'
                      : 'text-[var(--nav-ink)] hover:bg-[rgba(143,232,156,0.12)]'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
                {isLocked && <Lock className="h-3.5 w-3.5 text-amber-400 ml-auto shrink-0" />}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <div className="hidden md:flex flex-col gap-2.5 pt-3 mt-3 border-t border-[rgba(143,232,156,0.14)]">
        <div className="px-1">
          {googleUser ? (
            <div className="rounded-lg bg-[#102d1d] border border-[rgba(143,232,156,0.25)] px-2.5 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {googleUser.photoURL ? (
                  <img
                    src={googleUser.photoURL}
                    alt={googleUser.displayName}
                    referrerPolicy="no-referrer"
                    className="h-6 w-6 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <span className="h-6 w-6 rounded-full bg-[var(--mint)] text-[#0f2a1b] text-[11px] font-bold grid place-items-center shrink-0">
                    {googleUser.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--nav-ink)] truncate">
                    {googleUser.displayName}
                  </p>
                  <p className="text-[10px] text-[var(--nav-muted)] truncate">
                    {isAdmin ? 'Administração · Google' : googleUser.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onGoogleSignOut}
                title="Sair da conta Google"
                aria-label="Sair da conta Google"
                className="h-6 w-6 rounded-md grid place-items-center text-[var(--nav-muted)] hover:text-white shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <GoogleSignInButton
              size="sm"
              label="Acessar com o Google"
              loading={googleAuthLoading}
              onClick={onGoogleSignIn}
              className="w-full"
            />
          )}
        </div>

        <div className="px-1">
          <span className="block text-[10px] font-semibold text-[var(--nav-muted)] mb-1">
            {isAdmin ? 'Acompanhar trainee' : 'Colaboradora ativa'}
          </span>
          {lockGoogleSelect ? (
            <div className="w-full rounded-lg bg-[#102d1d] border border-[rgba(143,232,156,0.25)] px-2.5 py-1.5 text-xs font-semibold text-[var(--nav-ink)] truncate">
              {traineeName}
            </div>
          ) : (
            <select
              value={traineeName}
              onChange={(e) => onChangeTraineeName(e.target.value)}
              aria-label="Selecionar colaboradora ativa"
              className="w-full rounded-lg bg-[#102d1d] border border-[rgba(143,232,156,0.25)] px-2.5 py-1.5 text-xs text-[var(--nav-ink)] focus:outline-none focus:border-[var(--mint)]"
            >
              {collaborators.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </div>

        {isAdmin && onSelectAdminLabel && !googleUser && (
          <div className="px-1">
            <span className="block text-[10px] font-semibold text-[var(--nav-muted)] mb-1">
              ADM logada
            </span>
            <select
              value={activeAdminLabel || ADMIN_DIRECTORY[0].label}
              onChange={(e) => onSelectAdminLabel(e.target.value)}
              aria-label="Selecionar administradora ativa"
              className="w-full rounded-lg bg-[#102d1d] border border-[rgba(143,232,156,0.25)] px-2.5 py-1.5 text-xs text-[var(--mint)] font-semibold focus:outline-none focus:border-[var(--mint)]"
            >
              {ADMIN_DIRECTORY.map((adm) => (
                <option key={adm.id} value={adm.label}>
                  {adm.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            onClick={onToggleRole}
            title="Alternar entre perfil Trainee e Administração (Stephanye/Smary, Andréia, Iris, Kat)"
            className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap transition-colors truncate ${
              isAdmin
                ? 'bg-[var(--mint)] text-[#0f2a1b]'
                : 'bg-[rgba(143,232,156,0.16)] text-[var(--mint)] hover:bg-[rgba(143,232,156,0.25)]'
            }`}
          >
            {isAdmin && <ShieldCheck className="h-3 w-3 shrink-0" />}
            <span className="truncate">
              {isAdmin ? `ADM · ${activeAdminLabel || 'Liderança'}` : 'Perfil: Trainee'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={darkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}
            title={darkMode ? 'Tema claro' : 'Tema escuro'}
            className="h-8 w-8 rounded-lg grid place-items-center border border-[rgba(143,232,156,0.2)] text-[var(--nav-ink)] hover:border-[var(--mint)] shrink-0"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
