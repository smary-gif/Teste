import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Captions,
  CheckCircle2,
  Columns3,
  Download,
  Loader2,
  Maximize2,
  MessageSquare,
  Mic,
  Minimize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Stethoscope,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { SubsectorVideoScene, SubsectorVideoScript } from '../data/subsectorVideos';
import { deleteSceneVoice, loadAllSceneVoices, saveSceneVoice } from '../lib/voiceStorage';
import type { AiVoiceProfile } from '../types';
import { ClickCannabisLogo } from './ClickCannabisLogo';
import { GLOBAL_VOICE_SAMPLE_KEY, VoiceConfigPanel } from './VoiceConfigPanel';

interface SubsectorVideoPlayerProps {
  script: SubsectorVideoScript;
  aiConfigured: boolean;
  speakerName?: string;
  voiceProfile?: AiVoiceProfile | null;
  sharedVoiceProfile?: AiVoiceProfile | null;
  sharedSceneAudios?: Record<string, string>;
  onUpdateVoiceProfile?: (next: AiVoiceProfile | null) => void;
  onPracticeTour?: () => void;
  onPracticeQuickSim?: () => void;
  onToast?: (msg: string) => void;
}

const ttsAudioCache = new Map<string, string>();

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function renderSceneToCanvas(
  ctx: CanvasRenderingContext2D,
  script: SubsectorVideoScript,
  scene: SubsectorVideoScene,
  sceneIdx: number,
  sceneProgress: number
) {
  const W = 1280;
  const H = 720;

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0b2216');
  grad.addColorStop(1, '#123322');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, 0, W, 76);

  ctx.fillStyle = '#8fe89c';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText('ClickCannabis · Central de Treinamentos', 48, 46);

  ctx.fillStyle = '#cbead2';
  ctx.font = '600 18px monospace';
  const counter = `Cena ${sceneIdx + 1}/${script.scenes.length}`;
  ctx.fillText(counter, W - ctx.measureText(counter).width - 48, 46);

  ctx.fillStyle = '#8fe89c';
  ctx.font = '700 18px system-ui, sans-serif';
  ctx.fillText(scene.screenLabel, 48, 128);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 36px system-ui, sans-serif';
  const titleLines = wrapCanvasLines(ctx, scene.title, W - 96);
  let yCursor = 176;
  for (const tl of titleLines) {
    ctx.fillText(tl, 48, yCursor);
    yCursor += 44;
  }

  const cardCount = Math.max(1, scene.highlights.length);
  const gap = 20;
  const cardW = (W - 96 - gap * (cardCount - 1)) / cardCount;
  const cardY = yCursor + 22;
  scene.highlights.forEach((hl, i) => {
    const cx = 48 + i * (cardW + gap);
    drawRoundedRect(ctx, cx, cardY, cardW, 124, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(143,232,156,0.38)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#8fe89c';
    ctx.font = '700 16px monospace';
    ctx.fillText(`PASSO 0${i + 1}`, cx + 22, cardY + 38);

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 22px system-ui, sans-serif';
    const hlLines = wrapCanvasLines(ctx, hl, cardW - 44);
    hlLines.slice(0, 2).forEach((l, li) => {
      ctx.fillText(l, cx + 22, cardY + 74 + li * 28);
    });
  });

  const callY = cardY + 152;
  drawRoundedRect(ctx, 48, callY, W - 96, 86, 16);
  ctx.fillStyle = 'rgba(251, 236, 210, 0.14)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(240, 179, 84, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#f0b354';
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillText('Ponto de atenção ClickCannabis', 72, callY + 32);
  ctx.fillStyle = '#f7efe1';
  ctx.font = '500 20px system-ui, sans-serif';
  const callLines = wrapCanvasLines(ctx, scene.callout, W - 144);
  ctx.fillText(callLines[0] || '', 72, callY + 62);

  drawRoundedRect(ctx, 48, H - 142, W - 96, 102, 14);
  ctx.fillStyle = 'rgba(6, 18, 11, 0.85)';
  ctx.fill();
  ctx.fillStyle = '#eef8f1';
  ctx.font = '500 21px system-ui, sans-serif';
  const subLines = wrapCanvasLines(ctx, scene.narration, W - 144);
  subLines.slice(0, 3).forEach((sl, si) => {
    ctx.fillText(sl, 72, H - 106 + si * 28);
  });

  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(0, H - 10, W, 10);
  const totalFrac = (sceneIdx + sceneProgress) / script.scenes.length;
  ctx.fillStyle = '#4cc77a';
  ctx.fillRect(0, H - 10, Math.round(W * Math.min(1, Math.max(0, totalFrac))), 10);
}

export function SubsectorVideoPlayer({
  script,
  aiConfigured,
  speakerName = 'Colaboradora',
  voiceProfile = null,
  sharedVoiceProfile = null,
  sharedSceneAudios = {},
  onUpdateVoiceProfile,
  onPracticeTour,
  onPracticeQuickSim,
  onToast,
}: SubsectorVideoPlayerProps) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [speed, setSpeed] = useState<1 | 1.25 | 1.5>(1);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportPct, setExportPct] = useState(0);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

  // User's own recorded voice per sceneId (persisted in IndexedDB)
  const [voiceBlobs, setVoiceBlobs] = useState<Record<string, Blob>>({});
  const [voiceUrls, setVoiceUrls] = useState<Record<string, string>>({});
  const [recordingSceneId, setRecordingSceneId] = useState<string | null>(null);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const [previewingVoice, setPreviewingVoice] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const playTokenRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const voiceUrlsRef = useRef<Record<string, string>>({});
  voiceUrlsRef.current = voiceUrls;

  const scenes = script.scenes;
  const safeIdx = Math.min(sceneIdx, Math.max(0, scenes.length - 1));
  const scene = scenes[safeIdx];

  // Hydrate saved user recordings on mount
  useEffect(() => {
    let active = true;
    void loadAllSceneVoices().then((loaded) => {
      if (!active) return;
      const urls: Record<string, string> = {};
      Object.entries(loaded).forEach(([id, blob]) => {
        if (id === GLOBAL_VOICE_SAMPLE_KEY) return;
        urls[id] = URL.createObjectURL(blob);
      });
      setVoiceBlobs(loaded);
      setVoiceUrls(urls);
    });
    return () => {
      active = false;
      Object.values(voiceUrlsRef.current).forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const stopAudio = useCallback(() => {
    playTokenRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.onended = null;
      audioRef.current = null;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current = null;
    }
    setPreviewingVoice(false);
    setLoadingAudio(false);
  }, []);

  const stopRecordingStream = useCallback(() => {
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
    setRecordingSecs(0);
  }, []);

  // Reset when subsector script changes
  useEffect(() => {
    stopAudio();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    stopRecordingStream();
    setPlaying(false);
    setSceneIdx(0);
    setElapsedSec(0);
  }, [script.key, stopAudio, stopRecordingStream]);

  useEffect(() => {
    return () => {
      stopAudio();
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      stopRecordingStream();
    };
  }, [stopAudio, stopRecordingStream]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const advanceOrFinish = useCallback(
    (token: number) => {
      if (playTokenRef.current !== token) return;
      if (safeIdx < scenes.length - 1) {
        setElapsedSec(0);
        setSceneIdx((prev) => prev + 1);
      } else {
        setPlaying(false);
        setElapsedSec(0);
        onToast?.(`Videoaula "${script.title}" concluída! Agora pratique no Simulador.`);
      }
    },
    [safeIdx, scenes.length, script.title, onToast]
  );

  // Playback driver per scene — zero robotic browser speechSynthesis!
  useEffect(() => {
    if (!playing || !scene) return;

    const token = ++playTokenRef.current;
    setElapsedSec(0);

    const progressTimer = window.setInterval(() => {
      setElapsedSec((prev) => Math.min(scene.durationSec, prev + 0.25 * speed));
    }, 250);

    let silenceTimer: number | null = null;
    const scheduleSilentAdvance = () => {
      if (playTokenRef.current !== token) return;
      silenceTimer = window.setTimeout(
        () => advanceOrFinish(token),
        (scene.durationSec * 1000) / speed
      );
    };

    const run = async () => {
      if (muted) {
        scheduleSilentAdvance();
        return;
      }

      // 1. User's own recorded voice always takes top priority
      const customUrl = voiceUrls[scene.id];
      const sharedUrl = scene.audioUrl || sharedSceneAudios[scene.id];
      const directAudioUrl = customUrl || sharedUrl;
      if (directAudioUrl) {
        try {
          const audio = new Audio(directAudioUrl);
          audio.playbackRate = speed;
          audioRef.current = audio;
          audio.onended = () => advanceOrFinish(token);
          audio.onerror = () => scheduleSilentAdvance();
          await audio.play();
          return;
        } catch {
          scheduleSilentAdvance();
          return;
        }
      }

      // 2. Natural Gemini neural voice (uses trainee voice profile, or shared admin voice profile)
      if (aiConfigured) {
        try {
          const chosenVoice =
            voiceProfile && voiceProfile.enabled
              ? voiceProfile
              : sharedVoiceProfile && sharedVoiceProfile.enabled
                ? sharedVoiceProfile
                : null;
          const activeProfile = chosenVoice
            ? {
                matchedBaseVoice: chosenVoice.matchedBaseVoice,
                ttsStylePrompt: chosenVoice.ttsStylePrompt,
              }
            : null;
          const cacheKey = `${scene.id}:${chosenVoice ? chosenVoice.updatedAt : 'default'}:${scene.narration.length}`;
          let audioSrc = ttsAudioCache.get(cacheKey);
          if (!audioSrc) {
            setLoadingAudio(true);
            const resp = await fetch('/api/ai/tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: scene.narration,
                voiceProfile: activeProfile,
              }),
            });
            if (playTokenRef.current !== token) return;
            setLoadingAudio(false);
            if (resp.ok) {
              const data = (await resp.json()) as { audioBase64?: string; mimeType?: string };
              if (data.audioBase64) {
                audioSrc = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
                ttsAudioCache.set(cacheKey, audioSrc);
              }
            }
          }

          if (audioSrc && playTokenRef.current === token) {
            const audio = new Audio(audioSrc);
            audio.playbackRate = speed;
            audioRef.current = audio;
            audio.onended = () => advanceOrFinish(token);
            audio.onerror = () => scheduleSilentAdvance();
            await audio.play();
            return;
          }
        } catch {
          setLoadingAudio(false);
        }
      }

      // 3. Clean silent visual mode with subtitles (never robotic speechSynthesis)
      scheduleSilentAdvance();
    };

    void run();

    return () => {
      window.clearInterval(progressTimer);
      if (silenceTimer) window.clearTimeout(silenceTimer);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current = null;
      }
      setLoadingAudio(false);
    };
  }, [
    playing,
    safeIdx,
    scene,
    muted,
    speed,
    aiConfigured,
    voiceProfile,
    sharedVoiceProfile,
    sharedSceneAudios,
    voiceUrls,
    advanceOrFinish,
  ]);

  const handleTogglePlay = () => {
    if (playing) {
      stopAudio();
      setPlaying(false);
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
        setPreviewingVoice(false);
      }
      setPlaying(true);
    }
  };

  const handleGoScene = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(scenes.length - 1, nextIndex));
    stopAudio();
    setElapsedSec(0);
    setSceneIdx(clamped);
  };

  const handleToggleFullscreen = () => {
    if (!stageRef.current) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void stageRef.current.requestFullscreen?.();
    }
  };

  const saveRecordedBlobForScene = useCallback(
    async (targetSceneId: string, blob: Blob) => {
      await saveSceneVoice(targetSceneId, blob);
      const nextUrl = URL.createObjectURL(blob);
      setVoiceBlobs((prev) => ({ ...prev, [targetSceneId]: blob }));
      setVoiceUrls((prev) => {
        if (prev[targetSceneId]) URL.revokeObjectURL(prev[targetSceneId]);
        return { ...prev, [targetSceneId]: nextUrl };
      });
      onToast?.('Sua voz foi gravada e vinculada a esta cena!');
    },
    [onToast]
  );

  const handleToggleRecordVoice = async () => {
    if (!scene) return;

    // Stop active recording
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
      onToast?.('Gravação de microfone indisponível neste navegador. Use "Enviar áudio".');
      return;
    }

    stopAudio();
    setPlaying(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;

      const targetId = scene.id;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        stopRecordingStream();
        if (blob.size > 0) {
          void saveRecordedBlobForScene(targetId, blob);
        }
      };

      setRecordingSceneId(targetId);
      setRecordingSecs(0);
      recTimerRef.current = window.setInterval(() => {
        setRecordingSecs((s) => s + 1);
      }, 1000);
      recorder.start();
    } catch {
      stopRecordingStream();
      onToast?.('Não foi possível acessar o microfone. Verifique a permissão ou envie um áudio.');
    }
  };

  const handleUploadAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !scene) return;
    await saveRecordedBlobForScene(scene.id, file);
  };

  const handlePreviewMyVoice = () => {
    if (!scene) return;
    const url = voiceUrls[scene.id];
    if (!url) return;

    if (previewingVoice && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setPreviewingVoice(false);
      return;
    }

    stopAudio();
    setPlaying(false);

    const audio = new Audio(url);
    previewAudioRef.current = audio;
    setPreviewingVoice(true);
    audio.onended = () => {
      previewAudioRef.current = null;
      setPreviewingVoice(false);
    };
    audio.onerror = () => {
      previewAudioRef.current = null;
      setPreviewingVoice(false);
    };
    void audio.play().catch(() => {
      setPreviewingVoice(false);
    });
  };

  const handleDeleteMyVoice = async () => {
    if (!scene) return;
    stopAudio();
    await deleteSceneVoice(scene.id);
    setVoiceBlobs((prev) => {
      const next = { ...prev };
      delete next[scene.id];
      return next;
    });
    setVoiceUrls((prev) => {
      const next = { ...prev };
      if (next[scene.id]) URL.revokeObjectURL(next[scene.id]);
      delete next[scene.id];
      return next;
    });
    onToast?.('Gravação removida desta cena.');
  };

  const handleDownloadWebm = async () => {
    if (exporting) return;
    if (typeof MediaRecorder === 'undefined') {
      onToast?.('Seu navegador não suporta exportação direta para vídeo WebM.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof canvas.captureStream !== 'function') {
      onToast?.('Exportação de vídeo indisponível neste navegador.');
      return;
    }

    setExporting(true);
    setExportPct(0);
    stopAudio();
    setPlaying(false);

    let audioCtx: AudioContext | null = null;
    try {
      const canvasStream = canvas.captureStream(24);
      const decodedBuffers = new Map<string, AudioBuffer>();

      // Mux user's recorded voices, shared official audio, or cached AI TTS directly into exported video
      const hasAnyAudio = scenes.some(
        (sc) =>
          voiceBlobs[sc.id] ||
          sc.audioUrl ||
          sharedSceneAudios[sc.id] ||
          ttsAudioCache.has(sc.id)
      );
      let combinedStream: MediaStream = canvasStream;
      let audioDest: MediaStreamAudioDestinationNode | null = null;

      if (hasAnyAudio && typeof AudioContext !== 'undefined') {
        try {
          audioCtx = new AudioContext();
          audioDest = audioCtx.createMediaStreamDestination();
          for (const sc of scenes) {
            const customBlob = voiceBlobs[sc.id];
            const sharedAudioUrl = sc.audioUrl || sharedSceneAudios[sc.id];
            const cachedDataUrl = ttsAudioCache.get(sc.id);
            let arrBuf: ArrayBuffer | null = null;
            if (customBlob) {
              arrBuf = await customBlob.arrayBuffer();
            } else if (sharedAudioUrl) {
              const res = await fetch(sharedAudioUrl);
              if (res.ok) arrBuf = await res.arrayBuffer();
            } else if (cachedDataUrl) {
              const res = await fetch(cachedDataUrl);
              arrBuf = await res.arrayBuffer();
            }
            if (arrBuf) {
              const buf = await audioCtx.decodeAudioData(arrBuf.slice(0));
              decodedBuffers.set(sc.id, buf);
            }
          }
          if (decodedBuffers.size > 0) {
            combinedStream = new MediaStream([
              ...canvasStream.getVideoTracks(),
              ...audioDest.stream.getAudioTracks(),
            ]);
          }
        } catch {
          combinedStream = canvasStream;
          audioDest = null;
        }
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm';
      const recorder = new MediaRecorder(combinedStream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      const donePromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
      });

      recorder.start();

      const frameStepMs = 80;
      for (let si = 0; si < scenes.length; si++) {
        const sc = scenes[si];
        const buf = decodedBuffers.get(sc.id);
        const msPerScene = buf ? Math.max(2400, Math.ceil(buf.duration * 1000) + 250) : 3200;

        if (buf && audioCtx && audioDest) {
          const src = audioCtx.createBufferSource();
          src.buffer = buf;
          src.connect(audioDest);
          src.start();
        }

        const frames = Math.ceil(msPerScene / frameStepMs);
        for (let f = 0; f < frames; f++) {
          renderSceneToCanvas(ctx, script, sc, si, f / frames);
          setExportPct(Math.round(((si + f / frames) / scenes.length) * 100));
          await new Promise((r) => window.setTimeout(r, frameStepMs));
        }
      }

      recorder.stop();
      const blob = await donePromise;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clickcannabis-video-${script.key}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      onToast?.(`Vídeo "${script.title}" baixado com sucesso!`);
    } catch {
      onToast?.('Não foi possível gerar o arquivo de vídeo neste navegador.');
    } finally {
      if (audioCtx) {
        void audioCtx.close().catch(() => undefined);
      }
      setExporting(false);
      setExportPct(0);
    }
  };

  const recordedCount = useMemo(
    () => scenes.filter((sc) => Boolean(voiceUrls[sc.id])).length,
    [scenes, voiceUrls]
  );

  if (!scene) return null;

  const sceneHasCustomVoice = Boolean(voiceUrls[scene.id]);
  const sceneSharedAudioUrl = scene.audioUrl || sharedSceneAudios[scene.id];
  const sceneHasSharedAudio = Boolean(sceneSharedAudioUrl);
  const isRecordingCurrent = recordingSceneId === scene.id;
  const sceneProgressPct = Math.min(100, Math.round((elapsedSec / scene.durationSec) * 100));
  const totalPct = Math.round(((safeIdx + sceneProgressPct / 100) / scenes.length) * 100);

  const VisualIcon =
    scene.visualType === 'agendamento' || scene.visualType === 'reagendamento'
      ? Calendar
      : scene.visualType === 'confirmacao'
        ? CheckCircle2
        : scene.visualType === 'crm' || scene.visualType === 'kanban'
          ? Columns3
          : scene.visualType === 'medicos'
            ? Stethoscope
            : MessageSquare;

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
      {/* Header strip */}
      <div className="px-5 py-3.5 border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-bold text-[var(--accent)]">
            Videoaula Explicativa · {script.totalLabel}
            {recordedCount > 0 && ` · ${recordedCount}/${scenes.length} com sua voz`}
            {sceneHasSharedAudio && !sceneHasCustomVoice && ' · Áudio oficial compartilhado'}
            {voiceProfile?.enabled && ' · Voz IA personalizada ativa'}
          </span>
          <h3 className="text-base font-bold mt-0.5">{script.title}</h3>
          <p className="text-xs text-[var(--muted)]">{script.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onUpdateVoiceProfile && (
            <button
              type="button"
              onClick={() => setVoiceModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap shrink-0"
            >
              <Mic className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>{voiceProfile?.enabled ? 'Minha voz na IA (Ativa)' : 'Configurar minha voz IA'}</span>
            </button>
          )}
          <button
            type="button"
            disabled={exporting}
            onClick={handleDownloadWebm}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent)] disabled:opacity-55 whitespace-nowrap shrink-0"
          >
            {exporting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />
                <span>Gerando vídeo ({exportPct}%)</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span>Baixar vídeo (.webm)</span>
              </>
            )}
          </button>

          {onPracticeQuickSim && (
            <button
              type="button"
              onClick={onPracticeQuickSim}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-3 py-1.5 text-xs font-semibold hover:brightness-105 whitespace-nowrap shrink-0"
            >
              <Play className="h-3.5 w-3.5" />
              Praticar após o vídeo
            </button>
          )}
        </div>
      </div>

      {script.externalVideoUrl && (
        <div className="px-5 py-2.5 bg-[var(--accent-soft)] border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-[var(--ink)]">
            Vídeo complementar cadastrado pela coordenação:
          </span>
          <a
            href={script.externalVideoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] px-3 py-1 font-semibold hover:brightness-105"
          >
            <Play className="h-3 w-3" />
            Abrir vídeo externo
          </a>
        </div>
      )}

      {/* 16:9 Cinema Frame */}
      <div ref={stageRef} className="bg-[#0b2115] text-[#eef8f1] flex flex-col">
        <div className="relative aspect-video w-full p-4 md:p-7 flex flex-col justify-between bg-[radial-gradient(circle_at_top_right,rgba(76,199,122,0.16),transparent_55%)]">
          {/* Top overlay bar inside frame */}
          <div className="flex items-center justify-between gap-3">
            <ClickCannabisLogo onDark subtitle={scene.screenLabel} />
            <div className="flex items-center gap-2 text-xs font-mono-num text-[#cbead2]">
              {sceneHasCustomVoice ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(76,199,122,0.2)] border border-[rgba(143,232,156,0.4)] px-2 py-0.5 text-[11px] text-[#8fe89c]">
                  <Mic className="h-3 w-3" />
                  <span>Sua voz</span>
                </span>
              ) : sceneHasSharedAudio ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(76,199,122,0.2)] border border-[rgba(143,232,156,0.4)] px-2 py-0.5 text-[11px] text-[#8fe89c]">
                  <Volume2 className="h-3 w-3" />
                  <span>Áudio oficial</span>
                </span>
              ) : null}
              {loadingAudio && (
                <span className="inline-flex items-center gap-1 text-[#8fe89c]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Carregando áudio...</span>
                </span>
              )}
              <span>
                Cena {safeIdx + 1}/{scenes.length}
              </span>
            </div>
          </div>

          {/* Center Animated Scene Content */}
          <div className="my-auto py-3 space-y-4 max-w-[920px] w-full mx-auto">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-[rgba(143,232,156,0.16)] border border-[rgba(143,232,156,0.35)] text-[#8fe89c] grid place-items-center shrink-0">
                <VisualIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-mono-num text-[#8fe89c]">{scene.screenLabel}</p>
                <h4 className="text-lg md:text-2xl font-bold text-white leading-snug mt-0.5">
                  {scene.title}
                </h4>
              </div>
            </div>

            {/* 3 Visual Action Step Cards */}
            <div className="grid sm:grid-cols-3 gap-2.5">
              {scene.highlights.map((hl, idx) => (
                <div
                  key={hl}
                  className="rounded-xl border border-[rgba(143,232,156,0.28)] bg-[rgba(255,255,255,0.06)] px-3.5 py-3 space-y-1"
                >
                  <span className="text-[10px] font-mono-num font-bold text-[#8fe89c] block">
                    PASSO 0{idx + 1}
                  </span>
                  <strong className="text-xs md:text-sm text-white block leading-snug">
                    {hl}
                  </strong>
                </div>
              ))}
            </div>

            {/* Operational Rule Callout */}
            <div className="rounded-xl border border-[rgba(240,179,84,0.45)] bg-[rgba(251,236,210,0.1)] px-3.5 py-2.5 flex items-start gap-2 text-xs text-[#f8e7c9]">
              <AlertCircle className="h-4 w-4 text-[#f0b354] shrink-0 mt-0.5" />
              <p className="leading-relaxed">{scene.callout}</p>
            </div>
          </div>

          {/* Live Subtitles */}
          {showSubtitles ? (
            <div className="rounded-xl bg-[rgba(5,14,9,0.82)] border border-[rgba(255,255,255,0.12)] px-4 py-2.5 max-w-[88ch] mx-auto w-full text-center">
              <p className="text-xs md:text-sm text-[#f0faf3] leading-relaxed">{scene.narration}</p>
            </div>
          ) : (
            <div className="h-2" />
          )}

          {/* Play Overlay when paused at beginning */}
          {!playing && elapsedSec === 0 && (
            <button
              type="button"
              onClick={handleTogglePlay}
              aria-label={`Reproduzir ${script.title}`}
              className="absolute right-5 bottom-20 md:right-7 md:bottom-24 inline-flex items-center gap-2 rounded-xl bg-[#4cc77a] text-[#052110] px-4 py-2.5 text-xs font-bold shadow-xl hover:brightness-105 transition-transform"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>{sceneHasCustomVoice ? 'Assistir com sua voz' : 'Assistir videoaula'}</span>
            </button>
          )}
        </div>

        {/* Scrubber Progress Bar */}
        <div className="h-1.5 w-full bg-[rgba(255,255,255,0.12)]">
          <div
            className="h-full bg-[#4cc77a] transition-all duration-200"
            style={{ width: `${totalPct}%` }}
          />
        </div>

        {/* Player Controls Bar */}
        <div className="px-4 py-2.5 bg-[#081910] border-t border-[rgba(255,255,255,0.1)] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#4cc77a] text-[#052110] px-3 py-1.5 font-bold hover:brightness-105 whitespace-nowrap shrink-0"
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{playing ? 'Pausar' : 'Reproduzir'}</span>
            </button>

            <button
              type="button"
              disabled={safeIdx <= 0}
              onClick={() => handleGoScene(safeIdx - 1)}
              aria-label="Cena anterior"
              className="h-8 w-8 rounded-lg border border-[rgba(255,255,255,0.16)] grid place-items-center text-[#d5f3dc] hover:border-[#8fe89c] disabled:opacity-35"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              disabled={safeIdx >= scenes.length - 1}
              onClick={() => handleGoScene(safeIdx + 1)}
              aria-label="Próxima cena"
              className="h-8 w-8 rounded-lg border border-[rgba(255,255,255,0.16)] grid place-items-center text-[#d5f3dc] hover:border-[#8fe89c] disabled:opacity-35"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>

            <span className="ml-1.5 font-mono-num text-[#cbead2] whitespace-nowrap">
              Cena {safeIdx + 1}/{scenes.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSpeed((s) => (s === 1 ? 1.25 : s === 1.25 ? 1.5 : 1))}
              aria-label="Velocidade de reprodução"
              className="rounded-lg border border-[rgba(255,255,255,0.16)] px-2.5 py-1.5 font-mono-num font-semibold text-[#d5f3dc] hover:border-[#8fe89c] whitespace-nowrap shrink-0"
            >
              {speed}x
            </button>

            <button
              type="button"
              onClick={() => {
                if (!muted) stopAudio();
                setMuted((m) => !m);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-[rgba(255,255,255,0.16)] px-2.5 py-1.5 font-semibold text-[#d5f3dc] hover:border-[#8fe89c] whitespace-nowrap shrink-0"
            >
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              <span>{muted ? 'Sem áudio' : 'Áudio ativo'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSubtitles((s) => !s)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-semibold whitespace-nowrap shrink-0 ${
                showSubtitles
                  ? 'border-[#8fe89c] text-[#8fe89c]'
                  : 'border-[rgba(255,255,255,0.16)] text-[#d5f3dc]'
              }`}
            >
              <Captions className="h-3.5 w-3.5" />
              <span>Legendas</span>
            </button>

            <button
              type="button"
              onClick={handleToggleFullscreen}
              aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              className="h-8 w-8 rounded-lg border border-[rgba(255,255,255,0.16)] grid place-items-center text-[#d5f3dc] hover:border-[#8fe89c]"
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Custom Voice Studio Bar — No robotic voice */}
      <div className="px-4 py-3 bg-[var(--surface)] border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-[var(--accent)] shrink-0" />
            <strong className="text-xs font-bold text-[var(--ink)]">
              Usar a minha voz nesta cena (Cena {safeIdx + 1}/{scenes.length})
            </strong>
            {sceneHasCustomVoice ? (
              <span className="text-[11px] font-bold text-[var(--accent)]">
                · Gravada (voz humana real)
              </span>
            ) : aiConfigured ? (
              <span className="text-[11px] text-[var(--muted)]">
                · Usando narração neural natural até você gravar a sua
              </span>
            ) : (
              <span className="text-[11px] text-[var(--muted)]">
                · Sem voz robotizada — grave ou envie seu áudio para narrar
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            Leia a legenda exibida no vídeo acima ao gravar. Sua gravação fica salva neste navegador
            e também sai no vídeo baixado (.webm).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleUploadAudioFile}
            className="hidden"
          />

          <button
            type="button"
            onClick={handleToggleRecordVoice}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
              isRecordingCurrent
                ? 'bg-[var(--danger)] text-white'
                : 'bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-105'
            }`}
          >
            {isRecordingCurrent ? (
              <>
                <Square className="h-3.5 w-3.5 fill-current" />
                <span>Parar gravação ({recordingSecs}s)</span>
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5" />
                <span>{sceneHasCustomVoice ? 'Regravar minha voz' : 'Gravar minha voz'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:border-[var(--accent)] whitespace-nowrap shrink-0"
          >
            <Upload className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>Enviar áudio</span>
          </button>

          {sceneHasCustomVoice && (
            <>
              <button
                type="button"
                onClick={handlePreviewMyVoice}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:border-[var(--accent)] whitespace-nowrap shrink-0"
              >
                {previewingVoice ? (
                  <Pause className="h-3.5 w-3.5 text-[var(--accent)]" />
                ) : (
                  <Play className="h-3.5 w-3.5 text-[var(--accent)]" />
                )}
                <span>{previewingVoice ? 'Parar' : 'Ouvir minha voz'}</span>
              </button>

              <button
                type="button"
                onClick={handleDeleteMyVoice}
                aria-label="Remover gravação da cena"
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs font-semibold text-[var(--danger)] hover:border-[var(--danger)] whitespace-nowrap shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Remover</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Chapter Timeline Buttons */}
      <div className="p-3 bg-[var(--surface-2)] border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {scenes.map((sc, i) => {
            const hasRec = Boolean(voiceUrls[sc.id]);
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => handleGoScene(i)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-left transition-colors whitespace-nowrap shrink-0 ${
                  i === safeIdx
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {hasRec && <Mic className="h-3 w-3 text-[var(--accent)] shrink-0" />}
                <span>{sc.title}</span>
              </button>
            );
          })}
        </div>

        {onPracticeTour && (
          <button
            type="button"
            onClick={onPracticeTour}
            className="text-xs font-semibold text-[var(--accent)] hover:underline whitespace-nowrap shrink-0"
          >
            Fazer passo a passo guiado →
          </button>
        )}
      </div>

      {voiceModalOpen && onUpdateVoiceProfile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Configuração de voz da IA"
          className="fixed inset-0 z-[75] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setVoiceModalOpen(false);
          }}
        >
          <div className="w-full max-w-[760px] rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4 md:p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <strong className="text-sm font-bold">Substituir voz padrão pela sua voz</strong>
              <button
                type="button"
                onClick={() => setVoiceModalOpen(false)}
                aria-label="Fechar"
                className="h-8 w-8 rounded-lg border border-[var(--line)] bg-[var(--surface)] grid place-items-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <VoiceConfigPanel
              speakerName={speakerName}
              aiConfigured={aiConfigured}
              voiceProfile={voiceProfile}
              onUpdateVoiceProfile={onUpdateVoiceProfile}
              onToast={(msg) => onToast?.(msg)}
            />
          </div>
        </div>
      )}
    </section>
  );
}
