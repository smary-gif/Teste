import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  CheckCircle2,
  Loader2,
  Mic,
  Pause,
  Play,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import { deleteSceneVoice, loadAllSceneVoices, saveSceneVoice } from '../lib/voiceStorage';
import type { AiVoiceProfile } from '../types';

export const GLOBAL_VOICE_SAMPLE_KEY = '__global_voice_sample__';

interface VoiceConfigPanelProps {
  speakerName: string;
  aiConfigured: boolean;
  voiceProfile: AiVoiceProfile | null;
  onUpdateVoiceProfile: (next: AiVoiceProfile | null) => void;
  onToast: (msg: string) => void;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Erro ao ler o áudio.'));
    reader.readAsDataURL(blob);
  });
}

export function VoiceConfigPanel({
  speakerName,
  aiConfigured,
  voiceProfile,
  onUpdateVoiceProfile,
  onToast,
}: VoiceConfigPanelProps) {
  const [sampleBlob, setSampleBlob] = useState<Blob | null>(null);
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [processingAi, setProcessingAi] = useState(false);
  const [testingTts, setTestingTts] = useState(false);
  const [playingSample, setPlayingSample] = useState(false);
  const [playingAiTest, setPlayingAiTest] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sampleUrlRef = useRef<string | null>(null);
  sampleUrlRef.current = sampleUrl;

  useEffect(() => {
    let active = true;
    void loadAllSceneVoices().then((all) => {
      if (!active) return;
      const found = all[GLOBAL_VOICE_SAMPLE_KEY];
      if (found) {
        setSampleBlob(found);
        setSampleUrl(URL.createObjectURL(found));
      }
    });
    return () => {
      active = false;
      if (sampleUrlRef.current) URL.revokeObjectURL(sampleUrlRef.current);
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingSample(false);
    setPlayingAiTest(false);
  }, []);

  const stopRecStream = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    setRecording(false);
    setRecordSecs(0);
  }, []);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      stopRecStream();
    };
  }, [stopRecStream]);

  const handleProcessWithAi = useCallback(
    async (blobToUse: Blob) => {
      if (!aiConfigured) {
        onToast('Amostra salva! Configure a chave da IA para processar o perfil vocal.');
        return;
      }
      setProcessingAi(true);
      try {
        const audioBase64 = await blobToBase64(blobToUse);
        const resp = await fetch('/api/ai/analyze-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64,
            mimeType: blobToUse.type || 'audio/webm',
            speakerName,
          }),
        });
        const data = (await resp.json()) as Partial<AiVoiceProfile> & { error?: string };
        if (!resp.ok) {
          throw new Error(data.error || 'Erro ao analisar amostra de voz.');
        }

        const nextProfile: AiVoiceProfile = {
          enabled: true,
          speakerName,
          transcript: data.transcript || '',
          timbre: data.timbre || 'Voz natural personalizada',
          pace: data.pace || 'moderado',
          matchedBaseVoice: data.matchedBaseVoice || 'Kore',
          ttsStylePrompt: data.ttsStylePrompt || '',
          summary: data.summary || 'Perfil vocal processado pela IA.',
          updatedAt: Date.now(),
        };
        onUpdateVoiceProfile(nextProfile);
        onToast('Voz processada pela IA! As narrações padrão foram substituídas.');
      } catch (err) {
        onToast(err instanceof Error ? err.message : 'Não foi possível processar o áudio na IA.');
      } finally {
        setProcessingAi(false);
      }
    },
    [aiConfigured, speakerName, onUpdateVoiceProfile, onToast]
  );

  const persistSample = useCallback(
    async (blob: Blob, autoProcess = true) => {
      await saveSceneVoice(GLOBAL_VOICE_SAMPLE_KEY, blob);
      const nextUrl = URL.createObjectURL(blob);
      setSampleBlob(blob);
      setSampleUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
      if (autoProcess && aiConfigured) {
        await handleProcessWithAi(blob);
      } else {
        onToast('Amostra da sua voz salva!');
      }
    },
    [aiConfigured, handleProcessWithAi, onToast]
  );

  const handleToggleRecord = async () => {
    if (recording) {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      onToast('Microfone indisponível neste navegador. Use "Enviar arquivo de áudio".');
      return;
    }

    stopAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;

      const chunks: Blob[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        stopRecStream();
        if (blob.size > 0) {
          void persistSample(blob, true);
        }
      };

      setRecording(true);
      setRecordSecs(0);
      timerRef.current = window.setInterval(() => setRecordSecs((s) => s + 1), 1000);
      recorder.start();
    } catch {
      stopRecStream();
      onToast('Permissão do microfone negada. Você também pode enviar um áudio gravado.');
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    stopAudio();
    await persistSample(file, true);
  };

  const handlePlaySample = () => {
    if (!sampleUrl) return;
    if (playingSample) {
      stopAudio();
      return;
    }
    stopAudio();
    const audio = new Audio(sampleUrl);
    audioRef.current = audio;
    setPlayingSample(true);
    audio.onended = () => setPlayingSample(false);
    audio.onerror = () => setPlayingSample(false);
    void audio.play().catch(() => setPlayingSample(false));
  };

  const handleTestAiVoice = async () => {
    if (!voiceProfile || !aiConfigured) return;
    if (playingAiTest) {
      stopAudio();
      return;
    }
    stopAudio();
    setTestingTts(true);
    try {
      const resp = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Olá, sou ${speakerName}. Esta é a sua voz configurada na Central de Treinamentos ClickCannabis para explicar os subsetores com clareza e acolhimento.`,
          voiceProfile: {
            matchedBaseVoice: voiceProfile.matchedBaseVoice,
            ttsStylePrompt: voiceProfile.ttsStylePrompt,
          },
        }),
      });
      const data = (await resp.json()) as { audioBase64?: string; mimeType?: string; error?: string };
      if (!resp.ok || !data.audioBase64) {
        throw new Error(data.error || 'Falha ao testar a voz na IA.');
      }
      const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
      audioRef.current = audio;
      setPlayingAiTest(true);
      audio.onended = () => setPlayingAiTest(false);
      audio.onerror = () => setPlayingAiTest(false);
      await audio.play();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao reproduzir teste de voz.');
    } finally {
      setTestingTts(false);
    }
  };

  const handleClearVoice = async () => {
    stopAudio();
    await deleteSceneVoice(GLOBAL_VOICE_SAMPLE_KEY);
    if (sampleUrl) URL.revokeObjectURL(sampleUrl);
    setSampleBlob(null);
    setSampleUrl(null);
    onUpdateVoiceProfile(null);
    onToast('Amostra e perfil de voz removidos.');
  };

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <AudioLines className="h-4 w-4 text-[var(--accent)]" />
            <h2 className="text-base font-bold">Configuração de Voz da IA (Minha Voz)</h2>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1 max-w-[76ch]">
            Grave ou envie uma amostra da sua própria voz (10 a 20 segundos). A IA analisa seu
            timbre, ritmo e entonação para substituir a voz sintetizada padrão nas narrações do
            portal.
          </p>
        </div>

        {voiceProfile && (
          <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={voiceProfile.enabled}
              onChange={(e) =>
                onUpdateVoiceProfile({ ...voiceProfile, enabled: e.target.checked })
              }
              className="accent-[var(--accent)]"
            />
            <span>Usar meu perfil vocal nas videoaulas</span>
          </label>
        )}
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5 text-xs space-y-1.5">
        <span className="font-bold text-[var(--accent)] block">
          Sugestão de leitura para gravar sua amostra:
        </span>
        <p className="text-[var(--ink)] italic leading-relaxed">
          "Olá! Aqui na ClickCannabis atendemos cada paciente com atenção, agilidade e clareza.
          Antes de responder no chat, sempre conferimos a negociação, registramos a nota completa e
          seguimos a regra das duas horas."
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleUploadFile}
          className="hidden"
        />

        <button
          type="button"
          onClick={handleToggleRecord}
          disabled={processingAi}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap ${
            recording
              ? 'bg-[var(--danger)] text-white'
              : 'bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-105'
          }`}
        >
          {recording ? (
            <>
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>Parar gravação ({recordSecs}s)</span>
            </>
          ) : (
            <>
              <Mic className="h-3.5 w-3.5" />
              <span>{sampleBlob ? 'Gravar nova amostra' : 'Gravar minha voz'}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={processingAi || recording}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
        >
          <Upload className="h-3.5 w-3.5 text-[var(--accent)]" />
          <span>Subir áudio (.mp3 / .wav / .m4a)</span>
        </button>

        {sampleUrl && (
          <button
            type="button"
            onClick={handlePlaySample}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
          >
            {playingSample ? (
              <Pause className="h-3.5 w-3.5 text-[var(--accent)]" />
            ) : (
              <Play className="h-3.5 w-3.5 text-[var(--accent)]" />
            )}
            <span>{playingSample ? 'Pausar amostra' : 'Ouvir amostra gravada'}</span>
          </button>
        )}

        {sampleBlob && (
          <button
            type="button"
            disabled={processingAi || !aiConfigured}
            onClick={() => void handleProcessWithAi(sampleBlob)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] px-3.5 py-2 text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
          >
            {processingAi ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>{processingAi ? 'Processando voz na IA...' : 'Reprocessar voz com IA'}</span>
          </button>
        )}

        {(sampleBlob || voiceProfile) && (
          <button
            type="button"
            onClick={() => void handleClearVoice()}
            className="inline-flex items-center gap-1 rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--danger)] hover:border-[var(--danger)] whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Limpar</span>
          </button>
        )}
      </div>

      {voiceProfile && (
        <div className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)]/35 p-4 space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[var(--accent)] shrink-0" />
              <strong className="text-sm text-[var(--ink)]">
                Perfil vocal processado pela IA ({voiceProfile.speakerName})
              </strong>
            </div>

            {aiConfigured && (
              <button
                type="button"
                disabled={testingTts}
                onClick={() => void handleTestAiVoice()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
              >
                {testingTts ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : playingAiTest ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
                <span>
                  {testingTts
                    ? 'Gerando prévia...'
                    : playingAiTest
                      ? 'Parar prévia IA'
                      : 'Testar voz processada pela IA'}
                </span>
              </button>
            )}
          </div>

          <div className="grid sm:grid-cols-3 gap-2">
            <div className="rounded-lg bg-[var(--surface)] border border-[var(--line)] px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block">
                Timbre captado
              </span>
              <strong className="text-[var(--ink)]">{voiceProfile.timbre}</strong>
            </div>
            <div className="rounded-lg bg-[var(--surface)] border border-[var(--line)] px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block">
                Ritmo de fala
              </span>
              <strong className="text-[var(--ink)] capitalize">{voiceProfile.pace}</strong>
            </div>
            <div className="rounded-lg bg-[var(--surface)] border border-[var(--line)] px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block">
                Modelo vocal aplicado
              </span>
              <strong className="text-[var(--ink)]">{voiceProfile.matchedBaseVoice} (Voice Design)</strong>
            </div>
          </div>

          <p className="text-[var(--muted)] leading-relaxed">{voiceProfile.summary}</p>
          {voiceProfile.transcript && (
            <p className="text-[11px] text-[var(--muted)]">
              <strong className="text-[var(--ink)]">Transcrição verificada:</strong> "
              {voiceProfile.transcript}"
            </p>
          )}
        </div>
      )}
    </section>
  );
}
