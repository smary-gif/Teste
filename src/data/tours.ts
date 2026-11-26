import type { CoachStep, PatientCase } from '../types';
import { cmdIs, norm } from '../utils/helpers';
import { TRAIN_DEPTS } from './defaults';

export const TOUR_DONE: Record<string, string> = {
  geral: 'Passo a passo do Chat geral concluído!',
  agendamento: 'Passo a passo de Agendamento concluído!',
  confirmacao: 'Confirmação concluída! O chat foi encaminhado para Em andamento.',
  andamento: 'Passo a passo de Em andamento e Aguardando concluído!',
  reagendamento: 'Passo a passo de Reagendamento concluído!',
  medicos: 'Passo a passo de Suporte aos médicos concluído!',
};

const pickDept = (key: string, text?: string): CoachStep[] => {
  const deptName = TRAIN_DEPTS.find((t) => t.key === key)?.nome || key;
  return [
    {
      sel: '#dd-btn',
      text: text || 'Abra a barra "Selecionar departamento para trabalhar".',
    },
    {
      sel: `[data-coach="dd-${key}"]`,
      text: `Escolha "${deptName}".`,
    },
  ];
};

const sendStep = (text?: string): CoachStep => ({
  sel: '[data-coach="sim-send"]',
  sig: 'sim-send',
  text: text || 'Envie a mensagem (clique no botão Enviar ou pressione Enter).',
});

export function buildTourSteps(
  tourKey: string,
  patients: PatientCase[]
): { steps: CoachStep[]; initialPatientId: string; doneMsg: string } | null {
  const findP = (id: string) => patients.find((p) => p.id === id);

  if (tourKey === 'geral') {
    const p = findP('geral0');
    if (!p) return null;
    return {
      initialPatientId: p.id,
      doneMsg: TOUR_DONE.geral,
      steps: [
        ...pickDept('geral', 'Vamos treinar o Chat geral. Abra a barra "Selecionar departamento para trabalhar".'),
        { sel: '[data-coach="ci-geral0"]', text: `Abra a conversa de ${p.first} e leia a dúvida.` },
        { sel: '[data-coach="neg-btn"]', text: 'Antes de responder, clique no botão "Negociação" para abrir o histórico.' },
        { sel: '[data-coach="neg-tab-entregas"]', text: 'O paciente pergunta sobre o pedido. Abra a aba Entregas.' },
        { sel: '[data-coach="neg-close"]', text: 'Conferiu o status do pedido? Feche a negociação.' },
        {
          sel: '#composer',
          check: (v) => v.trim().length >= 12,
          text: 'Responda com suas palavras informando o status do pedido (dados fictícios).',
        },
        sendStep(),
        {
          sel: '#note-text',
          check: (v) => v.trim().length >= 8,
          text: 'Registre na nota interna o que foi resolvido.',
        },
        { sel: '[data-coach="note-add"]', text: 'Clique em "Adicionar Nota".' },
        { sel: '#atend-btn', text: 'Abra o seletor de status do atendimento.' },
        { sel: '[data-coach="atend-Resolvido"]', text: 'Marque como Resolvido. O chat irá para Finalizados.' },
      ],
    };
  }

  if (tourKey === 'agendamento') {
    const p = findP('agendamento0');
    if (!p) return null;
    return {
      initialPatientId: p.id,
      doneMsg: TOUR_DONE.agendamento,
      steps: [
        ...pickDept('agendamento', 'Vamos treinar o Agendamento. Abra a barra de departamentos.'),
        { sel: '[data-coach="ci-agendamento0"]', text: `Abra a conversa de ${p.first}.` },
        { sel: '[data-coach="neg-btn"]', text: 'Abra a negociação para ver se é primeira consulta ou retorno.' },
        { sel: '[data-coach="neg-tab-consultas"]', text: 'Na aba Consultas aparece quantas vezes o paciente já consultou.' },
        { sel: '[data-coach="neg-close"]', text: 'Feche a negociação.' },
        {
          sel: '#composer',
          check: (v) => v.trim().length >= 12,
          text: 'Ofereça horários disponíveis (ex.: quinta às 15:00 ou 19:40).',
        },
        sendStep(),
        {
          sel: '#composer',
          check: (v) => cmdIs(v, '/importante'),
          text: 'Digite /importante para enviar a tolerância de 5 minutos e a regra das 2 horas.',
        },
        sendStep(),
        {
          sel: '#note-text',
          check: (v) => v.trim().length >= 8,
          text: 'Registre o agendamento na nota interna (ex.: "Agendado para quinta às 15:00").',
        },
        { sel: '[data-coach="note-add"]', text: 'Clique em "Adicionar Nota".' },
        { sel: '#dept-btn', text: 'Agora encaminhe o chat: abra o seletor de Departamento.' },
        { sel: '[data-coach="dept-confirmacao"]', text: 'Escolha "Confirmação em andamento".' },
      ],
    };
  }

  if (tourKey === 'confirmacao') {
    const p = findP('confirmacao6') || findP('confirmacao0');
    if (!p) return null;
    return {
      initialPatientId: p.id,
      doneMsg: TOUR_DONE.confirmacao,
      steps: [
        ...pickDept('confirmacao', 'Vamos treinar Confirmação. Abra a barra "Selecionar departamento para trabalhar".'),
        { sel: '[data-coach="nav-consultas"]', text: 'Agora localize a consulta no sistema. Clique em "Consultas" no menu lateral.' },
        { sel: '[data-coach="todas-consultas"]', text: 'No menu do sistema, clique em "Todas as consultas".' },
        { sel: '[data-coach="tag-x"]', text: 'A lista abre filtrada por "Status: Confirmadas". Clique no X para ver também os pendentes.' },
        { sel: '[data-coach="btn-data"]', text: 'Clique no ícone de calendário para filtrar por data e horário.' },
        { sel: '[data-coach="cal-today"]', text: 'Selecione o dia de hoje no calendário.' },
        { sel: '#f-start', check: (v) => v === '17:00', text: 'Em "Horário inicial", defina 17:00.' },
        { sel: '#f-end', check: (v) => v === '17:01', text: 'Em "Horário final", defina 17:01.' },
        { sel: '[data-coach="aplicar"]', text: 'Clique em "Aplicar filtro".' },
        { sel: '#page-size', check: (v) => v === '50', text: 'Em "Linhas por página", escolha 50.' },
        { sel: '[data-coach="row-menu"]', text: `Esta é a consulta de ${p.nome} às 17:00. Clique nos 3 pontinhos.` },
        { sel: '[data-coach="acessar-chat"]', text: 'Clique em "Acessar chat" para abrir a conversa de confirmação.' },
        {
          sel: '#composer',
          check: (v) => cmdIs(v, '/importante'),
          text: `4.1: ${p.first} já recebeu o template com data e horário. Digite /importante.`,
        },
        sendStep(),
        { sel: '#next-ev', text: '4.2: Às 07:00 sai o lembrete. Clique para disparar o Lembrete 07:00.' },
        {
          sel: '#composer',
          check: (v) => cmdIs(v, '/confirmacao'),
          text: 'Quando o paciente confirmar, digite /confirmacao.',
        },
        sendStep('Envie a confirmação.'),
        { sel: '#next-ev', text: '4.2: 2 horas antes sai o lembrete com orientações de acesso. Dispare o lembrete de 2h.' },
        {
          sel: '#note-text',
          check: (v) => v.trim().length >= 8,
          text: '4.4: Registre cada tentativa/contato nas notas internas.',
        },
        { sel: '[data-coach="note-add"]', text: 'Clique em "Adicionar Nota".' },
        { sel: '#next-ev', text: '4.3: 10 minutos antes sai o link de acesso. Dispare o lembrete final para mover para Em andamento.' },
      ],
    };
  }

  if (tourKey === 'andamento') {
    const a = findP('andamento0');
    const b = findP('andamento1');
    const c = findP('andamento2');
    const d = findP('andamento3');
    if (!a || !b || !c || !d) return null;
    return {
      initialPatientId: a.id,
      doneMsg: TOUR_DONE.andamento,
      steps: [
        ...pickDept('andamento', 'Vamos treinar Suporte aos pacientes (em andamento e aguardando). Abra a barra de departamentos.'),
        { sel: '[data-coach="ci-andamento0"]', text: `Abra o chat de ${a.first}, que recebeu o link 10 minutos antes.` },
        { sel: '#composer', check: (v) => cmdIs(v, '/acesso'), text: 'Pergunte se conseguiu acessar digitando /acesso.' },
        sendStep(),
        { sel: '#composer', check: (v) => cmdIs(v, '/aguarde'), text: 'Conseguiu acessar? Digite /aguarde.' },
        sendStep(),
        { sel: '[data-coach="ci-andamento1"]', text: `Agora abra o chat de ${b.first}, que está com dificuldade na câmera.` },
        { sel: '#composer', check: (v) => cmdIs(v, '/devido'), text: 'Digite /devido para explicar a regra caso não consiga acessar.' },
        sendStep(),
        { sel: '[data-coach="crm-btn"]', text: 'Agora acompanhe no CRM quem entrou. Clique no botão CRM.' },
        { sel: `[data-coach="crm-msg-${a.id}"]`, text: `No card "Em andamento", clique no ícone de mensagem de ${a.first}.` },
        { sel: `[data-coach="crm-pac-${a.id}"]`, text: 'Escolha "Chat do paciente".' },
        {
          sel: '#note-text',
          check: (v) => norm(v).trim() === 'consulta em andamento',
          text: 'Na nota interna, escreva exatamente: Consulta em andamento',
        },
        { sel: '[data-coach="note-add"]', text: 'Clique em "Adicionar Nota".' },
        { sel: '#atend-btn', text: 'Abra o status do atendimento.' },
        { sel: '[data-coach="atend-Aguardando"]', text: 'Mude para Aguardando.' },
        { sel: '[data-coach="crm-btn"]', text: 'Volte ao CRM.' },
        { sel: `[data-coach="crm-msg-${c.id}"]`, text: `No card "Aguardando", clique no ícone de mensagem de ${c.first}.` },
        { sel: `[data-coach="crm-pac-${c.id}"]`, text: 'Escolha "Chat do paciente".' },
        { sel: '#composer', check: (v) => cmdIs(v, '/aguarde2'), text: 'O médico ainda não entrou: digite /aguarde2.' },
        sendStep(),
        { sel: '[data-coach="crm-btn"]', text: 'Volte ao CRM.' },
        { sel: `[data-coach="crm-msg-${d.id}"]`, text: `No card "Faltou", clique no ícone de mensagem de ${d.first}.` },
        { sel: `[data-coach="crm-pac-${d.id}"]`, text: 'Escolha "Chat do paciente".' },
        {
          sel: '#note-type',
          check: (v) => v.startsWith('Falta'),
          text: 'No tipo de nota, escolha "Falta com custo" ou "Falta sem custo".',
        },
        { sel: '[data-coach="note-add"]', text: 'Clique em "Adicionar Nota".' },
        { sel: '#composer', check: (v) => cmdIs(v, '/faltou'), text: 'Digite /faltou.' },
        sendStep(),
        { sel: '[data-coach="neg-btn"]', text: 'Abra a Negociação para consultar o histórico de consultas e entregas.' },
        { sel: '[data-coach="neg-tab-consultas"]', text: 'Veja as consultas na aba Consultas.' },
        { sel: '[data-coach="neg-tab-entregas"]', text: 'Veja os pedidos na aba Entregas.' },
        { sel: '[data-coach="neg-close"]', text: 'Feche a negociação.' },
      ],
    };
  }

  if (tourKey === 'reagendamento') {
    const p = findP('reagendamento0');
    if (!p) return null;
    return {
      initialPatientId: p.id,
      doneMsg: TOUR_DONE.reagendamento,
      steps: [
        ...pickDept('reagendamento', 'Vamos treinar Reagendamento. Abra a barra de departamentos.'),
        { sel: '[data-coach="ci-reagendamento0"]', text: `Abra a conversa de ${p.first}. A consulta ocorre em menos de 2 horas.` },
        { sel: '[data-coach="neg-btn"]', text: 'Abra a negociação para conferir a consulta atual e as anteriores.' },
        { sel: '[data-coach="neg-close"]', text: 'Feche a negociação.' },
        { sel: '#composer', check: (v) => cmdIs(v, '/devido'), text: 'Menos de 2h de antecedência: digite /devido.' },
        sendStep(),
        {
          sel: '#composer',
          check: (v) => v.trim().length >= 12,
          text: 'Ofereça novos horários (fictícios) e confirme o escolhido.',
        },
        sendStep(),
        {
          sel: '#note-text',
          check: (v) => v.trim().length >= 8,
          text: 'Registre o novo horário e o motivo na nota interna.',
        },
        { sel: '[data-coach="note-add"]', text: 'Clique em "Adicionar Nota".' },
        { sel: '#atend-btn', text: 'Abra o status do atendimento.' },
        { sel: '[data-coach="atend-Resolvido"]', text: 'Marque como Resolvido.' },
      ],
    };
  }

  if (tourKey === 'medicos') {
    const p = findP('medicos0');
    if (!p) return null;
    return {
      initialPatientId: p.id,
      doneMsg: TOUR_DONE.medicos,
      steps: [
        ...pickDept('medicos', 'Vamos treinar Suporte aos médicos. Abra a barra de departamentos.'),
        { sel: '[data-coach="ci-medicos0"]', text: `Abra a conversa com ${p.nome}.` },
        { sel: '[data-coach="crm-btn"]', text: 'Consulte o CRM para conferir o status real do paciente.' },
        { sel: '[data-coach="crm-back"]', text: 'Identificou o status? Volte ao chat.' },
        { sel: '[data-coach="ci-medicos0"]', text: 'Abra novamente a conversa com o médico.' },
        {
          sel: '#composer',
          check: (v) => v.trim().length >= 12,
          text: 'Responda ao médico combinando o próximo passo (ex.: "Vou acionar o paciente e te retorno em seguida.").',
        },
        sendStep(),
        {
          sel: '#note-text',
          check: (v) => v.trim().length >= 8,
          text: 'Registre o combinado nas notas internas.',
        },
        { sel: '[data-coach="note-add"]', text: 'Clique em "Adicionar Nota".' },
        { sel: '#atend-btn', text: 'Abra o status do atendimento.' },
        { sel: '[data-coach="atend-Resolvido"]', text: 'Marque como Resolvido.' },
      ],
    };
  }

  return null;
}
