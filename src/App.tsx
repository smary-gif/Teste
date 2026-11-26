import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AdminView } from './components/AdminView';
import { CoachOverlay } from './components/CoachOverlay';
import { ConsultationsView } from './components/ConsultationsView';
import { CrmView } from './components/CrmView';
import { IntegrationTrackView, type TrilhaStore } from './components/IntegrationTrackView';
import { MentorshipView } from './components/MentorshipView';
import { ScheduleView } from './components/ScheduleView';
import { Sidebar } from './components/Sidebar';
import { SimulatorView } from './components/SimulatorView';
import { SolicitationDrawer, type SolFormState } from './components/SolicitationDrawer';
import { SolicitationsView } from './components/SolicitationsView';
import { SubsectorsView } from './components/SubsectorsView';
import { TraineeView } from './components/TraineeView';
import {
  DEFAULT_CONFIG,
  TRAIN_DEPTS,
  generateConsultations,
  generatePatients,
} from './data/defaults';
import { buildTourSteps } from './data/tours';
import type {
  AppView,
  AtendTabKey,
  CoachStep,
  ConsultationRow,
  CronoRecord,
  MentorshipChatMsg,
  MentorshipComment,
  PatientCase,
  PortalConfig,
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
    return {
      ...DEFAULT_CONFIG,
      ...saved,
      madrinha: { ...DEFAULT_CONFIG.madrinha, ...(saved.madrinha || {}) },
      templates: { ...DEFAULT_CONFIG.templates, ...(saved.templates || {}) },
    };
  });

  const [darkMode, setDarkMode] = useState<boolean>(() =>
    loadStorage<boolean>('ct_theme_v1', false)
  );
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [traineeName, setTraineeName] = useState<string>(() =>
    loadStorage<string>('ct_trainee_name_v1', 'Trainee')
  );

  const [view, setView] = useState<AppView>('trainee');
  const [patients, setPatients] = useState<PatientCase[]>(() => generatePatients(cfg));
  const [consultations, setConsultations] = useState<ConsultationRow[]>(() =>
    generateConsultations(patients)
  );
  const [selectedId, setSelectedId] = useState<string>('solicitacoes0');
  const [deptFilter, setDeptFilter] = useState<string>('Solicitações');
  const [listTab, setListTab] = useState<AtendTabKey>('abertos');
  const [aiConfigured, setAiConfigured] = useState<boolean>(false);

  const [traineeProgress, setTraineeProgress] = useState<TraineeProgressStore>(() =>
    loadStorage<TraineeProgressStore>('ct_trn_v1', {
      prac: {},
      best: {},
      tries: {},
      date: {},
      simSignals: {},
    })
  );

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

  const [solDrawerForm, setSolDrawerForm] = useState<SolFormState | null>(null);
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
    document.title = cfg.portalNome;
  }, [cfg.portalNome]);

  useEffect(() => {
    fetch('/api/ai/status')
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => setAiConfigured(Boolean(d.configured)))
      .catch(() => setAiConfigured(false));
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

  const handleUpdateTraineeProgress = (next: TraineeProgressStore) => {
    setTraineeProgress(next);
    saveStorage('ct_trn_v1', next);
  };

  const handleSignalPractice = useCallback((signalId: string) => {
    setTraineeProgress((prev) => {
      if (prev.simSignals[signalId] && prev.prac[signalId]) return prev;
      const updated: TraineeProgressStore = {
        ...prev,
        simSignals: { ...prev.simSignals, [signalId]: true },
        prac: { ...prev.prac, [signalId]: true },
      };
      saveStorage('ct_trn_v1', updated);
      return updated;
    });
  }, []);

  const handleLaunchPractice = (deptKeyArg?: string) => {
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
        traineeName={traineeName}
        onChangeTraineeName={(name) => {
          setTraineeName(name);
          saveStorage('ct_trainee_name_v1', name);
        }}
      />

      <main className="min-w-0 p-4 md:p-6 lg:p-7 overflow-x-hidden">
        {view === 'trainee' && (
          <TraineeView
            progress={traineeProgress}
            onUpdateProgress={handleUpdateTraineeProgress}
            isAdmin={isAdmin}
            traineeName={traineeName}
            onLaunchPractice={handleLaunchPractice}
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
            onCoachSignal={handleCoachSignal}
            onToast={showToast}
          />
        )}

        {view === 'subsetores' && (
          <SubsectorsView cfg={cfg} onStartTour={handleStartTour} />
        )}

        {view === 'solicitacoes' && (
          <SolicitationsView
            patients={patients}
            onOpenModal={handleOpenSolModal}
            onMoveStatus={handleMoveSolStatus}
            onOpenChat={handleOpenPatientFromOutside}
          />
        )}

        {view === 'consultas' && (
          <ConsultationsView
            rows={consultations}
            onStartConfirmTour={() => handleStartTour('confirmacao')}
            onAccessChat={(pid) => {
              handleOpenPatientFromOutside(pid);
              showToast('Chat de confirmação aberto.');
            }}
            onGoView={handleSelectView}
            onToast={showToast}
          />
        )}

        {view === 'crm' && (
          <CrmView
            patients={patients}
            onOpenPatientChat={handleOpenPatientFromOutside}
            onBackToSim={() => setView('simulacao')}
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
            traineeName={traineeName}
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
            traineeName={traineeName}
            onToast={showToast}
          />
        )}

        {view === 'apadrinhamento' && (
          <MentorshipView
            cfg={cfg}
            isAdmin={isAdmin}
            traineeName={traineeName}
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
            onToast={showToast}
          />
        )}

        {view === 'administracao' && isAdmin && (
          <AdminView
            cfg={cfg}
            onSaveConfig={handleUpdateConfig}
            onToast={showToast}
          />
        )}
      </main>

      {solDrawerForm && (
        <SolicitationDrawer
          initialForm={solDrawerForm}
          patients={patients}
          onClose={() => setSolDrawerForm(null)}
          onSave={handleSaveSolicitation}
          onToast={showToast}
        />
      )}

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
