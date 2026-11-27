import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SHARED_MEDIA_DIR = path.resolve(__dirname, 'public', 'shared-media');
const SHARED_CONTENT_FILE = path.join(SHARED_MEDIA_DIR, 'portal-content.json');

const PORT = Number(process.env.PORT) || 3000;
const MODEL = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractApiError(err: unknown): { status: number; message: string } {
  const anyErr = err as { status?: number; message?: string };
  const msg = anyErr?.message || 'Erro ao consultar a API do Gemini.';
  const status = typeof anyErr?.status === 'number' && anyErr.status >= 400 ? anyErr.status : 500;
  if (msg.includes('API_KEY_INVALID') || status === 400) {
    return { status: 400, message: 'Chave da API Gemini inválida. Verifique em Settings > Secrets.' };
  }
  if (msg.includes('PERMISSION_DENIED') || status === 403) {
    return { status: 403, message: 'Permissão negada na API Gemini. Verifique a chave em Settings > Secrets.' };
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || status === 429) {
    return { status: 429, message: 'Limite de requisições atingido na API Gemini. Tente novamente em instantes.' };
  }
  return { status, message: msg };
}

async function startServer() {
  fs.mkdirSync(SHARED_MEDIA_DIR, { recursive: true });
  const app = express();
  app.use(express.json({ limit: '25mb' }));
  app.use('/shared-media', express.static(SHARED_MEDIA_DIR));

  app.get('/api/ai/status', (_req: Request, res: Response) => {
    const ai = getAiClient();
    res.json({ configured: Boolean(ai) });
  });

  const cleanEnvVal = (raw: string | undefined): string =>
    (raw || '').trim().replace(/^["']+|["']+$/g, '').trim();

  const DEFAULT_FIREBASE_CONFIG = {
    authDomain: 'gen-lang-client-0095658311.firebaseapp.com',
    projectId: 'gen-lang-client-0095658311',
    storageBucket: 'gen-lang-client-0095658311.firebasestorage.app',
    messagingSenderId: '54395473467',
    appId: '1:54395473467:web:7898264b116f0a7624561e',
  };

  const readFirebaseEnvConfig = () => {
    const rawApiKey = cleanEnvVal(process.env.FIREBASE_API_KEY);
    if (!rawApiKey || rawApiKey === 'MY_FIREBASE_API_KEY') {
      return {
        config: null,
        issueCode: 'MISSING_API_KEY' as const,
        issueMessage:
          'Configure a chave FIREBASE_API_KEY (começando com AIza...) em Settings > Secrets para ativar o Login com Google.',
      };
    }

    if (!/^AIza[0-9A-Za-z_-]{20,}$/.test(rawApiKey)) {
      return {
        config: null,
        issueCode: 'INVALID_API_KEY_FORMAT' as const,
        issueMessage:
          'O valor salvo em FIREBASE_API_KEY em Settings > Secrets não é uma chave de API do Google válida (deve começar com "AIza..."). Corrija a chave em Settings > Secrets.',
      };
    }

    const rawDomain = cleanEnvVal(process.env.FIREBASE_AUTH_DOMAIN)
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '');
    const authDomain = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(rawDomain)
      ? rawDomain
      : DEFAULT_FIREBASE_CONFIG.authDomain;

    const rawProjectId = cleanEnvVal(process.env.FIREBASE_PROJECT_ID);
    const projectId = /^[a-z0-9-]{4,}$/.test(rawProjectId)
      ? rawProjectId
      : DEFAULT_FIREBASE_CONFIG.projectId;

    const rawStorageBucket = cleanEnvVal(process.env.FIREBASE_STORAGE_BUCKET);
    const storageBucket = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(rawStorageBucket)
      ? rawStorageBucket
      : DEFAULT_FIREBASE_CONFIG.storageBucket;

    const rawSenderId = cleanEnvVal(process.env.FIREBASE_MESSAGING_SENDER_ID);
    const messagingSenderId = /^\d{6,}$/.test(rawSenderId)
      ? rawSenderId
      : DEFAULT_FIREBASE_CONFIG.messagingSenderId;

    const rawAppId = cleanEnvVal(process.env.FIREBASE_APP_ID);
    const appId = /^1:\d+:web:[a-f0-9]+$/i.test(rawAppId)
      ? rawAppId
      : DEFAULT_FIREBASE_CONFIG.appId;

    return {
      config: {
        apiKey: rawApiKey,
        authDomain,
        projectId,
        storageBucket,
        messagingSenderId,
        appId,
      },
      issueCode: null,
      issueMessage: null,
    };
  };

  const resolveActiveFirebaseConfig = () => {
    const envResult = readFirebaseEnvConfig();
    if (envResult.config) {
      return {
        configured: true as const,
        source: 'env' as const,
        config: envResult.config,
        issueCode: null,
        issueMessage: null,
      };
    }

    const localCfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(localCfgPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(localCfgPath, 'utf-8')) as {
          apiKey?: string;
          authDomain?: string;
          projectId?: string;
          storageBucket?: string;
          messagingSenderId?: string;
          appId?: string;
        };
        if (parsed.apiKey && /^AIza[0-9A-Za-z_-]{20,}$/.test(parsed.apiKey)) {
          return {
            configured: true as const,
            source: 'local-config' as const,
            config: {
              apiKey: parsed.apiKey,
              authDomain: parsed.authDomain || DEFAULT_FIREBASE_CONFIG.authDomain,
              projectId: parsed.projectId || DEFAULT_FIREBASE_CONFIG.projectId,
              storageBucket: parsed.storageBucket || DEFAULT_FIREBASE_CONFIG.storageBucket,
              messagingSenderId:
                parsed.messagingSenderId || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
              appId: parsed.appId || DEFAULT_FIREBASE_CONFIG.appId,
            },
            issueCode: null,
            issueMessage: null,
          };
        }
      } catch {
        // fall through to unconfigured response
      }
    }

    return {
      configured: false as const,
      source: 'none' as const,
      config: null,
      issueCode: envResult.issueCode,
      issueMessage: envResult.issueMessage,
    };
  };

  app.get('/api/auth/firebase-config', (_req: Request, res: Response) => {
    const resolved = resolveActiveFirebaseConfig();
    res.json({
      configured: resolved.configured,
      config: resolved.config,
      ...(resolved.issueCode ? { issueCode: resolved.issueCode, issueMessage: resolved.issueMessage } : {}),
    });
  });

  app.get('/api/auth/diagnose', async (req: Request, res: Response) => {
    const resolved = resolveActiveFirebaseConfig();
    const cfg = resolved.config;
    if (!cfg) {
      res.json({
        configured: false,
        ok: false,
        reason: resolved.issueCode,
        message: resolved.issueMessage,
      });
      return;
    }

    const checks = {
      source: resolved.source,
      apiKeyStartsWithAIza: /^AIza[0-9A-Za-z_-]{20,}$/.test(cfg.apiKey),
      apiKeyHasSpaces: /\s/.test(cfg.apiKey),
      authDomainValid: /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(cfg.authDomain),
      projectIdValid: /^[a-z0-9-]+$/.test(cfg.projectId),
      appIdValid: /^1:\d+:web:[a-f0-9]+$/i.test(cfg.appId),
    };

    const originHeader =
      (typeof req.headers.origin === 'string' && req.headers.origin) ||
      (typeof req.headers.referer === 'string' && req.headers.referer) ||
      `https://${cfg.authDomain}/`;

    let identityStatus = 0;
    let identityReason = '';
    let authorizedDomains: string[] = [];
    try {
      const resp = await fetch(
        `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=${encodeURIComponent(cfg.apiKey)}`,
        {
          headers: {
            Referer: originHeader,
          },
        }
      );
      identityStatus = resp.status;
      const body = (await resp.json().catch(() => ({}))) as {
        authorizedDomains?: string[];
        error?: { message?: string; errors?: Array<{ reason?: string; message?: string }> };
      };
      if (resp.ok) {
        authorizedDomains = Array.isArray(body.authorizedDomains) ? body.authorizedDomains : [];
      } else {
        identityReason =
          body.error?.errors?.[0]?.reason || body.error?.message || `HTTP_${resp.status}`;
      }
    } catch (err) {
      identityReason = err instanceof Error ? err.message : 'FETCH_ERROR';
    }

    res.json({
      configured: true,
      ok: identityStatus === 200 && checks.apiKeyStartsWithAIza && checks.authDomainValid && checks.appIdValid,
      checks,
      identityStatus,
      identityReason,
      authorizedDomainsCount: authorizedDomains.length,
      currentHostAuthorized: authorizedDomains.some((d) =>
        originHeader.includes(d)
      ),
    });
  });

  app.get('/api/shared/content', (_req: Request, res: Response) => {
    try {
      if (!fs.existsSync(SHARED_CONTENT_FILE)) {
        res.json({});
        return;
      }
      const raw = fs.readFileSync(SHARED_CONTENT_FILE, 'utf-8');
      res.json(JSON.parse(raw));
    } catch {
      res.json({});
    }
  });

  app.post('/api/shared/content', (req: Request, res: Response) => {
    try {
      fs.mkdirSync(SHARED_MEDIA_DIR, { recursive: true });
      const existing = fs.existsSync(SHARED_CONTENT_FILE)
        ? (JSON.parse(fs.readFileSync(SHARED_CONTENT_FILE, 'utf-8')) as Record<string, unknown>)
        : {};
      const incoming = (req.body || {}) as Record<string, unknown>;

      const mergeRecordField = (field: string) => {
        const prevObj =
          existing[field] && typeof existing[field] === 'object'
            ? (existing[field] as Record<string, unknown>)
            : undefined;
        const nextObj =
          incoming[field] && typeof incoming[field] === 'object'
            ? (incoming[field] as Record<string, unknown>)
            : undefined;
        if (!prevObj && !nextObj) return undefined;
        return { ...(prevObj || {}), ...(nextObj || {}) };
      };

      const prevCustom = Array.isArray(existing.customCollaborators)
        ? (existing.customCollaborators as string[])
        : [];
      const nextCustom = Array.isArray(incoming.customCollaborators)
        ? (incoming.customCollaborators as string[])
        : [];
      const mergedCustom =
        prevCustom.length || nextCustom.length
          ? Array.from(new Set([...nextCustom, ...prevCustom]))
          : undefined;

      const merged: Record<string, unknown> = {
        ...existing,
        ...incoming,
        updatedAt: Date.now(),
      };

      for (const field of [
        'teamSubsectors',
        'opsAccessOverrides',
        'traineeByPerson',
        'reciclagemByPerson',
        'trilhaData',
        'cronoRecords',
      ]) {
        const m = mergeRecordField(field);
        if (m !== undefined) merged[field] = m;
      }
      if (mergedCustom !== undefined) {
        merged.customCollaborators = mergedCustom;
      }

      fs.writeFileSync(SHARED_CONTENT_FILE, JSON.stringify(merged, null, 2), 'utf-8');
      res.json(merged);
    } catch {
      res.status(500).json({ error: 'Não foi possível salvar os conteúdos compartilhados no servidor.' });
    }
  });

  app.post('/api/shared/audio', (req: Request, res: Response) => {
    const { sceneId, audioBase64, mimeType } = req.body as {
      sceneId?: string;
      audioBase64?: string;
      mimeType?: string;
    };

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      res.status(400).json({ error: 'Áudio não enviado.' });
      return;
    }

    const safeId = String(sceneId || 'geral')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    const cleanMime = typeof mimeType === 'string' ? mimeType.split(';')[0].toLowerCase() : 'audio/webm';
    const extMap: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/wave': 'wav',
      'audio/x-wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/mp4': 'm4a',
      'audio/x-m4a': 'm4a',
      'audio/aac': 'aac',
      'audio/webm': 'webm',
    };
    const ext = extMap[cleanMime] || 'webm';
    const fileName = `${safeId}-${Date.now()}.${ext}`;
    const targetPath = path.join(SHARED_MEDIA_DIR, fileName);

    try {
      fs.mkdirSync(SHARED_MEDIA_DIR, { recursive: true });
      const buffer = Buffer.from(audioBase64, 'base64');
      fs.writeFileSync(targetPath, buffer);
      res.json({ url: `/shared-media/${fileName}`, fileName });
    } catch {
      res.status(500).json({ error: 'Falha ao salvar o arquivo de áudio no servidor.' });
    }
  });

  app.delete('/api/shared/audio/:fileName', (req: Request, res: Response) => {
    const rawName = path.basename(String(req.params.fileName || ''));
    if (!rawName || rawName === 'portal-content.json') {
      res.status(400).json({ error: 'Arquivo inválido.' });
      return;
    }
    const targetPath = path.join(SHARED_MEDIA_DIR, rawName);
    try {
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Erro ao remover o arquivo.' });
    }
  });

  app.post('/api/ai/patient-reply', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY não configurada no servidor. Ative o modo Roteiro Offline ou configure a chave em Settings > Secrets.',
      });
      return;
    }

    const { patient, history, phaseText } = req.body as {
      patient?: {
        nome: string;
        isMed?: boolean;
        key: string;
        dept: string;
        data: string;
        hora: string;
        medico: string;
        scenarioDesc: string;
      };
      history?: Array<{ from: string; text: string }>;
      phaseText?: string;
    };

    if (!patient || !Array.isArray(history)) {
      res.status(400).json({ error: 'Dados da conversa inválidos.' });
      return;
    }

    const who = patient.isMed ? '[Médico(a)] ' : '[Paciente] ';
    const convo = history
      .filter((m) => m.from !== 'evt')
      .slice(-14)
      .map((m) => {
        if (m.from === 'pac') return `${who}${m.text}`;
        if (m.from === 'op') return `[Clínica] ${m.text}`;
        return `[Clínica - mensagem automática] ${m.text}`;
      })
      .join('\n');

    const role = patient.isMed
      ? 'Você interpreta um(a) MÉDICO(A) FICTÍCIO(A) que atende por telemedicina e fala com a equipe de suporte da clínica pelo chat.'
      : 'Você interpreta um PACIENTE FICTÍCIO de uma clínica de telemedicina, conversando pelo WhatsApp com a equipe de atendimento.';

    const prompt = `${role} Isto é um treinamento corporativo de atendentes (do nível básico ao avançado). Escreva SOMENTE a próxima mensagem ${
      patient.isMed ? 'do(a) médico(a)' : 'do paciente'
    }: 1 ou 2 frases curtas, português do Brasil, tom natural de WhatsApp, sem aspas e sem prefixo. Nunca fale como a equipe da clínica e nunca saia do personagem. Se a equipe fizer uma pergunta objetiva, responda de forma coerente com o seu perfil.

Nome: ${patient.nome}.${
      patient.isMed
        ? ''
        : patient.key === 'solicitacoes'
          ? ` Quer fazer uma solicitação ao médico ${patient.medico}.`
          : ` Consulta hoje (${patient.data}) às ${patient.hora} com ${patient.medico}.`
    }
Setor do atendimento: ${patient.dept}.
Perfil e situação: ${patient.scenarioDesc}${phaseText ? `\nMomento atual: ${phaseText}` : ''}

Conversa até agora:
${convo}

Próxima mensagem ${patient.isMed ? 'do(a) médico(a)' : 'do paciente'}:`;

    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      const reply = (response.text || '')
        .replace(/^\s*\[?(Paciente|Médico\(a\))\]?:?\s*/i, '')
        .trim();
      res.json({ reply });
    } catch (err) {
      const parsed = extractApiError(err);
      res.status(parsed.status).json({ error: parsed.message });
    }
  });

  app.post('/api/ai/coach', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY não configurada no servidor. Configure a chave em Settings > Secrets para usar o Guia IA.',
      });
      return;
    }

    const { question, currentStep, subsetoresText, rulesText, shortcutsText } = req.body as {
      question?: string;
      currentStep?: string;
      subsetoresText?: string;
      rulesText?: string;
      shortcutsText?: string;
    };

    if (!question || !question.trim()) {
      res.status(400).json({ error: 'Pergunta vazia.' });
      return;
    }

    const prompt = `Você é o Guia IA de um programa de treinamento corporativo intensivo (Trainee de 3 dias, do nível básico ao avançado) para atendentes de uma clínica de telemedicina. Responda em português do Brasil, em no máximo 3 frases curtas, de forma direta, firme e prática. Todos os dados do treino são fictícios.

Passo atual do treino: ${currentStep || 'treino livre'}

Passo a passo dos subsetores:
${subsetoresText || ''}

Regras do setor de Confirmação:
${rulesText || ''}

Atalhos de mensagem:
${shortcutsText || ''}

Pergunta da pessoa em treinamento: ${question.trim()}`;

    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      res.json({ answer: (response.text || '').trim() });
    } catch (err) {
      const parsed = extractApiError(err);
      res.status(parsed.status).json({ error: parsed.message });
    }
  });

  app.post('/api/ai/evaluate-case', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY não configurada no servidor para avaliação por IA.',
      });
      return;
    }

    const { patient, messages, notes, atendStatus, dept } = req.body as {
      patient?: { nome: string; dept: string; scenarioDesc: string; status: string };
      messages?: Array<{ from: string; text: string; label?: string }>;
      notes?: Array<{ tipo: string; text: string }>;
      atendStatus?: string;
      dept?: string;
    };

    if (!patient || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Dados do caso incompletos.' });
      return;
    }

    const transcript = messages
      .map((m) => `[${m.from}${m.label ? ` · ${m.label}` : ''}]: ${m.text}`)
      .join('\n');
    const notesText = (notes || []).map((n) => `- (${n.tipo}) ${n.text}`).join('\n') || 'Nenhuma nota registrada.';

    const prompt = `Você é uma instrutora rigorosa de treinamento corporativo (padrão Trainee Hard). Avalie o atendimento simulado abaixo segundo as normas da clínica:
- Regra das 2 horas (usar /devido se < 2h ou falta).
- Tolerância de até 5 minutos (/importante no agendamento/confirmação).
- Confirmação (/confirmacao após paciente confirmar) e acesso (/acesso, /aguarde, /aguarde2, /faltou).
- Nunca orientar ou alterar dose/posologia (abrir Solicitação ao médico).
- Registrar notas internas claras de contato/ocorrência e definir o status/departamento corretos.

Setor original: ${patient.dept} | Setor atual: ${dept} | Status atendimento: ${atendStatus}
Cenário: ${patient.scenarioDesc}

Transcrição:
${transcript}

Notas internas:
${notesText}

Dê um parecer objetivo em português do Brasil com:
1) Veredito curto (Aprovado no caso / Precisa ajustar).
2) O que foi feito corretamente.
3) O que faltou ou violou o protocolo (seja exigente).`;

    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      res.json({ feedback: (response.text || '').trim() });
    } catch (err) {
      const parsed = extractApiError(err);
      res.status(parsed.status).json({ error: parsed.message });
    }
  });

  app.post('/api/ai/analyze-voice', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY não configurada no servidor para processar a amostra de voz.',
      });
      return;
    }

    const { audioBase64, mimeType, speakerName } = req.body as {
      audioBase64?: string;
      mimeType?: string;
      speakerName?: string;
    };

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      res.status(400).json({ error: 'Áudio da amostra não enviado.' });
      return;
    }

    const cleanMime =
      typeof mimeType === 'string' && mimeType.startsWith('audio/')
        ? mimeType.split(';')[0]
        : 'audio/webm';

    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: cleanMime,
                data: audioBase64,
              },
            },
            {
              text: `Analise esta gravação de voz de ${speakerName || 'uma colaboradora'} em português do Brasil para configurar a narração da IA nos vídeos e treinamentos da ClickCannabis.
Extraia:
1) transcript: transcrição fiel do que foi falado.
2) timbre: descrição curta em português do timbre e qualidade vocal (ex: "Voz feminina clara, acolhedora e firme").
3) pace: ritmo predominante ("pausado", "moderado" ou "dinâmico").
4) matchedBaseVoice: escolha a voz base que mais se aproxima do registro vocal dentre exatamente: "Kore" (feminina clara/equilibrada), "Zephyr" (feminina suave/brilhante), "Puck" (ágil/expressiva), "Charon" (grave/serena), "Fenrir" (grave/firme).
5) ttsStylePrompt: instrução em inglês detalhada para direcionar síntese de fala (Voice Design) reproduzindo esse timbre, entonação, velocidade e naturalidade em português do Brasil.
6) summary: 1 frase curta em português resumindo o perfil vocal captado.`,
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcript: { type: Type.STRING },
              timbre: { type: Type.STRING },
              pace: { type: Type.STRING },
              matchedBaseVoice: { type: Type.STRING },
              ttsStylePrompt: { type: Type.STRING },
              summary: { type: Type.STRING },
            },
            required: ['transcript', 'timbre', 'pace', 'matchedBaseVoice', 'ttsStylePrompt', 'summary'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim()) as {
        transcript?: string;
        timbre?: string;
        pace?: string;
        matchedBaseVoice?: string;
        ttsStylePrompt?: string;
        summary?: string;
      };

      const allowedVoices = new Set(['Kore', 'Zephyr', 'Puck', 'Charon', 'Fenrir']);
      const matchedBaseVoice = allowedVoices.has(parsed.matchedBaseVoice || '')
        ? parsed.matchedBaseVoice!
        : 'Kore';

      res.json({
        transcript: parsed.transcript || '',
        timbre: parsed.timbre || 'Voz natural em português do Brasil',
        pace: parsed.pace || 'moderado',
        matchedBaseVoice,
        ttsStylePrompt:
          parsed.ttsStylePrompt ||
          'Natural, warm Brazilian Portuguese speaker with clear articulation and steady moderate pace',
        summary:
          parsed.summary || 'Perfil vocal processado pela IA para substituir a voz padrão.',
      });
    } catch (err) {
      const parsedErr = extractApiError(err);
      res.status(parsedErr.status).json({ error: parsedErr.message });
    }
  });

  app.post('/api/ai/tts', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY não configurada para narração neural.',
      });
      return;
    }

    const { text, voiceProfile } = req.body as {
      text?: string;
      voiceProfile?: {
        matchedBaseVoice?: string;
        ttsStylePrompt?: string;
      } | null;
    };
    const cleanText = typeof text === 'string' ? text.trim().slice(0, 900) : '';
    if (!cleanText) {
      res.status(400).json({ error: 'Texto de narração vazio.' });
      return;
    }

    const allowedVoices = new Set(['Kore', 'Zephyr', 'Puck', 'Charon', 'Fenrir']);
    const hasCustomProfile = Boolean(voiceProfile?.ttsStylePrompt);
    const chosenVoice =
      voiceProfile?.matchedBaseVoice && allowedVoices.has(voiceProfile.matchedBaseVoice)
        ? voiceProfile.matchedBaseVoice
        : 'Kore';
    const chosenStyle =
      voiceProfile?.ttsStylePrompt ||
      'Clear, warm, professional corporate trainer speaking Brazilian Portuguese';

    try {
      const response = await ai.models.generateContent({
        model: hasCustomProfile ? 'gemini-3.8-flash-tts' : 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style: chosenStyle,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: chosenVoice },
            },
          },
        },
      });

      const part = response.candidates?.[0]?.content?.parts?.[0];
      const audioBase64 = part?.inlineData?.data;
      if (!audioBase64) {
        res.status(502).json({ error: 'Não foi possível gerar o áudio da cena.' });
        return;
      }

      res.json({
        audioBase64,
        mimeType: part?.inlineData?.mimeType || 'audio/wav',
      });
    } catch (err) {
      const parsed = extractApiError(err);
      res.status(parsed.status).json({ error: parsed.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Central de Treinamentos server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
