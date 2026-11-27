import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  FolderUp,
  Info,
  Loader2,
  Mic,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Square,
  Trash2,
  Upload,
  Users,
  Video,
  Volume2,
} from 'lucide-react';
import { DEFAULT_CONFIG, DEFAULT_LEADERSHIP, EQUIPE } from '../data/defaults';
import { SUBSECTOR_VIDEOS } from '../data/subsectorVideos';
import type {
  AiVoiceProfile,
  EditableVideoScene,
  EditableVideoScript,
  PortalConfig,
} from '../types';
import { cloneData } from '../utils/helpers';
import { VoiceConfigPanel } from './VoiceConfigPanel';

type AdminTab = 'geral' | 'deptos' | 'templates' | 'videos';

const SUBSECTOR_OPTIONS = [
  'Trainee',
  'Auditoria',
  'Chat geral',
  'Agendamento e reagendamento',
  'Confirmação',
  'Suporte aos pacientes',
  'Suporte aos médicos',
  'Solicitações',
];

const VISUAL_TYPES: Array<{ value: EditableVideoScene['visualType']; label: string }> = [
  { value: 'chat', label: 'Atendimento / Chat' },
  { value: 'agendamento', label: 'Agendamento' },
  { value: 'confirmacao', label: 'Confirmação' },
  { value: 'crm', label: 'CRM / Acompanhamento' },
  { value: 'reagendamento', label: 'Reagendamento' },
  { value: 'medicos', label: 'Suporte aos Médicos' },
  { value: 'kanban', label: 'Kanban / Solicitações' },
];

interface AdminViewProps {
  cfg: PortalConfig;
  onSaveConfig: (next: PortalConfig) => void;
  teamSubsectors?: Record<string, string>;
  onUpdateTeamSubsectors?: (next: Record<string, string>) => void;
  videoOverrides?: Record<string, EditableVideoScript>;
  sharedSceneAudios?: Record<string, string>;
  sharedVoiceProfile?: AiVoiceProfile | null;
  onSaveSharedBundle?: (payload: {
    cfg: PortalConfig;
    teamSubsectors: Record<string, string>;
    videoOverrides: Record<string, EditableVideoScript>;
    sceneAudioUrls: Record<string, string>;
    sharedVoiceProfile: AiVoiceProfile | null;
  }) => Promise<void>;
  onToast: (msg: string) => void;
  aiConfigured?: boolean;
  speakerName?: string;
  voiceProfile?: AiVoiceProfile | null;
  onUpdateVoiceProfile?: (next: AiVoiceProfile | null) => void;
}

function buildInitialVideosMap(
  overrides: Record<string, EditableVideoScript>
): Record<string, EditableVideoScript> {
  const map: Record<string, EditableVideoScript> = {};
  Object.keys(SUBSECTOR_VIDEOS).forEach((k) => {
    map[k] = cloneData(overrides[k] || SUBSECTOR_VIDEOS[k]);
  });
  Object.keys(overrides).forEach((k) => {
    if (!map[k]) map[k] = cloneData(overrides[k]);
  });
  return map;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Erro ao ler áudio.'));
    reader.readAsDataURL(blob);
  });
}

export function AdminView({
  cfg,
  onSaveConfig,
  teamSubsectors = {},
  onUpdateTeamSubsectors,
  videoOverrides = {},
  sharedSceneAudios = {},
  sharedVoiceProfile = null,
  onSaveSharedBundle,
  onToast,
  aiConfigured = false,
  speakerName = 'Colaboradora',
  voiceProfile = null,
  onUpdateVoiceProfile,
}: AdminViewProps) {
  const [tab, setTab] = useState<AdminTab>('geral');
  const [draft, setDraft] = useState<PortalConfig>(() => cloneData(cfg));
  const [subsectorsDraft, setSubsectorsDraft] = useState<Record<string, string>>(() => ({
    ...teamSubsectors,
  }));
  const [videosDraft, setVideosDraft] = useState<Record<string, EditableVideoScript>>(() =>
    buildInitialVideosMap(videoOverrides)
  );
  const [audiosDraft, setAudiosDraft] = useState<Record<string, string>>(() => ({
    ...sharedSceneAudios,
  }));
  const [sharedVoiceDraft, setSharedVoiceDraft] = useState<AiVoiceProfile | null>(
    sharedVoiceProfile
  );
  const [activeVideoKey, setActiveVideoKey] = useState<string>(
    () => Object.keys(SUBSECTOR_VIDEOS)[0] || 'geral'
  );
  const [dirty, setDirty] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  // Shared audio upload/record state per sceneId
  const [uploadingSceneId, setUploadingSceneId] = useState<string | null>(null);
  const [recordingSceneId, setRecordingSceneId] = useState<string | null>(null);
  const [recordSecs, setRecordSecs] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const fileTargetSceneRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recTimerRef = useRef<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!dirty) {
      setDraft(cloneData(cfg));
      setSubsectorsDraft({ ...teamSubsectors });
      setVideosDraft(buildInitialVideosMap(videoOverrides));
      setAudiosDraft({ ...sharedSceneAudios });
      setSharedVoiceDraft(sharedVoiceProfile);
    }
  }, [cfg, teamSubsectors, videoOverrides, sharedSceneAudios, sharedVoiceProfile, dirty]);

  useEffect(() => {
    return () => {
      if (recTimerRef.current) window.clearInterval(recTimerRef.current);
      if (recStreamRef.current) recStreamRef.current.getTracks().forEach((t) => t.stop());
      if (previewAudioRef.current) previewAudioRef.current.pause();
    };
  }, []);

  const updateDraft = (updater: (d: PortalConfig) => PortalConfig) => {
    setDraft((prev) => updater(cloneData(prev)));
    setDirty(true);
  };

  const updateVideoScript = (
    videoKey: string,
    updater: (v: EditableVideoScript) => EditableVideoScript
  ) => {
    setVideosDraft((prev) => ({
      ...prev,
      [videoKey]: updater(cloneData(prev[videoKey] || SUBSECTOR_VIDEOS[videoKey])),
    }));
    setDirty(true);
  };

  const uploadAudioBlobToServer = async (targetSceneId: string, blob: Blob, mimeType: string) => {
    setUploadingSceneId(targetSceneId);
    try {
      const audioBase64 = await blobToBase64(blob);
      const resp = await fetch('/api/shared/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneId: targetSceneId,
          audioBase64,
          mimeType,
        }),
      });
      const data = (await resp.json()) as { url?: string; error?: string };
      if (!resp.ok || !data.url) {
        onToast(data.error || 'Erro ao enviar áudio compartilhado para o servidor.');
        return;
      }
      const nextAudios = { ...audiosDraft, [targetSceneId]: data.url };
      setAudiosDraft(nextAudios);
      setDirty(true);
      onToast(
        'Áudio enviado para o servidor (/shared-media)! Clique em "Salvar e publicar para todas" para fixar no portal.'
      );
    } catch {
      onToast('Não foi possível enviar o arquivo de áudio ao servidor.');
    } finally {
      setUploadingSceneId(null);
    }
  };

  const handleTriggerFileUpload = (sceneId: string) => {
    fileTargetSceneRef.current = sceneId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const sceneId = fileTargetSceneRef.current;
    if (!file || !sceneId) return;
    await uploadAudioBlobToServer(sceneId, file, file.type || 'audio/mpeg');
  };

  const stopRecordingStream = () => {
    if (recTimerRef.current) {
      window.clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    if (recStreamRef.current) {
      recStreamRef.current.getTracks().forEach((t) => t.stop());
      recStreamRef.current = null;
    }
    recorderRef.current = null;
    setRecordingSceneId(null);
    setRecordSecs(0);
  };

  const handleToggleRecordSharedAudio = async (sceneId: string) => {
    if (recordingSceneId) {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function' ||
      typeof MediaRecorder === 'undefined'
    ) {
      onToast('Microfone indisponível neste navegador. Use "Subir áudio".');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;

      const chunks: Blob[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        const finalMime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: finalMime });
        stopRecordingStream();
        if (blob.size > 0) {
          void uploadAudioBlobToServer(sceneId, blob, finalMime);
        }
      };

      setRecordingSceneId(sceneId);
      setRecordSecs(0);
      recTimerRef.current = window.setInterval(() => setRecordSecs((s) => s + 1), 1000);
      recorder.start();
    } catch {
      stopRecordingStream();
      onToast('Permita o uso do microfone ou envie um arquivo de áudio (.mp3 / .wav).');
    }
  };

  const handlePreviewSharedAudio = (sceneId: string, url: string) => {
    if (playingAudioId === sceneId && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setPlayingAudioId(null);
      return;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    const audio = new Audio(url);
    previewAudioRef.current = audio;
    setPlayingAudioId(sceneId);
    audio.onended = () => {
      previewAudioRef.current = null;
      setPlayingAudioId(null);
    };
    audio.onerror = () => {
      previewAudioRef.current = null;
      setPlayingAudioId(null);
    };
    void audio.play().catch(() => setPlayingAudioId(null));
  };

  const handleRemoveSharedAudio = async (sceneId: string, url: string) => {
    const fileName = url.split('/').pop();
    if (fileName && url.startsWith('/shared-media/')) {
      try {
        await fetch(`/api/shared/audio/${encodeURIComponent(fileName)}`, {
          method: 'DELETE',
        });
      } catch {
        // ignore network deletion errors and clear reference anyway
      }
    }
    setAudiosDraft((prev) => {
      const next = { ...prev };
      delete next[sceneId];
      return next;
    });
    setDirty(true);
    onToast('Áudio compartilhado removido desta cena.');
  };

  const handleSaveAll = async () => {
    const cleaned = cloneData(draft);
    cleaned.pacientesSimulados = Math.max(
      8,
      Math.min(30, Number(cleaned.pacientesSimulados) || 15)
    );
    cleaned.atalhos = cleaned.atalhos.map((a) => ({
      cmd: a.cmd.trim().startsWith('/') ? a.cmd.trim() : `/${a.cmd.trim()}`,
      texto: a.texto,
    }));
    if (!cleaned.filtroDepartamentos.includes('Todos')) {
      cleaned.filtroDepartamentos.unshift('Todos');
    }

    onSaveConfig(cleaned);
    onUpdateTeamSubsectors?.(subsectorsDraft);

    if (onSaveSharedBundle) {
      setSavingAll(true);
      try {
        await onSaveSharedBundle({
          cfg: cleaned,
          teamSubsectors: subsectorsDraft,
          videoOverrides: videosDraft,
          sceneAudioUrls: audiosDraft,
          sharedVoiceProfile: sharedVoiceDraft,
        });
      } finally {
        setSavingAll(false);
      }
    }

    setDirty(false);
    onToast('Tudo salvo e publicado para todas as colaboradoras!');
  };

  const handleResetDefaults = () => {
    setDraft(cloneData(DEFAULT_CONFIG));
    setVideosDraft(buildInitialVideosMap({}));
    setDirty(true);
    onToast('Padrões restaurados no rascunho. Clique em "Salvar e publicar" para aplicar.');
  };

  const activeVideo = videosDraft[activeVideoKey] || SUBSECTOR_VIDEOS[activeVideoKey];

  return (
    <div className="max-w-[1440px] mx-auto space-y-5 pb-20">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--muted)]">Somente coordenação / instrutora</p>
          <h1 className="text-2xl font-bold mt-0.5">Administração Completa do Portal</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Edite textos, regras, níveis, subsetores da equipe, templates, atalhos, videoaulas e
            áudios compartilhados para todas as colaboradoras.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2" role="tablist">
        {(
          [
            { key: 'geral', label: 'Geral, Liderança & Equipe', icon: Users },
            { key: 'deptos', label: 'Departamentos, Guia 4.1–4.4 & Subsetores', icon: FolderUp },
            { key: 'templates', label: 'Templates & Atalhos', icon: CheckCircle2 },
            { key: 'videos', label: 'Vídeos & Áudios (Para todas)', icon: Video },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.key)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-ink)]'
                  : 'bg-[var(--surface)] border-[var(--line)] hover:border-[var(--accent)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: GERAL & EQUIPE */}
      {tab === 'geral' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
              <h2 className="text-base font-bold">Identidade e Regras de Simulação</h2>
              <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                <span>Nome do portal</span>
                <input
                  type="text"
                  value={draft.portalNome}
                  onChange={(e) =>
                    updateDraft((d) => ({ ...d, portalNome: e.target.value }))
                  }
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] font-normal"
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                <span>Subtítulo</span>
                <input
                  type="text"
                  value={draft.portalSub}
                  onChange={(e) =>
                    updateDraft((d) => ({ ...d, portalSub: e.target.value }))
                  }
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] font-normal"
                />
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                  <span>Pacientes simulados por setor (8 a 30)</span>
                  <input
                    type="number"
                    min={8}
                    max={30}
                    value={draft.pacientesSimulados}
                    onChange={(e) =>
                      updateDraft((d) => ({
                        ...d,
                        pacientesSimulados: Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] font-normal"
                  />
                </label>
                <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                  <span>Data início do cronograma</span>
                  <input
                    type="date"
                    value={draft.treinoInicio}
                    onChange={(e) =>
                      updateDraft((d) => ({ ...d, treinoInicio: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] font-normal"
                  />
                </label>
              </div>
              <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                <span>Texto sobre evolução e promoção</span>
                <textarea
                  rows={3}
                  value={draft.promocao}
                  onChange={(e) =>
                    updateDraft((d) => ({ ...d, promocao: e.target.value }))
                  }
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)] font-normal"
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                <span>Pontos de padrão de qualidade (1 por linha)</span>
                <textarea
                  rows={4}
                  value={(draft.aprimorarPadrao || []).join('\n')}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      aprimorarPadrao: e.target.value
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)] font-normal"
                />
              </label>
            </section>

            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
              <h2 className="text-base font-bold">Liderança, Treinamento & Ordem</h2>
              <div className="grid sm:grid-cols-2 gap-2.5">
                <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                  <span>Treinadora</span>
                  <input
                    type="text"
                    value={(draft.lideranca || DEFAULT_LEADERSHIP).treinadora || draft.madrinha.nome}
                    onChange={(e) =>
                      updateDraft((d) => ({
                        ...d,
                        lideranca: {
                          ...(d.lideranca || DEFAULT_LEADERSHIP),
                          treinadora: e.target.value,
                        },
                        madrinha: { ...d.madrinha, nome: e.target.value },
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] font-normal"
                  />
                </label>
                <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                  <span>Coordenadora</span>
                  <input
                    type="text"
                    value={(draft.lideranca || DEFAULT_LEADERSHIP).coordenadora}
                    onChange={(e) =>
                      updateDraft((d) => ({
                        ...d,
                        lideranca: {
                          ...(d.lideranca || DEFAULT_LEADERSHIP),
                          coordenadora: e.target.value,
                        },
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] font-normal"
                  />
                </label>
                <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                  <span>Liderança</span>
                  <input
                    type="text"
                    value={(draft.lideranca || DEFAULT_LEADERSHIP).lideranca}
                    onChange={(e) =>
                      updateDraft((d) => ({
                        ...d,
                        lideranca: {
                          ...(d.lideranca || DEFAULT_LEADERSHIP),
                          lideranca: e.target.value,
                        },
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] font-normal"
                  />
                </label>
                <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                  <span>Liderança em treinamento</span>
                  <input
                    type="text"
                    value={(draft.lideranca || DEFAULT_LEADERSHIP).liderancaTreinamento}
                    onChange={(e) =>
                      updateDraft((d) => ({
                        ...d,
                        lideranca: {
                          ...(d.lideranca || DEFAULT_LEADERSHIP),
                          liderancaTreinamento: e.target.value,
                        },
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] font-normal"
                  />
                </label>
              </div>
              <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                <span>Cargo da Treinadora</span>
                <input
                  type="text"
                  value={draft.madrinha.cargo}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      madrinha: { ...d.madrinha, cargo: e.target.value },
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] font-normal"
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                <span>Aviso informativo do Apadrinhamento</span>
                <textarea
                  rows={2}
                  value={draft.madrinha.aviso}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      madrinha: { ...d.madrinha, aviso: e.target.value },
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)] font-normal"
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                <span>Colaboradoras na fila / cronograma (1 por linha)</span>
                <textarea
                  rows={4}
                  value={(draft.treinoOrdem || []).join('\n')}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      treinoOrdem: e.target.value
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)] font-normal"
                />
              </label>
            </section>
          </div>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold">Trocar Subsetores das Colaboradoras</h2>
                <p className="text-xs text-[var(--muted)]">
                  Alterações aqui atualizam imediatamente o Portal de Apadrinhamento para toda a equipe.
                </p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {EQUIPE.map((member) => {
                const currentSub = subsectorsDraft[member.nome] || member.subsetor;
                return (
                  <div
                    key={member.nome}
                    className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <strong className="text-xs block truncate">{member.apelido}</strong>
                      <span className="text-[11px] text-[var(--muted)] block truncate">
                        {member.nome}
                      </span>
                    </div>
                    <select
                      value={currentSub}
                      onChange={(e) => {
                        setSubsectorsDraft((prev) => ({
                          ...prev,
                          [member.nome]: e.target.value,
                        }));
                        setDirty(true);
                      }}
                      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold max-w-[155px]"
                    >
                      {Array.from(new Set([...SUBSECTOR_OPTIONS, currentSub])).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Níveis de Evolução e Carreira</h2>
              <button
                type="button"
                onClick={() =>
                  updateDraft((d) => ({
                    ...d,
                    niveis: [...(d.niveis || []), { nome: 'Novo nível', desc: '' }],
                  }))
                }
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent)]"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar nível
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {(draft.niveis || []).map((nv, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nv.nome}
                      onChange={(e) =>
                        updateDraft((d) => {
                          d.niveis[idx].nome = e.target.value;
                          return d;
                        })
                      }
                      className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft((d) => {
                          d.niveis.splice(idx, 1);
                          return d;
                        })
                      }
                      className="text-xs text-[var(--danger)] px-1.5"
                    >
                      Remover
                    </button>
                  </div>
                  <input
                    type="text"
                    value={nv.desc}
                    onChange={(e) =>
                      updateDraft((d) => {
                        d.niveis[idx].desc = e.target.value;
                        return d;
                      })
                    }
                    className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs"
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: DEPARTAMENTOS & SUBSETORES */}
      {tab === 'deptos' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
              <h2 className="text-base font-bold">Filas & Departamentos</h2>
              <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                <span>Barra "Selecionar departamento para trabalhar" (1 por linha)</span>
                <textarea
                  rows={6}
                  value={draft.filtroDepartamentos.join('\n')}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      filtroDepartamentos: e.target.value
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)] font-normal"
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                <span>Lista do botão "Departamento" (encaminhar chat)</span>
                <textarea
                  rows={7}
                  value={draft.encaminharDepartamentos.join('\n')}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      encaminharDepartamentos: e.target.value
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)] font-normal"
                />
              </label>
            </section>

            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
              <h2 className="text-base font-bold">Guia de Confirmação (4.1 a 4.4)</h2>
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {draft.guia.map((step, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 space-y-2"
                  >
                    <div className="grid sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={step.quando}
                        onChange={(e) =>
                          updateDraft((d) => {
                            d.guia[i].quando = e.target.value;
                            return d;
                          })
                        }
                        className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-mono-num"
                      />
                      <input
                        type="text"
                        value={step.titulo}
                        onChange={(e) =>
                          updateDraft((d) => {
                            d.guia[i].titulo = e.target.value;
                            return d;
                          })
                        }
                        className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold"
                      />
                    </div>
                    <input
                      type="text"
                      value={step.texto}
                      onChange={(e) =>
                        updateDraft((d) => {
                          d.guia[i].texto = e.target.value;
                          return d;
                        })
                      }
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs"
                    />
                    <textarea
                      rows={3}
                      value={step.detalhe}
                      onChange={(e) =>
                        updateDraft((d) => {
                          d.guia[i].detalhe = e.target.value;
                          return d;
                        })
                      }
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Passo a Passo dos Subsetores</h2>
              <button
                type="button"
                onClick={() =>
                  updateDraft((d) => ({
                    ...d,
                    subsetores: [
                      ...d.subsetores,
                      {
                        tour: 'geral',
                        nome: 'Novo subsetor',
                        desc: 'Descrição do atendimento.',
                        passos: 'Passo 1\nPasso 2',
                      },
                    ],
                  }))
                }
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent)]"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar subsetor
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {draft.subsetores.map((sub, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={sub.nome}
                      onChange={(e) =>
                        updateDraft((d) => {
                          d.subsetores[idx].nome = e.target.value;
                          return d;
                        })
                      }
                      className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-bold"
                    />
                    <input
                      type="text"
                      value={sub.tour}
                      onChange={(e) =>
                        updateDraft((d) => {
                          d.subsetores[idx].tour = e.target.value;
                          return d;
                        })
                      }
                      title="Chave do tour/vídeo (ex: geral, confirmacao)"
                      className="w-28 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[11px] font-mono-num"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft((d) => {
                          d.subsetores.splice(idx, 1);
                          return d;
                        })
                      }
                      className="text-xs text-[var(--danger)] px-1"
                    >
                      Remover
                    </button>
                  </div>
                  <input
                    type="text"
                    value={sub.desc}
                    onChange={(e) =>
                      updateDraft((d) => {
                        d.subsetores[idx].desc = e.target.value;
                        return d;
                      })
                    }
                    className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs"
                  />
                  <textarea
                    rows={4}
                    value={sub.passos}
                    onChange={(e) =>
                      updateDraft((d) => {
                        d.subsetores[idx].passos = e.target.value;
                        return d;
                      })
                    }
                    className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs"
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: TEMPLATES & ATALHOS */}
      {tab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
            <h2 className="text-base font-bold">Templates Meta / Automáticos</h2>
            {(
              [
                ['agendamento', 'Template de Agendamento'],
                ['lembrete7h', 'Lembrete das 07:00'],
                ['lembrete2h', 'Lembrete 2 horas antes'],
                ['acesso', 'Envio de link de acesso (10min antes)'],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                <span>{label}</span>
                <textarea
                  rows={4}
                  value={draft.templates[field]}
                  onChange={(e) =>
                    updateDraft((d) => ({
                      ...d,
                      templates: { ...d.templates, [field]: e.target.value },
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)] font-normal"
                />
              </label>
            ))}
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
            <h2 className="text-base font-bold">Atalhos de mensagem</h2>
            <p className="text-xs text-[var(--muted)]">
              Use {'{$first_name}'} para inserir o primeiro nome do paciente.
            </p>
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {draft.atalhos.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-2.5 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.cmd}
                      onChange={(e) =>
                        updateDraft((d) => {
                          d.atalhos[idx].cmd = e.target.value;
                          return d;
                        })
                      }
                      className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-mono-num"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft((d) => {
                          d.atalhos.splice(idx, 1);
                          return d;
                        })
                      }
                      className="text-xs font-semibold text-[var(--danger)] px-2"
                    >
                      Remover
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={item.texto}
                    onChange={(e) =>
                      updateDraft((d) => {
                        d.atalhos[idx].texto = e.target.value;
                        return d;
                      })
                    }
                    className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                updateDraft((d) => {
                  d.atalhos.push({ cmd: '/novo', texto: '' });
                  return d;
                })
              }
              className="rounded-xl border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent)]"
            >
              Adicionar atalho
            </button>
          </section>
        </div>
      )}

      {/* TAB 4: VÍDEOS & ÁUDIOS COMPARTILHADOS */}
      {tab === 'videos' && (
        <div className="space-y-4">
          {/* Guia claro de como subir áudios para todas terem acesso */}
          <section className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-5 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <Info className="h-5 w-5 text-[var(--accent)] shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-xs">
                <h2 className="text-sm font-bold text-[var(--ink)]">
                  Como subir áudios e editar vídeos para TODAS as colaboradoras terem acesso
                </h2>
                <ol className="list-decimal list-inside space-y-1 text-[var(--ink)] leading-relaxed">
                  <li>
                    Escolha o subsetor abaixo e localize a cena que deseja alterar (ou adicione uma
                    nova cena / vídeo externo).
                  </li>
                  <li>
                    Clique em <strong>"Subir áudio (.mp3/.wav/.ogg/.m4a)"</strong> ou{' '}
                    <strong>"Gravar áudio pelo microfone"</strong> dentro da cena. O arquivo é salvo
                    diretamente no servidor em <code className="font-mono-num">public/shared-media/</code>.
                  </li>
                  <li>
                    Clique no botão verde <strong>"Salvar e publicar alterações"</strong> no rodapé
                    para gravar em <code className="font-mono-num">portal-content.json</code>. Assim,
                    qualquer trainee ou veterana que abrir o portal passará a ouvir esse áudio
                    automaticamente.
                  </li>
                  <li>
                    <strong>Para salvar também no seu repositório do GitHub:</strong> após publicar os
                    áudios aqui, clique no ícone de Commit/Push do GitHub no topo do AI Studio para
                    enviar os arquivos de <code className="font-mono-num">public/shared-media/</code>{' '}
                    para a sua conta.
                  </li>
                </ol>
              </div>
            </div>
          </section>

          {/* Voz oficial compartilhada + Voz pessoal */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold">
                  Voz Oficial da Coordenação (IA compartilhada para todas)
                </h3>
                {sharedVoiceDraft?.enabled && (
                  <span className="text-[11px] font-semibold text-[var(--accent)]">
                    Ativa para toda equipe
                  </span>
                )}
              </div>
              <VoiceConfigPanel
                speakerName={`Coordenação (${speakerName})`}
                aiConfigured={aiConfigured}
                voiceProfile={sharedVoiceDraft}
                onUpdateVoiceProfile={(next) => {
                  setSharedVoiceDraft(next);
                  setDirty(true);
                }}
                onToast={onToast}
              />
            </div>

            {onUpdateVoiceProfile && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold px-1">
                  Sua Voz Individual neste Navegador (Trainee / Teste local)
                </h3>
                <VoiceConfigPanel
                  speakerName={speakerName}
                  aiConfigured={aiConfigured}
                  voiceProfile={voiceProfile}
                  onUpdateVoiceProfile={onUpdateVoiceProfile}
                  onToast={onToast}
                />
              </div>
            )}
          </div>

          {/* Editor de Videoaulas por Subsetor */}
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Editor das Videoaulas por Subsetor</h2>
                <p className="text-xs text-[var(--muted)]">
                  Edite títulos, narrações (legendas), pontos de atenção, link de vídeo externo e
                  áudio oficial de cada cena.
                </p>
              </div>
              {activeVideo && (
                <button
                  type="button"
                  onClick={() => {
                    const def = SUBSECTOR_VIDEOS[activeVideoKey];
                    if (!def) return;
                    setVideosDraft((prev) => ({
                      ...prev,
                      [activeVideoKey]: cloneData(def),
                    }));
                    setDirty(true);
                    onToast(`Roteiro de "${def.title}" restaurado para o padrão.`);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent)]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restaurar vídeo padrão
                </button>
              )}
            </div>

            {/* Subsector video tabs */}
            <div className="flex flex-wrap gap-1.5">
              {Object.values(SUBSECTOR_VIDEOS).map((vid) => (
                <button
                  key={vid.key}
                  type="button"
                  onClick={() => setActiveVideoKey(vid.key)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeVideoKey === vid.key
                      ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-ink)]'
                      : 'bg-[var(--surface-2)] border-[var(--line)] hover:border-[var(--accent)]'
                  }`}
                >
                  {vid.title.replace('Videoaula · ', '')}
                </button>
              ))}
            </div>

            {activeVideo && (
              <div className="space-y-4 pt-2 border-t border-[var(--line)]">
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                    <span>Título do vídeo</span>
                    <input
                      type="text"
                      value={activeVideo.title}
                      onChange={(e) =>
                        updateVideoScript(activeVideoKey, (v) => ({
                          ...v,
                          title: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink)] font-normal"
                    />
                  </label>
                  <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                    <span>Subtítulo</span>
                    <input
                      type="text"
                      value={activeVideo.subtitle}
                      onChange={(e) =>
                        updateVideoScript(activeVideoKey, (v) => ({
                          ...v,
                          subtitle: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink)] font-normal"
                    />
                  </label>
                  <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                    <span>Resumo de duração</span>
                    <input
                      type="text"
                      value={activeVideo.totalLabel}
                      onChange={(e) =>
                        updateVideoScript(activeVideoKey, (v) => ({
                          ...v,
                          totalLabel: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink)] font-normal"
                    />
                  </label>
                  <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                    <span>Link externo do vídeo (opcional)</span>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={activeVideo.externalVideoUrl || ''}
                      onChange={(e) =>
                        updateVideoScript(activeVideoKey, (v) => ({
                          ...v,
                          externalVideoUrl: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink)] font-normal"
                    />
                  </label>
                </div>

                {/* Cenas do vídeo */}
                <div className="space-y-3">
                  {activeVideo.scenes.map((sc, sIdx) => {
                    const sharedUrl = audiosDraft[sc.id] || sc.audioUrl;
                    const isRec = recordingSceneId === sc.id;
                    const isUploading = uploadingSceneId === sc.id;
                    const isPlaying = playingAudioId === sc.id;

                    return (
                      <div
                        key={sc.id}
                        className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="h-6 w-6 rounded-full bg-[var(--accent)] text-[var(--accent-ink)] text-[11px] font-bold grid place-items-center">
                              {sIdx + 1}
                            </span>
                            <strong className="text-xs font-bold">{sc.title}</strong>
                            {sharedUrl && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-semibold">
                                <Volume2 className="h-3 w-3" />
                                Áudio compartilhado ativo
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              updateVideoScript(activeVideoKey, (v) => ({
                                ...v,
                                scenes: v.scenes.filter((_, idx) => idx !== sIdx),
                              }))
                            }
                            className="text-xs font-semibold text-[var(--danger)] hover:underline"
                          >
                            Remover cena
                          </button>
                        </div>

                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                          <label className="block space-y-1 text-[11px] font-semibold text-[var(--muted)]">
                            <span>Título da cena</span>
                            <input
                              type="text"
                              value={sc.title}
                              onChange={(e) =>
                                updateVideoScript(activeVideoKey, (v) => {
                                  v.scenes[sIdx].title = e.target.value;
                                  return v;
                                })
                              }
                              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--ink)] font-normal"
                            />
                          </label>
                          <label className="block space-y-1 text-[11px] font-semibold text-[var(--muted)]">
                            <span>Rótulo de tela</span>
                            <input
                              type="text"
                              value={sc.screenLabel}
                              onChange={(e) =>
                                updateVideoScript(activeVideoKey, (v) => {
                                  v.scenes[sIdx].screenLabel = e.target.value;
                                  return v;
                                })
                              }
                              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--ink)] font-normal"
                            />
                          </label>
                          <label className="block space-y-1 text-[11px] font-semibold text-[var(--muted)]">
                            <span>Ícone visual</span>
                            <select
                              value={sc.visualType}
                              onChange={(e) =>
                                updateVideoScript(activeVideoKey, (v) => {
                                  v.scenes[sIdx].visualType = e.target
                                    .value as EditableVideoScene['visualType'];
                                  return v;
                                })
                              }
                              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--ink)] font-normal"
                            >
                              {VISUAL_TYPES.map((vt) => (
                                <option key={vt.value} value={vt.value}>
                                  {vt.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block space-y-1 text-[11px] font-semibold text-[var(--muted)]">
                            <span>Duração (segundos)</span>
                            <input
                              type="number"
                              min={4}
                              max={120}
                              value={sc.durationSec}
                              onChange={(e) =>
                                updateVideoScript(activeVideoKey, (v) => {
                                  v.scenes[sIdx].durationSec = Number(e.target.value) || 10;
                                  return v;
                                })
                              }
                              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--ink)] font-normal"
                            />
                          </label>
                        </div>

                        <div className="grid md:grid-cols-2 gap-2.5">
                          <label className="block space-y-1 text-[11px] font-semibold text-[var(--muted)]">
                            <span>Narração / Legenda exibida</span>
                            <textarea
                              rows={3}
                              value={sc.narration}
                              onChange={(e) =>
                                updateVideoScript(activeVideoKey, (v) => {
                                  v.scenes[sIdx].narration = e.target.value;
                                  return v;
                                })
                              }
                              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--ink)] font-normal"
                            />
                          </label>
                          <div className="space-y-2">
                            <label className="block space-y-1 text-[11px] font-semibold text-[var(--muted)]">
                              <span>Ponto de atenção (Callout)</span>
                              <input
                                type="text"
                                value={sc.callout}
                                onChange={(e) =>
                                  updateVideoScript(activeVideoKey, (v) => {
                                    v.scenes[sIdx].callout = e.target.value;
                                    return v;
                                  })
                                }
                                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--ink)] font-normal"
                              />
                            </label>
                            <label className="block space-y-1 text-[11px] font-semibold text-[var(--muted)]">
                              <span>3 Passos visuais (separados por ;)</span>
                              <input
                                type="text"
                                value={sc.highlights.join(' ; ')}
                                onChange={(e) =>
                                  updateVideoScript(activeVideoKey, (v) => {
                                    v.scenes[sIdx].highlights = e.target.value
                                      .split(';')
                                      .map((item) => item.trim())
                                      .filter(Boolean)
                                      .slice(0, 3);
                                    return v;
                                  })
                                }
                                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--ink)] font-normal"
                              />
                            </label>
                          </div>
                        </div>

                        {/* Áudio compartilhado no servidor */}
                        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs">
                            <strong className="block">Áudio oficial desta cena (para todas)</strong>
                            <span className="text-[11px] text-[var(--muted)] font-mono-num">
                              {sharedUrl ? sharedUrl : 'Nenhum áudio enviado — usando voz IA / padrão.'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={isUploading}
                              onClick={() => handleToggleRecordSharedAudio(sc.id)}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                                isRec
                                  ? 'bg-[var(--danger)] text-white'
                                  : 'bg-[var(--accent)] text-[var(--accent-ink)]'
                              }`}
                            >
                              {isRec ? (
                                <>
                                  <Square className="h-3 w-3 fill-current" />
                                  Parar ({recordSecs}s)
                                </>
                              ) : (
                                <>
                                  <Mic className="h-3.5 w-3.5" />
                                  Gravar áudio
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              disabled={isUploading}
                              onClick={() => handleTriggerFileUpload(sc.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent)]"
                            >
                              {isUploading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />
                              ) : (
                                <Upload className="h-3.5 w-3.5 text-[var(--accent)]" />
                              )}
                              Subir áudio (.mp3/.wav)
                            </button>

                            {sharedUrl && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handlePreviewSharedAudio(sc.id, sharedUrl)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold"
                                >
                                  {isPlaying ? (
                                    <Pause className="h-3.5 w-3.5 text-[var(--accent)]" />
                                  ) : (
                                    <Play className="h-3.5 w-3.5 text-[var(--accent)]" />
                                  )}
                                  {isPlaying ? 'Pausar' : 'Ouvir'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleRemoveSharedAudio(sc.id, sharedUrl)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs font-semibold text-[var(--danger)]"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Remover
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() =>
                      updateVideoScript(activeVideoKey, (v) => ({
                        ...v,
                        scenes: [
                          ...v.scenes,
                          {
                            id: `${activeVideoKey}_${Date.now()}`,
                            title: `0${v.scenes.length + 1}. Nova etapa`,
                            screenLabel: 'ClickCannabis · Novo módulo',
                            narration: 'Descreva aqui a narração e orientação oficial desta cena.',
                            visualType: 'chat',
                            highlights: ['Passo 1', 'Passo 2', 'Passo 3'],
                            callout: 'Ponto de atenção importante para a colaboradora.',
                            durationSec: 12,
                          },
                        ],
                      }))
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2 text-xs font-semibold hover:border-[var(--accent)]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar nova cena neste vídeo
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Barra fixa inferior de publicação */}
      <div className="sticky bottom-3 flex justify-end z-20">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-xl px-4 py-2.5 flex flex-wrap items-center gap-3">
          <span className="text-xs text-[var(--muted)]">
            {dirty ? 'Alterações pendentes de publicação' : 'Tudo salvo e publicado'}
          </span>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="rounded-xl border border-[var(--line)] px-3 py-1.5 text-xs font-semibold"
          >
            Restaurar padrão
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(cloneData(cfg));
              setSubsectorsDraft({ ...teamSubsectors });
              setVideosDraft(buildInitialVideosMap(videoOverrides));
              setAudiosDraft({ ...sharedSceneAudios });
              setSharedVoiceDraft(sharedVoiceProfile);
              setDirty(false);
            }}
            className="rounded-xl border border-[var(--line)] px-3 py-1.5 text-xs font-semibold"
          >
            Descartar
          </button>
          <button
            type="button"
            disabled={savingAll}
            onClick={() => void handleSaveAll()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-1.5 text-xs font-semibold disabled:opacity-60"
          >
            {savingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>Salvar e publicar para todas</span>
          </button>
        </div>
      </div>
    </div>
  );
}
