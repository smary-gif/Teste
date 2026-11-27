import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminView } from './components/AdminView';
import { CoachOverlay } from './components/CoachOverlay';
import { ConfirmationBoardView } from './components/ConfirmationBoardView';
import { ConsultationsView } from './components/ConsultationsView';
import { CrmView } from './components/CrmView';
import { GoogleAccessModal } from './components/GoogleSignInButton';
import { IntegrationTrackView, type TrilhaStore } from './components/IntegrationTrackView';
import { MentorshipView } from './components/MentorshipView';
import { NegotiationModal } from './components/NegotiationModal';
import { PhoneDialerOverlay } from './components/PhoneDialerOverlay';
import { QuickSimulatorDrawer } from './components/QuickSimulatorDrawer';
import { ReciclagemView } from './components/ReciclagemView';
import { ScheduleView } from './components/ScheduleView';
import { Sidebar } from './components/Sidebar';
import { SimulatorView } from './components/SimulatorView';
import { SolicitationDrawer, type SolFormState } from './components/SolicitationDrawer';
import { SolicitationsView } from './components/SolicitationsView';
import { SubsectorsView } from './components/SubsectorsView';
import { TopEnterpriseBar } from './components/TopEnterpriseBar';
import { TraineeView } from './components/TraineeView';
import {
  initGoogleAuth,
  resolveCollaboratorFromGoogle,
  signInWithGoogle,
  signOutGoogle,
  type GoogleAuthProfile,
} from './lib/googleAuth';
import {
  canonicalPersonKey,
  computeTraineeSummary,
  createInitialReciclagemByPerson,
  createInitialTraineeByPerson,
  DEFAULT_CONFIG,
  DEFAULT_LEADERSHIP,
  EMPTY_RECICLAGEM_PROGRESS,
  EMPTY_TRAINEE_PROGRESS,
  getCollaboratorList,
  TRAIN_DEPTS,
  generateConsultations,
  generatePatients,
} from './data/defaults';
import { buildTourSteps } from './data/tours';
import type {
  AiVoiceProfile,
  AppView,
  AtendTabKey,
  CoachStep,
  ConsultationRow,
  CronoRecord,
  EditableVideoScript,
  MentorshipChatMsg,
  MentorshipComment,
  PatientCase,
  PortalConfig,
  ReciclagemPersonProgress,
  SharedPortalContent,
  SolStatus,
  TraineeProgressStore,
} from './types';
import { ATEND_TAB, deptKey, nowTime } from './utils/helpers';

function loadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

const SOL_LABEL: Record<SolStatus, string> = {
  pendente: 'Pendente',
  intervencao: 'Intervenção',
  medico: 'Solicitado ao médico',
  atraso: 'Em atraso',
  concluido: 'Concluído',
};

export default function App() {
  const [cfg, setCfg] = useState<PortalConfig>(() => {
    const saved = loadStorage<Partial<PortalConfig>>('ct_cfg_v1', {});
    const needsTrainerUpdate =
      !saved.madrinha?.nome || saved.madrinha.nome === 'Stephanye';
    return {
      ...DEFAULT_CONFIG,
      ...saved,
      lideranca: {
        ...DEFAULT_LEADERSHIP,
        ...(saved.lideranca || {}),
        treinadora: saved.lideranca?.treinadora || DEFAULT_LEADERSHIP.treinadora,
      },
      madrinha: needsTrainerUpdate
        ? DEFAULT_CONFIG.madrinha
        : { ...DEFAULT_CONFIG.madrinha, ...(saved.madrinha || {}) },
      templates: { ...DEFAULT_CONFIG.templates, ...(saved.templates || {}) },
    };
  });

  const [customCollaborators, setCustomCollaborators] = useState<string[]>(() =>
    loadStorage<string[]>('ct_custom_collabs_v1', [])
  );

  const collaborators = useMemo(() => {
    const base = getCollaboratorList(cfg);
    const seen = new Set(base.map((n) => canonicalPersonKey(n)));
    const merged = [...base];
    ['Smary', ...customCollaborators].forEach((n) => {
      const clean = n.trim();
      if (!clean) return;
      const key = canonicalPersonKey(clean);
      if (!seen.has(key)) {
        seen.add(key);
        merged.unshift(clean);
      }
    });
    return merged;
  }, [cfg, customCollaborators]);

  const [darkMode, setDarkMode] = useState<boolean>(() =>
    loadStorage<boolean>('ct_theme_v1', false)
  );
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const [activeCollaborator, setActiveCollaborator] = useState<string>(() => {
    const saved = loadStorage<string>('ct_active_collab_v1', '');
    if (saved) return saved;
    return 'Smary';
  });

  const [view, setView] = useState<AppView>('trainee');
  const [patients, setPatients] = useState<PatientCase[]>(() => generatePatients(cfg));
  const [consultations, setConsultations] = useState<ConsultationRow[]>(() =>
    generateConsultations(patients)
  );
  const [selectedId, setSelectedId] = useState<string>('solicitacoes0');
  const [deptFilter, setDeptFilter] = useState<string>('Solicitações');
  const [listTab, setListTab] = useState<AtendTabKey>('abertos');
  const [aiConfigured, setAiConfigured] = useState<boolean>(false);
  const [googleUser, setGoogleUser] = useState<GoogleAuthProfile | null>(null);
  const [googleAuthLoading, setGoogleAuthLoading] = useState<boolean>(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);
  const [googleModalOpen, setGoogleModalOpen] = useState<boolean>(false);

  const [traineeByPerson, setTraineeByPerson] = useState<
    Record<string, TraineeProgressStore>
  >(() => {
    const savedMap = loadStorage<Record<string, TraineeProgressStore> | null>(
      'ct_trn_by_person_v2',
      null
    );
    if (savedMap) return savedMap;
    const base = createInitialTraineeByPerson(cfg);
    // Migrate legacy single progress if present
    const legacy = loadStorage<TraineeProgressStore | null>('ct_trn_v1', null);
    if (legacy) {
      const firstKey = getCollaboratorList(cfg)[0] || 'Rayssa';
      base[firstKey] = {
        ...EMPTY_TRAINEE_PROGRESS(),
        ...legacy,
      };
    }
    return base;
  });

  const [trilhaData, setTrilhaData] = useState<Record<string, TrilhaStore>>(() =>
    loadStorage<Record<string, TrilhaStore>>('ct_trilha_v1', {})
  );
  const [cronoRecords, setCronoRecords] = useState<Record<string, CronoRecord>>(() =>
    loadStorage<Record<string, CronoRecord>>('ct_crono_v1', {})
  );
  const [mentorshipComments, setMentorshipComments] = useState<
    Record<string, MentorshipComment[]>
  >(() => loadStorage<Record<string, MentorshipComment[]>>('ct_apad_v1', {}));
  const [mentorshipChats, setMentorshipChats] = useState<
    Record<string, MentorshipChatMsg[]>
  >(() => loadStorage<Record<string, MentorshipChatMsg[]>>('ct_mchat_v1', {}));
  const [reciclagemByPerson, setReciclagemByPerson] = useState<
    Record<string, ReciclagemPersonProgress>
  >(() => {
    const saved = loadStorage<Record<string, ReciclagemPersonProgress> | null>(
      'ct_reciclagem_v1',
      null
    );
    return saved || createInitialReciclagemByPerson(cfg);
  });

  const [voiceProfile, setVoiceProfile] = useState<AiVoiceProfile | null>(() =>
    loadStorage<AiVoiceProfile | null>('ct_ai_voice_profile_v1', null)
  );
  const [teamSubsectors, setTeamSubsectors] = useState<Record<string, string>>(() =>
    loadStorage<Record<string, string>>('ct_team_subs_v1', {})
  );
  const [videoOverrides, setVideoOverrides] = useState<Record<string, EditableVideoScript>>({});
  const [sharedSceneAudios, setSharedSceneAudios] = useState<Record<string, string>>({});
  const [sharedVoiceProfile, setSharedVoiceProfile] = useState<AiVoiceProfile | null>(null);

  const handleUpdateVoiceProfile = useCallback((next: AiVoiceProfile | null) => {
    setVoiceProfile(next);
    saveStorage('ct_ai_voice_profile_v1', next);
  }, []);

  const persistSharedContent = useCallback(async (patch: Partial<SharedPortalContent>) => {
    try {
      await fetch('/api/shared/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } catch {
      // ignore offline save failures cleanly
    }
  }, []);

  const [solDrawerForm, setSolDrawerForm] = useState<SolFormState | null>(null);
  const [crmNegPatientId, setCrmNegPatientId] = useState<string | null>(null);
  const [pendingCallPatient, setPendingCallPatient] = useState<PatientCase | null>(null);
  const [dialerState, setDialerState] = useState<{ open: boolean; patient: PatientCase | null }>({
    open: false,
    patient: null,
  });
  const [quickSim, setQuickSim] = useState<{
    open: boolean;
    deptKey?: string;
    patientId?: string;
  }>({ open: false });

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [coachState, setCoachState] = useState<{
    active: boolean;
    steps: CoachStep[];
    index: number;
    doneMsg: string;
  }>({ active: false, steps: [], index: 0, doneMsg: '' });

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 3400);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    saveStorage('ct_theme_v1', darkMode);
  }, [darkMode]);

  useEffect(() => {
    document.title = `ClickCannabis · ${cfg.portalNome}`;
  }, [cfg.portalNome]);

  useEffect(() => {
    fetch('/api/ai/status')
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => setAiConfigured(Boolean(d.configured)))
      .catch(() => setAiConfigured(false));
  }, []);

  useEffect(() => {
    fetch('/api/shared/content')
      .then((r) => r.json())
      .then((data: SharedPortalContent) => {
        if (data.cfg) {
          setCfg((prev) => ({
            ...prev,
            ...data.cfg,
            templates: { ...prev.templates, ...(data.cfg?.templates || {}) },
          }));
        }
        if (data.teamSubsectors) {
          setTeamSubsectors(data.teamSubsectors);
          saveStorage('ct_team_subs_v1', data.teamSubsectors);
        }
        if (data.videoOverrides) {
          setVideoOverrides(data.videoOverrides);
        }
        if (data.sceneAudioUrls) {
          setSharedSceneAudios(data.sceneAudioUrls);
        }
        if (data.sharedVoiceProfile !== undefined) {
          setSharedVoiceProfile(data.sharedVoiceProfile);
        }
      })
      .catch(() => undefined);
  }, []);

  const activeProgress: TraineeProgressStore =
    traineeByPerson[activeCollaborator] || EMPTY_TRAINEE_PROGRESS();

  const traineeSummary = useMemo(
    () => computeTraineeSummary(activeProgress, trilhaData[activeCollaborator]),
    [activeProgress, trilhaData, activeCollaborator]
  );

  const handleChangeCollaborator = useCallback(
    (name: string) => {
      setActiveCollaborator(name);
      saveStorage('ct_active_collab_v1', name);
      setTraineeByPerson((prev) => {
        if (prev[name]) return prev;
        const next = { ...prev, [name]: EMPTY_TRAINEE_PROGRESS() };
        saveStorage('ct_trn_by_person_v2', next);
        return next;
      });
      showToast(`Processo individual ativo: ${name}`);
    },
    [showToast]
  );

  const handleAddCollaborator = useCallback(
    (rawName: string) => {
      const clean = rawName.trim();
      if (!clean) return;
      const targetKey = canonicalPersonKey(clean);
      const existing = collaborators.find(
        (c) => canonicalPersonKey(c) === targetKey
      );
      const targetName = existing || clean;
      if (!existing) {
        setCustomCollaborators((prev) => {
          const next = [
            clean,
            ...prev.filter((x) => canonicalPersonKey(x) !== targetKey),
          ];
          saveStorage('ct_custom_collabs_v1', next);
          return next;
        });
      }
      setActiveCollaborator(targetName);
      saveStorage('ct_active_collab_v1', targetName);
      setTraineeByPerson((prev) => {
        if (prev[targetName]) return prev;
        const next = { ...prev, [targetName]: EMPTY_TRAINEE_PROGRESS() };
        saveStorage('ct_trn_by_person_v2', next);
        return next;
      });
      setReciclagemByPerson((prev) => {
        if (prev[targetName]) return prev;
        const next = { ...prev, [targetName]: EMPTY_RECICLAGEM_PROGRESS(targetName) };
        saveStorage('ct_reciclagem_v1', next);
        return next;
      });
      showToast(`Processo individual vinculado a ${targetName}.`);
    },
    [collaborators, showToast]
  );

  const collaboratorsRef = useRef(collaborators);
  collaboratorsRef.current = collaborators;

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (profile) => {
        setGoogleUser(profile);
        setGoogleAuthError(null);
        setGoogleModalOpen(false);
        const savedCollab = loadStorage<string>('ct_active_collab_v1', '');
        if (!savedCollab) {
          const matched = resolveCollaboratorFromGoogle(profile, collaboratorsRef.current);
          handleAddCollaborator(matched);
        }
      },
      () => {
        setGoogleUser(null);
        let dismissed = false;
        try {
          dismissed = sessionStorage.getItem('ct_google_gate_dismissed') === '1';
        } catch {
          dismissed = false;
        }
        if (!dismissed) {
          setGoogleModalOpen(true);
        }
      }
    );
    return unsubscribe;
  }, [handleAddCollaborator]);

  const handleGoogleSignIn = useCallback(async () => {
    setGoogleAuthLoading(true);
    setGoogleAuthError(null);
    try {
      const { profile } = await signInWithGoogle();
      setGoogleUser(profile);
      setGoogleModalOpen(false);
      try {
        sessionStorage.setItem('ct_google_gate_dismissed', '1');
      } catch {
        // ignore storage restrictions
      }
      const matched = resolveCollaboratorFromGoogle(profile, collaboratorsRef.current);
      handleAddCollaborator(matched);
      showToast(`Acesso Google conectado: ${profile.displayName} (${matched})`);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const message =
        code === 'auth/popup-blocked'
          ? 'Pop-up bloqueado pelo navegador. Permita pop-ups para acessar com o Google.'
          : code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
            ? 'Login com Google cancelado antes da conclusão.'
            : code === 'auth/unauthorized-domain'
              ? 'Domínio não autorizado nas configurações de autenticação do Google.'
              : 'Não foi possível concluir o acesso com o Google. Tente novamente.';
      setGoogleAuthError(message);
      showToast(message);
    } finally {
      setGoogleAuthLoading(false);
    }
  }, [handleAddCollaborator, showToast]);

  const handleGoogleSignOut = useCallback(async () => {
    try {
      await signOutGoogle();
      setGoogleUser(null);
      showToast('Conta Google desconectada.');
    } catch {
      showToast('Erro ao desconectar a conta Google.');
    }
  }, [showToast]);

  const handleDismissGoogleModal = useCallback(() => {
    setGoogleModalOpen(false);
    setGoogleAuthError(null);
    try {
      sessionStorage.setItem('ct_google_gate_dismissed', '1');
    } catch {
      // ignore storage restrictions
    }
  }, []);

  const handleSelectView = (nextView: AppView) => {
    if (nextView === 'administracao' && !isAdmin) {
      setView('trainee');
      return;
    }
    setView(nextView);
  };

  const handleResetSim = () => {
    const freshPatients = generatePatients(cfg);
    setPatients(freshPatients);
    setConsultations(generateConsultations(freshPatients));
    setDeptFilter('Solicitações');
    setListTab('abertos');
    setSelectedId('solicitacoes0');
    showToast('Simulação reiniciada.');
  };

  const handleUpdateConfig = (nextCfg: PortalConfig) => {
    const countChanged = nextCfg.pacientesSimulados !== cfg.pacientesSimulados;
    setCfg(nextCfg);
    saveStorage('ct_cfg_v1', nextCfg);
    if (countChanged) {
      const fresh = generatePatients(nextCfg);
      setPatients(fresh);
      setConsultations(generateConsultations(fresh));
    }
  };

  const handleUpdateTraineeProgress = useCallback(
    (next: TraineeProgressStore) => {
      setTraineeByPerson((prev) => {
        const updated = { ...prev, [activeCollaborator]: next };
        saveStorage('ct_trn_by_person_v2', updated);
        return updated;
      });
    },
    [activeCollaborator]
  );

  const handleSignalPractice = useCallback(
    (signalId: string) => {
      setTraineeByPerson((prev) => {
        const cur = prev[activeCollaborator] || EMPTY_TRAINEE_PROGRESS();
        if (cur.simSignals[signalId] && cur.prac[signalId]) return prev;
        const updatedPerson: TraineeProgressStore = {
          ...cur,
          simSignals: { ...cur.simSignals, [signalId]: true },
          prac: { ...cur.prac, [signalId]: true },
        };
        const nextMap = { ...prev, [activeCollaborator]: updatedPerson };
        saveStorage('ct_trn_by_person_v2', nextMap);
        return nextMap;
      });
    },
    [activeCollaborator]
  );

  const handleCaseEvaluated = useCallback(
    (approved: boolean) => {
      setTraineeByPerson((prev) => {
        const cur = prev[activeCollaborator] || EMPTY_TRAINEE_PROGRESS();
        const updatedPerson: TraineeProgressStore = {
          ...cur,
          aiCasesEvaluated: (cur.aiCasesEvaluated || 0) + 1,
          aiCasesApproved: (cur.aiCasesApproved || 0) + (approved ? 1 : 0),
        };
        const nextMap = { ...prev, [activeCollaborator]: updatedPerson };
        saveStorage('ct_trn_by_person_v2', nextMap);
        return nextMap;
      });
    },
    [activeCollaborator]
  );

  const handleOpenQuickSim = useCallback((deptKeyArg?: string, patientIdArg?: string) => {
    setQuickSim({ open: true, deptKey: deptKeyArg || 'geral', patientId: patientIdArg });
  }, []);

  const handleLaunchPractice = (deptKeyArg?: string, patientIdArg?: string) => {
    if (patientIdArg) {
      const target = patients.find((p) => p.id === patientIdArg);
      if (target) {
        setDeptFilter(target.dept);
        setSelectedId(target.id);
        setListTab(ATEND_TAB[target.atend]);
        setView('simulacao');
        return;
      }
    }
    if (deptKeyArg) {
      const match = TRAIN_DEPTS.find((d) => d.key === deptKeyArg);
      if (match) {
        setDeptFilter(match.nome);
        const firstInDept = patients.find((p) => p.key === deptKeyArg);
        if (firstInDept) {
          setSelectedId(firstInDept.id);
          setListTab(ATEND_TAB[firstInDept.atend]);
        }
      }
    }
    setView('simulacao');
  };

  const handleStartTour = (tourKey: string) => {
    const freshPatients = generatePatients(cfg);
    setPatients(freshPatients);
    setConsultations(generateConsultations(freshPatients));
    setDeptFilter('Solicitações');
    setListTab('abertos');

    const tour = buildTourSteps(tourKey, freshPatients);
    if (!tour) return;

    setSelectedId(tour.initialPatientId);
    setView('simulacao');
    setCoachState({
      active: true,
      steps: tour.steps,
      index: 0,
      doneMsg: tour.doneMsg,
    });
  };

  const handleAdvanceCoach = useCallback(() => {
    setCoachState((prev) => {
      if (!prev.active) return prev;
      const nextIdx = prev.index + 1;
      if (nextIdx >= prev.steps.length) {
        if (prev.doneMsg) showToast(prev.doneMsg);
        return { active: false, steps: [], index: 0, doneMsg: '' };
      }
      return { ...prev, index: nextIdx };
    });
  }, [showToast]);

  const handleCoachSignal = useCallback(
    (sigName: string) => {
      if (!coachState.active) return;
      const cur = coachState.steps[coachState.index];
      if (cur?.sig === sigName) {
        handleAdvanceCoach();
      }
    },
    [coachState, handleAdvanceCoach]
  );

  const handleOpenPatientFromOutside = (patientId: string) => {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return;
    setSelectedId(patientId);
    setListTab(ATEND_TAB[p.atend]);
    if (
      deptKey(deptFilter) !== 'todos' &&
      deptKey(deptFilter) !== deptKey(p.dept)
    ) {
      setDeptFilter('Todos');
    }
    setView('simulacao');
  };

  const handleOpenSolModal = (patientId: string | null, mode: 'new' | 'edit') => {
    if (mode === 'edit' && patientId) {
      const p = patients.find((x) => x.id === patientId);
      if (!p || !p.sol) return;
      setSolDrawerForm({
        mode: 'edit',
        pid: p.id,
        motivo: p.sol.tipo,
        medico: p.sol.medico,
        urg: p.sol.urg,
        receita: p.sol.receita || '',
        obs: p.sol.obs || '',
        anexos: p.sol.anexos.slice(),
      });
      return;
    }

    const p = patientId ? patients.find((x) => x.id === patientId) : undefined;
    setSolDrawerForm({
      mode: 'new',
      pid: p ? p.id : '',
      motivo: p?.sc.tipo || '',
      medico: p ? p.medico : '',
      urg: false,
      receita: '',
      obs: '',
      anexos: [],
    });
  };

  const handleSaveSolicitation = (form: SolFormState) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== form.pid) return p;
        if (form.mode === 'new') {
          return {
            ...p,
            tipo: form.motivo,
            sol: {
              tipo: form.motivo,
              medico: form.medico,
              urg: form.urg,
              receita: form.receita,
              obs: form.obs,
              anexos: form.anexos.slice(),
              st: 'pendente',
              h: ['Solicitação criada'],
            },
            msgs: [
              ...p.msgs,
              {
                id: `sol_${Date.now()}`,
                from: 'evt',
                text: `Solicitação criada: ${form.motivo} · ${form.medico}`,
                t: nowTime(),
              },
            ],
          };
        }

        const existing = p.sol!;
        const history = [...existing.h];
        const extraMsgs = [...p.msgs];
        if (existing.tipo !== form.motivo) {
          history.push(`Motivo alterado: ${existing.tipo} → ${form.motivo}`);
          extraMsgs.push({
            id: `sol_t_${Date.now()}`,
            from: 'evt',
            text: `Motivo alterado: ${existing.tipo} → ${form.motivo}`,
            t: nowTime(),
          });
        }
        if (existing.medico !== form.medico) {
          history.push(`Médico alterado: ${existing.medico} → ${form.medico}`);
        }
        if (existing.urg !== form.urg) {
          history.push(form.urg ? 'Marcada como urgente' : 'Urgência removida');
        }
        if (existing.obs !== form.obs) {
          history.push('Observações editadas');
        }
        return {
          ...p,
          tipo: form.motivo,
          msgs: extraMsgs,
          sol: {
            ...existing,
            tipo: form.motivo,
            medico: form.medico,
            urg: form.urg,
            receita: form.receita,
            obs: form.obs,
            anexos: form.anexos.slice(),
            h: history,
          },
        };
      })
    );

    setSolDrawerForm(null);
    if (form.mode === 'new') {
      handleSignalPractice('d3_2');
      showToast('Solicitação criada em Pendente.');
    } else {
      showToast('Solicitação atualizada.');
    }
  };

  const handleMoveSolStatus = (patientId: string, nextSt: SolStatus) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId || !p.sol || p.sol.st === nextSt) return p;
        const msg = `Solicitação: ${SOL_LABEL[p.sol.st]} → ${SOL_LABEL[nextSt]}`;
        showToast(msg);
        if (nextSt === 'concluido') {
          handleSignalPractice('d3_0');
        }
        return {
          ...p,
          sol: {
            ...p.sol,
            st: nextSt,
            h: [...p.sol.h, SOL_LABEL[nextSt]],
          },
          msgs: [
            ...p.msgs,
            { id: `solm_${Date.now()}`, from: 'evt', text: msg, t: nowTime() },
          ],
        };
      })
    );
  };

  const chatTargets = useMemo(
    () =>
      patients
        .filter((p) => !p.isMed)
        .map((p) => ({
          id: p.id,
          nome: p.nome,
          proc: p.proc,
          dept: p.dept,
          medico: p.medico,
          data: p.data,
          hora: p.hora,
        })),
    [patients]
  );

  const handleSyncConsultationFromPatient = useCallback(
    (
      patientId: string,
      patch: {
        dateKey?: string;
        dataBr?: string;
        hora?: string;
        medico?: string;
        status?: string;
      }
    ) => {
      setConsultations((prev) =>
        prev.map((r) => (r.pid === patientId ? { ...r, ...patch } : r))
      );
    },
    []
  );

  const handleForwardToChat = useCallback(
    (patientId: string, text: string, label: string, openChat?: boolean) => {
      const target = patients.find((p) => p.id === patientId);
      setPatients((prev) =>
        prev.map((p) =>
          p.id !== patientId
            ? p
            : {
                ...p,
                opCount: p.opCount + 1,
                msgs: [
                  ...p.msgs,
                  {
                    id: `fwd_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                    from: 'op',
                    label,
                    text,
                    t: nowTime(),
                  },
                ],
              }
        )
      );
      showToast(`${label} encaminhado no chat${target ? ` de ${target.first}` : ''}.`);
      if (openChat) {
        handleOpenPatientFromOutside(patientId);
      }
    },
    [patients, showToast]
  );

  const handleUpdateConsultation = useCallback(
    (
      rowId: string,
      patch: Partial<ConsultationRow>,
      opts?: {
        evtText?: string;
        markPractice?: string;
        chatMessage?: { patientId: string; text: string; label: string };
      }
    ) => {
      const targetRow = consultations.find((r) => r.id === rowId);
      setConsultations((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r))
      );

      const linkedPid = targetRow?.pid;
      const chatMsg = opts?.chatMessage;

      if (linkedPid || chatMsg) {
        setPatients((prev) =>
          prev.map((p) => {
            const isLinked = Boolean(linkedPid && p.id === linkedPid);
            const isChatTarget = Boolean(chatMsg && p.id === chatMsg.patientId);
            if (!isLinked && !isChatTarget) return p;

            const extraMsgs = [...p.msgs];
            if (isLinked && opts?.evtText) {
              extraMsgs.push({
                id: `cevt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                from: 'evt',
                text: opts.evtText,
                t: nowTime(),
              });
            }
            if (isChatTarget && chatMsg) {
              extraMsgs.push({
                id: `cmsg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                from: 'op',
                label: chatMsg.label,
                text: chatMsg.text,
                t: nowTime(),
              });
            }

            return {
              ...p,
              data: isLinked && patch.dataBr ? patch.dataBr.replaceAll('/', '-') : p.data,
              hora: isLinked && patch.hora ? patch.hora : p.hora,
              medico: isLinked && patch.medico ? patch.medico : p.medico,
              status: isLinked && patch.status ? patch.status : p.status,
              opCount: isChatTarget ? p.opCount + 1 : p.opCount,
              msgs: extraMsgs,
            };
          })
        );
      }

      if (opts?.markPractice) {
        handleSignalPractice(opts.markPractice);
      }
    },
    [consultations, handleSignalPractice]
  );

  const handleRequestCall = useCallback((patient: PatientCase) => {
    setPendingCallPatient(patient);
  }, []);

  const handleConfirmCall = useCallback(
    (patient: PatientCase) => {
      setPendingCallPatient(null);
      setDialerState({ open: true, patient });
      showToast(`Ligando para ${patient.nome} (${patient.tel})...`);
    },
    [showToast]
  );

  const handleLogCallResult = useCallback(
    (patient: PatientCase, outcome: 'Atendeu' | 'Sem resposta', durationSecs: number) => {
      const mm = Math.floor(durationSecs / 60);
      const ss = durationSecs % 60;
      const durLabel = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
      const noteText =
        outcome === 'Atendeu'
          ? `Ligação atendida (${durLabel}) para ${patient.tel}`
          : `Tentativa de ligação sem resposta (${patient.tel})`;

      setPatients((prev) =>
        prev.map((p) =>
          p.id !== patient.id
            ? p
            : {
                ...p,
                notas: [
                  ...p.notas,
                  { id: `call_${Date.now()}`, tipo: 'Nota', text: noteText, t: nowTime() },
                ],
                msgs: [
                  ...p.msgs,
                  { id: `callevt_${Date.now()}`, from: 'evt', text: noteText, t: nowTime() },
                ],
              }
        )
      );
      showToast(`${outcome}: ${noteText}`);
    },
    [showToast]
  );

  const handleUpdateConsultationStatusByPatient = useCallback(
    (patientId: string, nextStatus: string) => {
      setPatients((prev) =>
        prev.map((p) =>
          p.id !== patientId
            ? p
            : {
                ...p,
                status: nextStatus,
                msgs: [
                  ...p.msgs,
                  {
                    id: `conf_st_${Date.now()}`,
                    from: 'evt',
                    text: `Status da consulta atualizado para "${nextStatus}"`,
                    t: nowTime(),
                  },
                ],
              }
        )
      );
      handleSyncConsultationFromPatient(patientId, { status: nextStatus });
    },
    [handleSyncConsultationFromPatient]
  );

  const handleChangeMemberSubsector = useCallback(
    (memberName: string, nextSubsector: string) => {
      setTeamSubsectors((prev) => {
        const updated = { ...prev, [memberName]: nextSubsector };
        saveStorage('ct_team_subs_v1', updated);
        void persistSharedContent({ teamSubsectors: updated });
        return updated;
      });
    },
    [persistSharedContent]
  );

  return (
    <div className="min-h-screen flex flex-col md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <Sidebar
        currentView={view}
        onSelectView={handleSelectView}
        portalName={cfg.portalNome}
        portalSub={cfg.portalSub}
        isAdmin={isAdmin}
        onToggleRole={() => {
          setIsAdmin((prev) => {
            const next = !prev;
            if (!next && view === 'administracao') setView('trainee');
            showToast(
              next
                ? 'Modo Instrutora / Coordenação ativado.'
                : 'Modo Trainee ativado.'
            );
            return next;
          });
        }}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode((d) => !d)}
        traineeName={activeCollaborator}
        collaborators={collaborators}
        onChangeTraineeName={handleChangeCollaborator}
        googleUser={googleUser}
        googleAuthLoading={googleAuthLoading}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
      />

      <div className="min-w-0 flex flex-col">
        <TopEnterpriseBar
          activeCollaborator={activeCollaborator}
          collaborators={collaborators}
          onChangeCollaborator={handleChangeCollaborator}
          onAddCollaborator={handleAddCollaborator}
          summary={traineeSummary}
          onOpenQuickSim={() => handleOpenQuickSim()}
          onGoView={handleSelectView}
          googleUser={googleUser}
          googleAuthLoading={googleAuthLoading}
          onGoogleSignIn={handleGoogleSignIn}
          onGoogleSignOut={handleGoogleSignOut}
        />

        <main className="min-w-0 flex-1 p-4 md:p-6 lg:p-7 overflow-x-hidden">
          {view === 'trainee' && (
            <TraineeView
              cfg={cfg}
              progress={activeProgress}
              allProgressByPerson={traineeByPerson}
              collaborators={collaborators}
              trilhaData={trilhaData}
              activeCollaborator={activeCollaborator}
              googleLinked={Boolean(googleUser)}
              onChangeCollaborator={handleChangeCollaborator}
              onAddCollaborator={handleAddCollaborator}
              onUpdateProgress={handleUpdateTraineeProgress}
              isAdmin={isAdmin}
              onLaunchPractice={handleLaunchPractice}
              onOpenQuickSim={handleOpenQuickSim}
              onGoView={handleSelectView}
              onToast={showToast}
            />
          )}

          {view === 'reciclagem' && (
            <ReciclagemView
              cfg={cfg}
              collaborators={collaborators}
              activeCollaborator={activeCollaborator}
              onChangeCollaborator={handleChangeCollaborator}
              reciclagemByPerson={reciclagemByPerson}
              onUpdateReciclagem={(person, next) => {
                setReciclagemByPerson((prev) => {
                  const updated = { ...prev, [person]: next };
                  saveStorage('ct_reciclagem_v1', updated);
                  return updated;
                });
              }}
              isAdmin={isAdmin}
              onOpenQuickSim={handleOpenQuickSim}
              onGoView={handleSelectView}
              onToast={showToast}
            />
          )}

          {view === 'simulacao' && (
            <SimulatorView
              cfg={cfg}
              patients={patients}
              setPatients={setPatients}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              deptFilter={deptFilter}
              setDeptFilter={setDeptFilter}
              listTab={listTab}
              setListTab={setListTab}
              aiConfigured={aiConfigured}
              onResetSim={handleResetSim}
              onGoView={handleSelectView}
              onOpenSolModal={(pid, mode) => handleOpenSolModal(pid, mode)}
              onSignalPractice={handleSignalPractice}
              onSyncConsultation={handleSyncConsultationFromPatient}
              onCaseEvaluated={handleCaseEvaluated}
              onStartCall={handleRequestCall}
              onCoachSignal={handleCoachSignal}
              onToast={showToast}
            />
          )}

          {view === 'subsetores' && (
            <SubsectorsView
              cfg={cfg}
              aiConfigured={aiConfigured}
              speakerName={activeCollaborator}
              voiceProfile={voiceProfile}
              sharedVoiceProfile={sharedVoiceProfile}
              videoOverrides={videoOverrides}
              sharedSceneAudios={sharedSceneAudios}
              onUpdateVoiceProfile={handleUpdateVoiceProfile}
              onStartTour={handleStartTour}
              onOpenQuickSim={handleOpenQuickSim}
              onToast={showToast}
            />
          )}

          {view === 'solicitacoes' && (
            <SolicitationsView
              patients={patients}
              onOpenModal={handleOpenSolModal}
              onMoveStatus={handleMoveSolStatus}
              onOpenChat={handleOpenPatientFromOutside}
              onOpenQuickSim={handleOpenQuickSim}
            />
          )}

          {view === 'confirmacao' && (
            <ConfirmationBoardView
              patients={patients}
              consultations={consultations}
              onStartCall={handleRequestCall}
              onOpenPatientChat={handleOpenPatientFromOutside}
              onOpenNegotiation={(pid) => setCrmNegPatientId(pid)}
              onForwardToChat={(pid, text, label) => handleForwardToChat(pid, text, label, false)}
              onUpdateConsultationStatus={handleUpdateConsultationStatusByPatient}
              onToast={showToast}
            />
          )}

          {view === 'consultas' && (
            <ConsultationsView
              rows={consultations}
              chatTargets={chatTargets}
              onUpdateRow={handleUpdateConsultation}
              onForwardToChat={handleForwardToChat}
              onStartConfirmTour={() => handleStartTour('confirmacao')}
              onAccessChat={(pid) => {
                handleOpenPatientFromOutside(pid);
                showToast('Chat de confirmação aberto.');
              }}
              onGoView={handleSelectView}
              onOpenQuickSim={handleOpenQuickSim}
              onToast={showToast}
            />
          )}

          {view === 'crm' && (
            <CrmView
              patients={patients}
              onOpenPatientChat={handleOpenPatientFromOutside}
              onOpenNegotiation={(pid) => setCrmNegPatientId(pid)}
              onStartCall={handleRequestCall}
              onBackToSim={() => setView('simulacao')}
              onOpenQuickSim={handleOpenQuickSim}
              onToast={showToast}
            />
          )}

          {view === 'trilha' && (
            <IntegrationTrackView
              cfg={cfg}
              trilhaData={trilhaData}
              onUpdateTrilha={(person, next) => {
                const updated = { ...trilhaData, [person]: next };
                setTrilhaData(updated);
                saveStorage('ct_trilha_v1', updated);
              }}
              isAdmin={isAdmin}
              traineeName={activeCollaborator}
              onOpenQuickSim={handleOpenQuickSim}
              onToast={showToast}
            />
          )}

          {view === 'treinamento' && (
            <ScheduleView
              cfg={cfg}
              onUpdateConfig={handleUpdateConfig}
              records={cronoRecords}
              onSaveRecord={(person, rec) => {
                const updated = { ...cronoRecords, [person]: rec };
                setCronoRecords(updated);
                saveStorage('ct_crono_v1', updated);
              }}
              isAdmin={isAdmin}
              traineeName={activeCollaborator}
              onOpenQuickSim={handleOpenQuickSim}
              onToast={showToast}
            />
          )}

          {view === 'apadrinhamento' && (
            <MentorshipView
              cfg={cfg}
              isAdmin={isAdmin}
              traineeName={activeCollaborator}
              teamSubsectors={teamSubsectors}
              onChangeMemberSubsector={handleChangeMemberSubsector}
              commentsByPerson={mentorshipComments}
              onAddComment={(key, comment) => {
                const updated = {
                  ...mentorshipComments,
                  [key]: [comment, ...(mentorshipComments[key] || [])],
                };
                setMentorshipComments(updated);
                saveStorage('ct_apad_v1', updated);
              }}
              onDeleteComment={(key, cid) => {
                const updated = {
                  ...mentorshipComments,
                  [key]: (mentorshipComments[key] || []).filter((c) => c.id !== cid),
                };
                setMentorshipComments(updated);
                saveStorage('ct_apad_v1', updated);
                showToast('Comentário removido.');
              }}
              chatsByPerson={mentorshipChats}
              onSendChatMsg={(key, msg) => {
                const updated = {
                  ...mentorshipChats,
                  [key]: [...(mentorshipChats[key] || []), msg],
                };
                setMentorshipChats(updated);
                saveStorage('ct_mchat_v1', updated);
              }}
              onOpenQuickSim={handleOpenQuickSim}
              onToast={showToast}
            />
          )}

          {view === 'administracao' && isAdmin && (
            <AdminView
              cfg={cfg}
              onSaveConfig={handleUpdateConfig}
              teamSubsectors={teamSubsectors}
              onUpdateTeamSubsectors={(next) => {
                setTeamSubsectors(next);
                saveStorage('ct_team_subs_v1', next);
              }}
              videoOverrides={videoOverrides}
              sharedSceneAudios={sharedSceneAudios}
              sharedVoiceProfile={sharedVoiceProfile}
              onSaveSharedBundle={async (bundle) => {
                setVideoOverrides(bundle.videoOverrides);
                setSharedSceneAudios(bundle.sceneAudioUrls);
                setSharedVoiceProfile(bundle.sharedVoiceProfile);
                await persistSharedContent(bundle);
              }}
              onToast={showToast}
              aiConfigured={aiConfigured}
              speakerName={activeCollaborator}
              voiceProfile={voiceProfile}
              onUpdateVoiceProfile={handleUpdateVoiceProfile}
            />
          )}
        </main>
      </div>

      <QuickSimulatorDrawer
        open={quickSim.open}
        onClose={() => setQuickSim({ open: false })}
        initialDeptKey={quickSim.deptKey}
        initialPatientId={quickSim.patientId}
        cfg={cfg}
        patients={patients}
        setPatients={setPatients}
        aiConfigured={aiConfigured}
        activeCollaborator={activeCollaborator}
        summary={traineeSummary}
        onOpenFullSimulator={(dKey, pid) => handleLaunchPractice(dKey, pid)}
        onSignalPractice={handleSignalPractice}
        onSyncConsultation={handleSyncConsultationFromPatient}
        onCaseEvaluated={handleCaseEvaluated}
        onStartCall={handleRequestCall}
        onToast={showToast}
      />

      {solDrawerForm && (
        <SolicitationDrawer
          initialForm={solDrawerForm}
          patients={patients}
          onClose={() => setSolDrawerForm(null)}
          onSave={handleSaveSolicitation}
          onToast={showToast}
        />
      )}

      {crmNegPatientId && (() => {
        const crmPatient = patients.find((p) => p.id === crmNegPatientId);
        if (!crmPatient) return null;
        return (
          <NegotiationModal
            patient={crmPatient}
            onClose={() => setCrmNegPatientId(null)}
            onToast={showToast}
            onStartCall={handleRequestCall}
            onOpenChat={(pid) => {
              setCrmNegPatientId(null);
              handleOpenPatientFromOutside(pid);
            }}
            onReschedule={(payload) => {
              const dataDash = payload.dataBr.replaceAll('/', '-');
              setPatients((prev) =>
                prev.map((p) =>
                  p.id !== crmPatient.id
                    ? p
                    : {
                        ...p,
                        data: dataDash,
                        hora: payload.hora,
                        medico: payload.medico,
                        status: 'Reagendada',
                        msgs: [
                          ...p.msgs,
                          {
                            id: `crm_reag_${Date.now()}`,
                            from: 'evt',
                            text: `Reagendamento: ${payload.dataBr} às ${payload.hora} · ${payload.medico}`,
                            t: nowTime(),
                          },
                          ...(payload.sendToChat
                            ? [
                                {
                                  id: `crm_reag_op_${Date.now()}`,
                                  from: 'op' as const,
                                  label: 'Reagendamento confirmado',
                                  text: `Sua consulta foi reagendada para ${payload.dataBr} às ${payload.hora} com ${payload.medico}. Qualquer dúvida estamos à disposição!`,
                                  t: nowTime(),
                                },
                              ]
                            : []),
                        ],
                      }
                )
              );
              handleSyncConsultationFromPatient(crmPatient.id, {
                dateKey: payload.dateKey,
                dataBr: payload.dataBr,
                hora: payload.hora,
                medico: payload.medico,
                status: 'Reagendada',
              });
              handleSignalPractice('d1_2');
              showToast(`Consulta de ${crmPatient.nome} reagendada para ${payload.dataBr} às ${payload.hora}.`);
            }}
            onChangeDoctor={(medico, sendToChat) => {
              setPatients((prev) =>
                prev.map((p) =>
                  p.id !== crmPatient.id
                    ? p
                    : {
                        ...p,
                        medico,
                        msgs: [
                          ...p.msgs,
                          {
                            id: `crm_doc_${Date.now()}`,
                            from: 'evt',
                            text: `Médico alterado para ${medico}`,
                            t: nowTime(),
                          },
                          ...(sendToChat
                            ? [
                                {
                                  id: `crm_doc_op_${Date.now()}`,
                                  from: 'op' as const,
                                  label: 'Alteração de médico',
                                  text: `Informamos que sua consulta foi atualizada para atendimento com ${medico}, mantendo o dia ${p.data.replaceAll('-', '/')} às ${p.hora}.`,
                                  t: nowTime(),
                                },
                              ]
                            : []),
                        ],
                      }
                )
              );
              handleSyncConsultationFromPatient(crmPatient.id, { medico });
              showToast(`Médico atualizado para ${medico}.`);
            }}
            onChangeStatus={(nextStatus, sendToChat) => {
              setPatients((prev) =>
                prev.map((p) =>
                  p.id !== crmPatient.id
                    ? p
                    : {
                        ...p,
                        status: nextStatus,
                        msgs: [
                          ...p.msgs,
                          {
                            id: `crm_st_${Date.now()}`,
                            from: 'evt',
                            text: `Status da consulta alterado para "${nextStatus}"`,
                            t: nowTime(),
                          },
                          ...(sendToChat && nextStatus === 'Confirmada'
                            ? [
                                {
                                  id: `crm_st_op_${Date.now()}`,
                                  from: 'op' as const,
                                  label: 'Agendamento confirmado',
                                  text: `Sua consulta de ${p.data.replaceAll('-', '/')} às ${p.hora} com ${p.medico} está confirmada!`,
                                  t: nowTime(),
                                },
                              ]
                            : []),
                        ],
                      }
                )
              );
              handleSyncConsultationFromPatient(crmPatient.id, { status: nextStatus });
              showToast(`Status atualizado para ${nextStatus}.`);
            }}
            onAddNote={(text, tipo = 'Nota') => {
              setPatients((prev) =>
                prev.map((p) =>
                  p.id !== crmPatient.id
                    ? p
                    : {
                        ...p,
                        notas: [
                          ...p.notas,
                          { id: `crm_n_${Date.now()}`, tipo, text, t: nowTime() },
                        ],
                      }
                )
              );
              showToast('Nota adicionada ao paciente.');
            }}
            onForwardToChat={(text, label) => {
              handleForwardToChat(crmPatient.id, text, label, false);
              setCrmNegPatientId(null);
            }}
          />
        );
      })()}

      <PhoneDialerOverlay
        pendingCallPatient={pendingCallPatient}
        dialerOpen={dialerState.open}
        dialerPatient={dialerState.patient}
        attendantName={activeCollaborator}
        onCancelConfirm={() => setPendingCallPatient(null)}
        onConfirmCall={handleConfirmCall}
        onCloseDialer={() => setDialerState({ open: false, patient: null })}
        onOpenPatientChat={(pid) => {
          setDialerState({ open: false, patient: null });
          handleOpenPatientFromOutside(pid);
        }}
        onOpenNegotiation={(pid) => {
          setDialerState({ open: false, patient: null });
          setCrmNegPatientId(pid);
        }}
        onLogCallResult={handleLogCallResult}
        onToast={showToast}
      />

      <CoachOverlay
        active={coachState.active}
        steps={coachState.steps}
        stepIndex={coachState.index}
        onAdvance={handleAdvanceCoach}
        onStop={(msg) => {
          setCoachState({ active: false, steps: [], index: 0, doneMsg: '' });
          if (msg) showToast(msg);
        }}
        cfg={cfg}
      />

      <GoogleAccessModal
        open={googleModalOpen && !googleUser}
        loading={googleAuthLoading}
        error={googleAuthError}
        onGoogleSignIn={handleGoogleSignIn}
        onContinueWithoutLogin={handleDismissGoogleModal}
      />

      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="no-print fixed left-1/2 -translate-x-1/2 bottom-5 z-[70] rounded-xl bg-[var(--ink)] text-[var(--bg)] px-4 py-2.5 text-xs font-semibold shadow-2xl max-w-[calc(100vw-32px)]"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
