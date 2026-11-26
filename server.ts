import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
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
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/ai/status', (_req: Request, res: Response) => {
    const ai = getAiClient();
    res.json({ configured: Boolean(ai) });
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
