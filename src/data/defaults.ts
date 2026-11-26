import type {
  ConsultationRow,
  PatientCase,
  PatientScenario,
  PortalConfig,
  TeamMember,
  TraineeDayDef,
  TraineeQuestionRaw,
  TrilhaStage,
} from '../types';
import {
  deptKey,
  fillTemplate,
  getTodayMeta,
  norm,
  nowTime,
  pad,
} from '../utils/helpers';

export const TRAIN_DEPTS = [
  { key: 'solicitacoes', nome: 'Solicitações' },
  { key: 'geral', nome: 'Chat geral' },
  { key: 'agendamento', nome: 'Agendamento' },
  { key: 'confirmacao', nome: 'Consulta Médica - Confirmação' },
  { key: 'andamento', nome: 'Consulta Médica - Em andamento' },
  { key: 'reagendamento', nome: 'Reagendamento' },
  { key: 'medicos', nome: 'Suporte aos médicos' },
] as const;

export const MEDS = [
  'Dra. Helena Vasconcelos',
  'Dr. Marcos Albuquerque',
  'Dra. Paula Rezende',
  'Dr. Otávio Linhares',
  'Dra. Simone Faria',
  'Dr. Renato Saldanha',
];

const FIRST_NAMES = [
  'Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabriela', 'Heitor', 'Isabela', 'João',
  'Karen', 'Lucas', 'Marina', 'Nicolas', 'Olívia', 'Paulo', 'Renata', 'Rafael', 'Sofia', 'Tiago',
  'Vitória', 'Vitor', 'Wesley', 'Yasmin', 'Zélia', 'Alice', 'Bernardo', 'Cecília', 'Davi', 'Estela',
  'Murilo', 'Lívia', 'Otávio', 'Priscila', 'Samuel', 'Tânia', 'Caio', 'Luana', 'Mateus', 'Joana',
  'Pedro', 'Helena',
];

const LAST_NAMES = [
  'Moreira', 'Teixeira', 'Lacerda', 'Fontes', 'Prado', 'Rangel', 'Siqueira',
  'Bastos', 'Viana', 'Couto', 'Paixão', 'Aragão', 'Seixas', 'Quintela',
];

const TIPOS_CONSULTA = ['Primeira consulta', 'Recorrência', 'Gratuita'];

export const SOL_TIPOS = [
  'Dúvida',
  'Traduzir receita',
  'Posologia e orientações',
  'Renovação de receita',
  'Alterar receita',
  'Laudo ou documento',
];

export const DEFAULT_CONFIG: PortalConfig = {
  portalNome: 'Central de Treinamentos',
  portalSub: 'Programa Trainee · Básico ao Avançado',
  madrinha: {
    nome: 'Andréia',
    cargo: 'Instrutora de treinamento dos subsetores',
    aviso:
      'A Andréia acompanha o treinamento intensivo de cada trainee: 3 dias de formação hard do básico ao avançado, mais prática guiada em cada departamento.',
  },
  promocao:
    'A promoção de cargo é individual. A liderança acompanha o desempenho nas simulações, entregas de turno e notas do programa Trainee para cada próximo passo.',
  filtroDepartamentos: [
    'Todos',
    'Solicitações',
    'Chat geral',
    'Agendamento',
    'Consulta Médica - Confirmação',
    'Consulta Médica - Em andamento',
    'Reagendamento',
    'Suporte aos médicos',
  ],
  encaminharDepartamentos: [
    'Solicitações',
    'Consulta médica',
    'Agendamento',
    'Confirmação em andamento',
    'Reagendamento',
    'Acompanhamento aos médicos',
    'Agendamento pós-venda',
    'Pós-venda',
    'Recorrência',
    'Receita e orçamento',
  ],
  guia: [
    {
      titulo: 'Lembrete da consulta',
      quando: '4.1 · Dia anterior',
      texto: 'Link de confirmação enviado um dia antes, para reforçar o compromisso com o horário.',
      detalhe:
        'O paciente recebe o link de confirmação um dia antes da data da consulta, com o objetivo de reforçar o compromisso com o horário previamente agendado.\n\nEssa confirmação é especialmente importante quando a consulta é marcada com vários dias de antecedência: ajuda na organização da agenda e reduz as faltas.',
    },
    {
      titulo: 'Lembrete no dia da consulta',
      quando: '4.2 · 07:00 e 2h antes',
      texto: 'Dois lembretes antes do lembrete final: às 07:00 e 2 horas antes do horário.',
      detalhe:
        'No dia da consulta, são enviados dois lembretes antes do lembrete final.\n\nPrimeiro lembrete (07:00): traz duas opções de resposta, para o paciente informar se "Está tudo certo para hoje!" ou se "Gostaria de tirar dúvidas".\n\nSegundo lembrete (2 horas antes): avisa que o link de acesso chega antes do início do atendimento, com as orientações:\n1. Clique para acessar a sala.\n2. Autorize o uso da câmera e do microfone.\n3. Aguarde o médico na sala.\n\nEssas instruções tranquilizam o paciente e o preparam para a consulta.',
    },
    {
      titulo: 'Lembrete final com link de acesso',
      quando: '4.3 · Antes do horário',
      texto: 'Link de acesso com o horário e a recomendação de um ambiente tranquilo.',
      detalhe:
        'Antes do horário agendado, enviamos ao paciente o link de acesso à consulta, informando o horário e reforçando a importância de estar em um ambiente tranquilo e confortável.\n\nAssim o paciente consegue esclarecer suas dúvidas com atenção e qualidade durante o atendimento médico.',
    },
    {
      titulo: 'Confirmação da agenda',
      quando: '4.4 · Todo o expediente',
      texto: 'Confirmação ativa: ligação, pedido de contato e registro de todas as tentativas.',
      detalhe:
        'Durante todo o expediente, fazemos a confirmação ativa das consultas, verificando se o paciente confirmou algum dos lembretes enviados.\n\nSe o paciente não entrou em contato no dia da consulta, ligamos para confirmar se está tudo certo para o atendimento no horário agendado. Se ele não atender, enviamos uma solicitação de contato e registramos todas as tentativas em anotação.\n\nEsses registros são fundamentais para a organização interna: permitem que o próximo atendente conheça todo o histórico de contato e o andamento do atendimento do paciente no chat.',
    },
  ],
  atalhos: [
    {
      cmd: '/importante',
      texto:
        '⏰ Importante:\nTemos uma tolerância de até 5 minutos de atraso na consulta!\nCaso precise reagendar com menos de 2 horas de antecedência ou falte à consulta, será necessário realizar um novo pagamento. 😉',
    },
    {
      cmd: '/confirmacao',
      texto:
        'CONSULTA CONFIRMADA!\nDaqui a pouco estaremos te esperando.\nFique atento ao WhatsApp: 10 minutos antes da consulta, enviaremos seu link de acesso. 💚',
    },
    {
      cmd: '/acesso',
      texto:
        "Conseguiu acessar a consulta? Lembrando que é necessário permitir o acesso à câmera e ao microfone e, em seguida, clicar em 'Entrar na consulta'. Caso esteja com qualquer dificuldade, é só nos informar que iremos ajudá-lo(a).",
    },
    {
      cmd: '/aguarde',
      texto:
        'Perfeito! O médico encontra-se finalizando a consulta anterior e, em breve, irá acessar. Peço, por gentileza, que aguarde na sala. 😊',
    },
    {
      cmd: '/devido',
      texto:
        'Devido à disponibilidade do médico, para reagendamentos sem aviso prévio (2h) ou em caso de falta à consulta, é cobrado o valor de uma nova consulta. Gostaria de seguir com o reagendamento ou podemos manter o seu horário original?',
    },
    {
      cmd: '/aguarde2',
      texto: 'Por favor, aguarde só mais um instante, que o Dr(a). já vai acessar sua consulta! 😊',
    },
    {
      cmd: '/faltou',
      texto:
        '{$first_name}, vimos que não conseguiu comparecer à sua consulta. Caso queira realizar um novo agendamento, estamos à disposição! 📅😊',
    },
  ],
  templates: {
    agendamento:
      'Template meta enviado.\n\nSua consulta está agendada!\nDados do agendamento:\n\n📅 Data: {data}\n🕐 Horário: {hora}\n\nPodemos seguir com o processo? Fico no seu aguardo.',
    lembrete7h:
      'Template meta enviado.\n\nBom dia, {$first_name}! 😊\nHoje você tem sua consulta aqui na Click! 💚\n\nGostaria de confirmar se está tudo certo ou se resta alguma dúvida que eu ainda posso te ajudar? | [ Tudo certo para hoje! ] | [ Gostaria de tirar dúvidas ]',
    lembrete2h:
      'Template meta enviado.\n\nPodemos confirmar sua consulta?\n\nO link de acesso será enviado por aqui dez minutos antes do horário agendado. Assim que receber, basta clicar no link, entrar na sala e aguardar o médico.\n\nEstá tudo certo para sua consulta? 👇 | [ Confirmar presença! ] | [ Falar com o suporte. ]',
    acesso:
      'Template meta enviado.\n\nA consulta médica está prestes a começar.\n\n🕐 Horário: {hora}\n\nLink de acesso 👇\n\n{link}\n\nCertifique-se de estar em um lugar tranquilo e confortável.',
  },
  niveis: [
    { nome: 'Trainee · Dia 1 (Básico)', desc: 'Chat geral, Agendamento e Reagendamento sob supervisão.' },
    { nome: 'Trainee · Dia 2 (Intermediário)', desc: 'Confirmação ativa, Suporte ao paciente e Suporte médico.' },
    { nome: 'Trainee · Dia 3 (Avançado)', desc: 'Solicitações, passagem de turno e auditoria de qualidade.' },
    { nome: 'Analista Júnior Certificada', desc: 'Aprovada na Prova Final (90%+) com autonomia operacional.' },
    { nome: 'Analista Sênior / Madrinha', desc: 'Referência em crises e formação de novas turmas.' },
  ],
  aprimorarPadrao: [
    'Registrar todas as tentativas de contato nas notas internas com data, hora e canal',
    'Usar o atalho exato em cada etapa (/importante, /confirmacao, /acesso, /aguarde, /aguarde2, /devido, /faltou)',
    'Nunca orientar posologia ou alteração de dose: abrir Solicitação ao médico responsável',
  ],
  subsetores: [
    {
      tour: 'geral',
      nome: 'Chat geral',
      desc: 'Primeiro atendimento das dúvidas gerais dos pacientes.',
      passos:
        'Abra a barra "Selecionar departamento para trabalhar" e escolha Chat geral.\nAbra a conversa e leia a dúvida com atenção.\nClique no ícone de pasta ao lado do nome (Abrir negociação) para ver as consultas e as entregas do paciente.\nResponda com clareza e cordialidade. Se a dúvida for de outro setor, use o botão Departamento para encaminhar.\nRegistre uma nota interna com o que foi resolvido.\nAltere o status do atendimento para Resolvido.',
    },
    {
      tour: 'agendamento',
      nome: 'Agendamento',
      desc: 'Marcar a consulta com as informações corretas.',
      passos:
        'Escolha Agendamento na barra de departamentos e abra a conversa.\nAbra a negociação para ver se é a primeira consulta ou um retorno.\nOfereça os horários disponíveis e confirme o escolhido pelo paciente.\nEnvie /importante com a tolerância de 5 minutos e a regra de reagendamento.\nRegistre o agendamento nas notas internas.\nEncaminhe o chat para Confirmação em andamento pelo botão Departamento.',
    },
    {
      tour: 'confirmacao',
      nome: 'Confirmação',
      desc: 'Garantir que o paciente confirme e compareça à consulta.',
      passos:
        'Escolha Consulta Médica - Confirmação na barra de departamentos.\nNo sistema, abra Consultas > Todas as consultas, remova o filtro "Status: Confirmadas", filtre o dia e o horário e mostre 50 linhas.\nNos 3 pontinhos da consulta, clique em Acessar chat.\nO paciente já recebeu o template com data e horário. Envie /importante.\nÀs 07:00 sai o lembrete com "Tudo certo para hoje!" ou "Gostaria de tirar dúvidas".\nQuando o paciente confirmar, envie /confirmacao.\n2 horas antes sai o lembrete com as orientações de acesso.\nSem contato do paciente: ligue, envie pedido de contato e registre todas as tentativas nas notas.\n10 minutos antes sai o link de acesso e o chat passa sozinho para Em andamento.',
    },
    {
      tour: 'andamento',
      nome: 'Suporte aos pacientes (em andamento e aguardando)',
      desc: 'Ajudar o paciente a entrar na consulta e acompanhar pelo CRM.',
      passos:
        'O paciente recebe o template com o horário e o link 10 minutos antes da consulta.\nEnvie /acesso perguntando se ele conseguiu acessar.\nSe conseguiu, envie /aguarde.\nSe não conseguiu, envie /devido e siga a conversa conforme a resposta (sim ou não).\nAbra o CRM pelo ícone à direita do chat.\nEm andamento: no ícone de mensagem do card, escolha Chat do paciente, escreva a nota interna "Consulta em andamento" e mude o status do atendimento para Aguardando.\nAguardando (o médico ainda não entrou): no Chat do paciente, envie /aguarde2.\nFaltou: adicione a nota de falta (com custo ou sem custo) e envie /faltou.\nUse Abrir negociação (ícone ao lado do nome) para ver as consultas e as entregas do paciente.',
    },
    {
      tour: 'reagendamento',
      nome: 'Reagendamento',
      desc: 'Remarcar respeitando a regra das 2 horas.',
      passos:
        'Escolha Reagendamento e abra a conversa.\nAbra a negociação para ver a consulta atual e as anteriores.\nCom menos de 2h de antecedência ou em caso de falta, envie /devido.\nOfereça novos horários e confirme o escolhido.\nRegistre o novo horário e o motivo nas notas internas.\nAltere o status do atendimento para Resolvido.',
    },
    {
      tour: 'medicos',
      nome: 'Suporte aos médicos',
      desc: 'Atender os médicos durante a agenda do dia.',
      passos:
        'Escolha Suporte aos médicos e abra a conversa com o médico.\nConsulte o CRM para ver o status da consulta do paciente.\nVolte ao chat e responda ao médico, combinando o próximo passo.\nSe precisar, fale com o paciente pelo chat dele.\nRegistre tudo nas notas internas.\nAltere o status do atendimento para Resolvido.',
    },
  ],
  pacientesSimulados: 15,
  treinoInicio: '2026-11-16',
  treinoOrdem: [
    'Rayssa', 'Aninha', 'Ana Gabriela', 'Greicy', 'Caroline Caca', 'Isabel', 'Jamily',
    'Julyana', 'Karolyne Nani', 'Maria Julia', 'Naiara', 'Simone', 'Tuany', 'Yasmin',
  ],
};

export const SCENARIOS: Record<string, PatientScenario[]> = {
  solicitacoes: [
    {
      tipo: 'Traduzir receita',
      desc: 'Recebeu uma receita escrita à mão que não consegue ler e pede que o médico traduza para texto.',
      first: 'Oi! Recebi minha receita mas não consigo entender a letra do médico. Alguém consegue traduzir?',
      replies: ['Pode ser por aqui mesmo, em texto?', 'Entendi, muito obrigada!'],
    },
    {
      tipo: 'Posologia e orientações',
      desc: 'Não sabe a dose nem os horários do produto prescrito e quer a orientação do médico.',
      first: 'Boa tarde! Não entendi como devo tomar o produto da minha receita. Quantas gotas e em que horário?',
      replies: ['Posso tomar junto com as outras medicações?', 'Certo, vou seguir assim. Obrigado!'],
    },
    {
      tipo: 'Dúvida',
      desc: 'Está usando o produto há uma semana, sentiu sono e quer que o médico responda se é normal.',
      first: 'Oi, estou usando o produto há uma semana e senti um pouco de sono. Isso é normal?',
      replies: ['Devo mudar o horário?', 'Tá bom, vou observar. Obrigada!'],
    },
    {
      tipo: 'Renovação de receita',
      desc: 'A receita está perto de vencer e quer saber se precisa de nova consulta para renovar.',
      first: 'Minha receita vence semana que vem. Preciso fazer outra consulta para renovar?',
      replies: ['E quanto tempo o médico leva para avaliar?', 'Ok, aguardo o retorno.'],
    },
    {
      tipo: 'Laudo ou documento',
      desc: 'Precisa de um laudo para apresentar no trabalho e quer pedir ao médico.',
      first: 'Preciso de um laudo para levar ao meu trabalho. Como peço ao médico?',
      replies: ['É para o RH, só preciso do documento assinado.', 'Perfeito, fico no aguardo.'],
    },
    {
      tipo: 'Dúvida',
      desc: 'Perguntou algo ao médico há dois dias, não teve resposta e cobra o retorno com certa ansiedade.',
      first: 'Fiz uma pergunta ao médico ontem e ainda não tive resposta. Vocês conseguem verificar?',
      replies: ['Mas já faz mais de um dia...', 'Tudo bem, vou aguardar até amanhã.'],
    },
  ],
  geral: [
    {
      desc: 'Comprou um produto há 5 dias e quer saber quando chega o pedido. Fica tranquilo quando recebe o prazo.',
      first: 'Oi! Quanto tempo demora para chegar o meu pedido?',
      replies: ['Ah, entendi. Tem algum código de rastreio?', 'Perfeito, obrigado pela ajuda!'],
      entrega: true,
    },
    {
      desc: 'Nunca fez consulta online e quer saber como funciona e se precisa de algum documento.',
      first: 'Olá! Como funciona a consulta online? Preciso levar algum documento?',
      replies: ['E a consulta é por vídeo mesmo?', 'Entendi, obrigada!'],
    },
    {
      desc: 'Perdeu a receita da última consulta e pede que reenviem.',
      first: 'Boa tarde, perdi a minha receita. Vocês conseguem me mandar de novo?',
      replies: ['Pode mandar por aqui mesmo?', 'Recebi, muito obrigado!'],
    },
    {
      desc: 'Quer saber o valor da consulta e as formas de pagamento.',
      first: 'Oi, qual o valor da consulta? Dá para parcelar?',
      replies: ['E no Pix tem desconto?', 'Show, vou pensar e te aviso.'],
    },
    {
      desc: 'Quer trocar o e-mail do cadastro porque não recebe as mensagens.',
      first: 'Consigo trocar o e-mail do meu cadastro? Não estou recebendo nada.',
      replies: ['O novo é o que te mandei agora há pouco, pode ser?', 'Obrigada!'],
    },
    {
      desc: 'Pergunta se o médico pode emitir laudo para apresentar no trabalho.',
      first: 'O médico consegue me dar um laudo para o trabalho?',
      replies: ['Precisa ser pedido na hora da consulta?', 'Entendi, valeu!'],
    },
  ],
  agendamento: [
    {
      desc: 'Quer agendar a primeira consulta ainda nesta semana, de preferência à tarde.',
      first: 'Oi, quero agendar minha primeira consulta. Tem horário essa semana?',
      replies: ['Quinta à tarde seria ótimo. Pode ser às 15h?', 'Perfeito, pode marcar!', 'Entendido, obrigado!'],
    },
    {
      desc: 'É paciente de retorno e quer marcar com a mesma médica da última vez.',
      first: 'Preciso marcar meu retorno com a mesma médica da última vez.',
      replies: ['Pode ser na semana que vem, qualquer dia de manhã.', 'Fechado, obrigada!'],
    },
    {
      desc: 'Só consegue depois das 19h por causa do trabalho.',
      first: 'Tem horário à noite? Só consigo depois das 19h.',
      replies: ['19:40 está ótimo para mim.', 'Combinado!'],
    },
    {
      desc: 'Quer agendar para a mãe usando o próprio número de contato.',
      first: 'Quero agendar para minha mãe, pode ser pelo meu número?',
      replies: ['O nome dela é Marta (fictício). Pode ser sexta?', 'Obrigada pela ajuda!'],
    },
  ],
  confirmacao: [
    { id: 'tranquilo', desc: 'Paciente tranquilo e pontual. Confirma presença e consegue acessar a sala sem problemas.' },
    {
      id: 'duvidas',
      desc: 'No lembrete das 07:00 escolhe "Gostaria de tirar dúvidas": pergunta se precisa de câmera ligada, quanto tempo dura e como recebe a receita. Depois de esclarecido, confirma.',
    },
    {
      id: 'remarcar',
      desc: 'Teve um imprevisto no trabalho e quer remarcar. Fica em dúvida quando ouve que reagendar com menos de 2h gera cobrança de nova consulta.',
    },
    {
      id: 'sem_resposta',
      desc: 'Demora a responder. Ignora as primeiras mensagens e só responde depois de algumas tentativas, dizendo que estava ocupado.',
      silent: 3,
    },
    {
      id: 'nao_acessa',
      desc: 'Confirma, mas na hora não consegue acessar: o navegador não libera câmera e microfone.',
    },
    {
      id: 'atrasado_medico',
      desc: 'Confirma e acessa a sala, mas o médico demora. Reclama educadamente que o médico ainda não entrou.',
    },
  ],
  andamento: [
    {
      id: 'acessou',
      crm: 'Em andamento',
      desc: 'Recebeu o link 10 minutos antes e consegue acessar a sala sem problemas. Responde que conseguiu.',
      replies: ['Consegui sim, já estou na sala!', 'Ok, vou aguardar. Obrigado!'],
    },
    {
      id: 'nao_acessa',
      crm: 'Aguardando',
      desc: 'Não consegue acessar: o navegador bloqueia câmera e microfone. Quando ouve sobre a cobrança de nova consulta, decide se quer manter o horário ou reagendar.',
      replies: ['Prefiro manter o horário, vou tentar de novo pelo celular.', 'Agora consegui entrar, obrigado!'],
    },
    {
      id: 'atrasado_medico',
      crm: 'Aguardando',
      desc: 'Está na sala há alguns minutos e o médico ainda não entrou. Pergunta educadamente se vai demorar.',
      replies: ['Tudo bem, vou aguardar então.', 'Obrigada!'],
    },
    {
      id: 'faltou',
      crm: 'Faltou',
      desc: 'Não entrou na consulta por um imprevisto. Só responde depois, pedindo desculpas e perguntando como remarcar.',
      silent: 1,
      replies: ['Desculpa, tive um imprevisto no trabalho. Como faço para remarcar?', 'Entendi, obrigado.'],
    },
    {
      id: 'quer_remarcar',
      crm: 'Aguardando',
      desc: 'Diz que não vai conseguir acessar agora e pergunta se dá para remarcar sem custo.',
      replies: ['Mas não dá para remarcar sem pagar de novo?', 'Tá bom, então vou manter o horário.'],
    },
  ],
  reagendamento: [
    {
      desc: 'A consulta é hoje, daqui a cerca de 1 hora, e surgiu um imprevisto. Quer remarcar e se incomoda com a cobrança.',
      first: 'Oi, não vou conseguir ir na consulta de hoje, dá para remarcar?',
      replies: [
        'Mas é só uma hora antes... não tem como abrir uma exceção?',
        'Ok, então quero remarcar para sexta à tarde.',
        'Combinado, obrigado.',
      ],
    },
    {
      desc: 'Quer trocar a consulta de quinta para a semana seguinte, com bastante antecedência.',
      first: 'Preciso trocar minha consulta de quinta para a semana que vem.',
      replies: ['Pode ser terça às 10h?', 'Perfeito, obrigada!'],
    },
    {
      desc: 'Faltou à consulta de ontem e pergunta se consegue remarcar sem pagar.',
      first: 'Perdi minha consulta ontem, consigo remarcar sem pagar?',
      replies: ['Entendi. Então pode marcar para segunda?', 'Ok.'],
    },
    {
      desc: 'Quer antecipar a consulta para amanhã cedo.',
      first: 'Tem como adiantar minha consulta para amanhã de manhã?',
      replies: ['Às 9h seria perfeito.', 'Obrigado!'],
    },
  ],
  medicos: [
    {
      desc: 'É médico(a). O paciente das 15:00 ainda não entrou na sala e pede que a equipe verifique.',
      first: 'Boa tarde! O paciente das 15:00 ainda não entrou na sala, vocês podem verificar?',
      replies: ['Ok, vou aguardar mais 5 minutos.', 'Obrigado pelo retorno!'],
    },
    {
      desc: 'É médica. Precisa bloquear a agenda de sexta à tarde por um compromisso.',
      first: 'Preciso bloquear minha agenda de sexta à tarde, consegue fazer para mim?',
      replies: ['Das 13h às 18h, por favor.', 'Perfeito, obrigada!'],
    },
    {
      desc: 'É médico. O link da sala não abre no computador dele.',
      first: 'O link da sala não está abrindo para mim, aparece erro.',
      replies: ['Já tentei atualizar a página. Pelo celular funcionou.', 'Valeu!'],
    },
    {
      desc: 'É médica. Pede para reenviar ao paciente a receita que acabou de emitir.',
      first: 'Pode reenviar para o paciente a receita que acabei de emitir?',
      replies: ['É do paciente das 14:20.', 'Obrigada!'],
    },
    {
      desc: 'É médico. Vai atrasar 10 minutos para a próxima consulta e pede que avisem o paciente.',
      first: 'Vou atrasar uns 10 minutos para a próxima consulta. Podem avisar o paciente?',
      replies: ['É o das 16:40.', 'Obrigado!'],
    },
  ],
};

export const SCRIPT_CONF: Record<string, Record<string, string[]>> = {
  tranquilo: {
    agendado: ['Obrigado! Estarei lá.'],
    confirmacao: ['Tudo certo para hoje!'],
    pre: ['Confirmar presença!'],
    acesso: ['Consegui sim, já estou na sala.'],
    livre: ['Certo, obrigado!'],
  },
  duvidas: {
    agendado: ['Oi! Recebi, obrigada.'],
    confirmacao: ['Gostaria de tirar dúvidas', 'Preciso deixar a câmera ligada o tempo todo? E a receita chega por onde?'],
    pre: ['Entendi, obrigada pelas explicações!'],
    acesso: ['Entrei! Está carregando a sala.'],
    livre: ['Ah, entendi. Então está confirmado!'],
  },
  remarcar: {
    agendado: ['Ok, obrigado.'],
    confirmacao: ['Oi, tive um imprevisto no trabalho. Consigo remarcar para outro dia?'],
    pre: ['Mas não dá para remarcar sem custo mesmo?'],
    acesso: ['Acho que não vou conseguir hoje...'],
    livre: ['Entendi. Vou manter o horário então.'],
  },
  sem_resposta: {
    agendado: [],
    confirmacao: [],
    pre: [],
    acesso: [],
    livre: ['Desculpa a demora, estava em reunião! Está confirmado sim.'],
  },
  nao_acessa: {
    agendado: ['Recebido!'],
    confirmacao: ['Tudo certo para hoje!'],
    pre: ['Ok!'],
    acesso: ['Não estou conseguindo, aparece que a câmera está bloqueada.'],
    livre: ['Já tentei atualizar a página e continua igual.'],
  },
  atrasado_medico: {
    agendado: ['Obrigada!'],
    confirmacao: ['Tudo certo para hoje!'],
    pre: ['Perfeito.'],
    acesso: ['Entrei, mas o médico ainda não apareceu.'],
    livre: ['Ok, vou aguardar então.'],
  },
};

export const PHASE_TXT: Record<string, string> = {
  agendado: 'Você recebeu a mensagem de agendamento da consulta (ainda é a véspera).',
  confirmacao: 'É o dia da consulta. Você recebeu o lembrete das 07:00 com as opções "Tudo certo para hoje!" ou "Gostaria de tirar dúvidas".',
  pre: 'Faltam cerca de 2 horas para a consulta e você recebeu as orientações de acesso.',
  acesso: 'Faltam 10 minutos ou menos; você recebeu o link de acesso à sala da consulta.',
};

export function makePerson(k: number) {
  const first = FIRST_NAMES[k % FIRST_NAMES.length];
  const last = LAST_NAMES[(k * 5 + Math.floor(k / FIRST_NAMES.length) * 3 + 2) % LAST_NAMES.length];
  const num = 101 + k;
  return {
    first,
    nome: `${first} ${last}`,
    proc: `#${String(num).padStart(5, '0')}`,
    tel: `(00) 90000-${String(num).padStart(4, '0')}`,
    medico: MEDS[k % MEDS.length],
    link: `https://sala.exemplo-ficticio.com/${(284000 + k).toString(36)}-${((k * 7919) % 4096).toString(36)}`,
    email: `${norm(first)}.${norm(last)}@exemplo-ficticio.com`,
  };
}

function makeHistory(k: number, forceEntrega?: boolean) {
  const consultas = [];
  const n = k % 3;
  for (let j = 0; j < n; j++) {
    consultas.push({
      num: `#${284100 + k * 3 + j}`,
      data: `${pad(3 + j * 9)}/${pad(((k + j) % 9) + 1)}/2026`,
      tipo: ['Consulta Médica', 'Gratuita', 'Recorrência'][(k + j) % 3],
      medico: MEDS[(k + j + 1) % MEDS.length],
      obs: 'Retorno sugerido em 30 dias. Orientações enviadas por mensagem (dado fictício).',
    });
  }
  const entregas = [];
  if (forceEntrega || k % 4 !== 0) {
    entregas.push({
      pedido: `#PED-${2040 + k}`,
      data: `${pad((k % 27) + 1)}/10/2026`,
      itens: 'Produto prescrito (item fictício)',
      status: ['Em transporte', 'Entregue', 'Separando pedido'][k % 3],
    });
  }
  if (k % 5 === 1) {
    entregas.push({
      pedido: `#PED-${1900 + k}`,
      data: '12/08/2026',
      itens: 'Produto prescrito (item fictício)',
      status: 'Entregue',
    });
  }
  return { consultas, entregas };
}

export function generatePatients(cfg: PortalConfig): PatientCase[] {
  const n = Math.max(8, Math.min(30, Number(cfg.pacientesSimulados) || 15));
  const { todayBr, todaySl, yestSl } = getTodayMeta();
  const list: PatientCase[] = [];
  let seq = 1;
  const nextId = () => `m_${seq++}`;

  const findShortcutText = (cmd: string, p: PatientCase) => {
    const item = cfg.atalhos.find((a) => a.cmd.toLowerCase() === cmd.toLowerCase());
    return fillTemplate(item ? item.texto : cmd, p);
  };

  TRAIN_DEPTS.forEach((d, di) => {
    for (let i = 0; i < n; i++) {
      const k = di * 40 + i;
      const b = makePerson(k);
      const pool = SCENARIOS[d.key];
      const sc = pool[i % pool.length];
      const mins = d.key === 'andamento' ? 14 * 60 + i * 20 : 8 * 60 + 10 + i * 25;
      let hora = `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;
      if (d.key === 'confirmacao' && i === 6) hora = '17:00';

      const p: PatientCase = {
        ...b,
        id: `${d.key}${i}`,
        key: d.key,
        dept: d.nome,
        k,
        hora,
        data: todayBr,
        tipo: TIPOS_CONSULTA[k % 3],
        status: 'Pendente',
        crm: null,
        atend: 'Em Atendimento',
        fase: 'agendado',
        ev: 0,
        sc,
        msgs: [],
        notas: [],
        opCount: 0,
        typing: false,
        unread: false,
        hist: makeHistory(k, sc.entrega),
        medMsgs: [],
      };

      if (d.key === 'medicos') {
        p.isMed = true;
        p.nome = `${k % 2 ? 'Dra. ' : 'Dr. '}${b.nome}`;
        p.tipo = 'Médico(a)';
      }

      if (p.key === 'confirmacao') {
        p.msgs.push({
          id: nextId(),
          from: 'sys',
          text: fillTemplate(cfg.templates.agendamento, p),
          d: yestSl,
          t: '15:12',
        });
        p.status = 'Pendente';
      }

      if (p.key === 'andamento') {
        const [hh, mm] = p.hora.split(':').map(Number);
        const mins10 = (hh * 60 + mm - 10 + 1440) % 1440;
        const t10 = `${pad(Math.floor(mins10 / 60))}:${pad(mins10 % 60)}`;

        p.msgs.push({
          id: nextId(),
          from: 'sys',
          text: fillTemplate(cfg.templates.agendamento, p),
          d: yestSl,
          t: '15:12',
        });
        p.msgs.push({ id: nextId(), from: 'pac', text: 'Tudo certo para hoje!', t: '07:05' });
        p.msgs.push({
          id: nextId(),
          from: 'op',
          text: findShortcutText('/confirmacao', p),
          label: 'Atalho /confirmacao',
          t: '07:06',
        });
        p.msgs.push({
          id: nextId(),
          from: 'api',
          text: 'Diálogo API | Lembrete 10m - Paciente iniciado por: Sistema',
          d: todaySl,
          t: t10,
        });
        p.msgs.push({
          id: nextId(),
          from: 'sys',
          text: fillTemplate(cfg.templates.acesso, p),
          d: todaySl,
          t: t10,
        });

        p.fase = 'acesso';
        p.ev = 3;
        p.crm = sc.crm || 'Em andamento';
        p.status = sc.crm || 'Em andamento';

        if (sc.id === 'nao_acessa') {
          p.msgs.push({ id: nextId(), from: 'op', text: findShortcutText('/acesso', p), label: 'Atalho /acesso', t: t10 });
          p.opCount++;
          p.msgs.push({
            id: nextId(),
            from: 'pac',
            text: 'Não estou conseguindo acessar, aparece que a câmera está bloqueada 😕',
            t: t10,
          });
        } else if (sc.id === 'atrasado_medico') {
          p.msgs.push({ id: nextId(), from: 'op', text: findShortcutText('/acesso', p), label: 'Atalho /acesso', t: t10 });
          p.opCount++;
          p.msgs.push({ id: nextId(), from: 'pac', text: 'Consegui entrar!', t: t10 });
          p.msgs.push({ id: nextId(), from: 'op', text: findShortcutText('/aguarde', p), label: 'Atalho /aguarde', t: t10 });
          p.opCount++;
          p.msgs.push({
            id: nextId(),
            from: 'pac',
            text: 'Já faz uns minutos e o médico ainda não entrou...',
            t: p.hora,
          });
        } else if (sc.id === 'faltou') {
          p.msgs.push({ id: nextId(), from: 'op', text: findShortcutText('/acesso', p), label: 'Atalho /acesso', t: t10 });
          p.opCount++;
          p.atend = 'Aberto';
        } else if (sc.id === 'quer_remarcar') {
          p.msgs.push({
            id: nextId(),
            from: 'pac',
            text: 'Oi, não vou conseguir acessar agora, dá para remarcar?',
            t: t10,
          });
        }

        const medByCrm: Record<string, string[]> = {
          'Em andamento': ['Paciente em atendimento. Finalizo em cerca de 20 minutos.'],
          Aguardando: ['Estou finalizando a consulta anterior, entro em 5 minutos.'],
          Faltou: ['O paciente não entrou na sala. Aguardei 10 minutos.'],
        };
        p.medMsgs = medByCrm[p.crm] || [];
      }

      if (p.key === 'reagendamento') {
        p.msgs.push({
          id: nextId(),
          from: 'sys',
          text: fillTemplate(cfg.templates.agendamento, p),
          d: yestSl,
          t: '10:30',
        });
      }

      if (sc.first) {
        p.msgs.push({ id: nextId(), from: 'pac', text: sc.first, t: nowTime() });
      }

      if (d.key === 'solicitacoes') {
        p.tipo = sc.tipo || 'Dúvida';
        const stMap: Record<number, 'medico' | 'concluido' | 'intervencao' | 'pendente' | 'atraso'> = {
          1: 'medico',
          2: 'concluido',
          3: 'medico',
          4: 'intervencao',
          6: 'pendente',
          7: 'atraso',
        };
        const st = stMap[i];
        if (st) {
          p.sol = {
            tipo: p.tipo,
            medico: p.medico,
            st,
            urg: i === 1 || i === 7,
            receita: '',
            obs: '<div>Paciente aguarda retorno do médico.</div>',
            anexos: [],
            h: ['Solicitação criada'],
          };
          p.msgs.push({
            id: nextId(),
            from: 'evt',
            text: `Solicitação criada: ${p.tipo}`,
            t: nowTime(),
          });
        }
      }

      list.push(p);
    }
  });

  return list;
}

export function generateConsultations(patients: PatientCase[]): ConsultationRow[] {
  const { today, todayKey, todaySl } = getTodayMeta();
  const rows: ConsultationRow[] = [];

  patients
    .filter((p) => p.id.startsWith('confirmacao') || (p.key === 'andamento' && p.id.startsWith('confirmacao')))
    .forEach((p) => {
      rows.push({
        id: `r${p.id}`,
        pid: p.id,
        nome: p.nome,
        proc: p.proc,
        medico: p.medico,
        dateKey: todayKey,
        dataBr: todaySl,
        hora: p.hora,
        tipo: p.tipo.replace(' consulta', ''),
        status: p.id === 'confirmacao6' || p.k % 3 === 0 ? 'Pendente' : 'Confirmada',
        anamnese: p.k % 4 !== 1,
      });
    });

  for (let j = 0; j < 46; j++) {
    const person = makePerson(300 + j);
    const off = (j % 6) - 2;
    const d = new Date(today);
    d.setDate(d.getDate() + off);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const mins = 8 * 60 + ((j * 35) % (12 * 60));
    let hora = `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
    if (key === todayKey && hora >= '16:55' && hora <= '17:05') hora = '18:20';
    const status =
      off < 0
        ? j % 5 === 0
          ? 'Não realizada'
          : 'Realizada'
        : ['Confirmada', 'Confirmada', 'Pendente', 'Reagendada'][j % 4];
    rows.push({
      id: `f${j}`,
      pid: null,
      nome: person.nome,
      proc: `#${String(600 + j).padStart(5, '0')}`,
      medico: person.medico,
      dateKey: key,
      dataBr: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
      hora,
      tipo: ['Primeira', 'Recorrência', 'Gratuita'][j % 3],
      status,
      anamnese: j % 3 !== 2,
    });
  }

  rows.sort((a, b) => (a.dateKey + a.hora).localeCompare(b.dateKey + b.hora));
  return rows;
}

/* ---------- Programa Trainee Hard · 3 Dias (Básico → Intermediário → Avançado) ---------- */
export const TRN_MIN: Record<'d1' | 'd2' | 'd3' | 'final', number> = {
  d1: 80,
  d2: 80,
  d3: 80,
  final: 90,
};

export const TRN_MAXT: Record<'d1' | 'd2' | 'd3' | 'final', number> = {
  d1: 3,
  d2: 3,
  d3: 3,
  final: 2,
};

export const TRN_TIME_SECONDS = 45 * 60;

const Q = (q: string, o: string[], c: number | number[], w: string): TraineeQuestionRaw => ({
  q,
  o,
  c,
  w,
});

export const TRAINEE_DAYS: TraineeDayDef[] = [
  {
    k: 'd1',
    nivel: 'Básico',
    titulo: 'Dia 1 · Nível Básico: Chat geral, Agendamento e Reagendamento',
    meta: 'Dominar o primeiro contato, abrir Negociação antes de responder, agendar com /importante e aplicar rigorosamente a regra das 2 horas.',
    subs: [
      [
        'Chat geral',
        [
          'Primeiro atendimento das dúvidas gerais. Antes de responder, abra a Negociação (consultas e entregas) para ter o contexto real.',
          'Se a dúvida é de outro setor, encaminhe pelo botão Departamento em vez de responder fora da sua área.',
          'Ao resolver: nota interna com o que foi feito e status do atendimento Resolvido.',
        ],
      ],
      [
        'Agendamento',
        [
          'Abra a Negociação para saber se é primeira consulta ou retorno (retorno prioriza o mesmo médico).',
          'Ofereça os horários disponíveis e confirme o escolhido pelo paciente.',
          'Envie /importante: tolerância de até 5 minutos de atraso e regra de reagendamento com menos de 2 horas.',
          'Registre nas notas e encaminhe o chat para Confirmação em andamento.',
        ],
      ],
      [
        'Reagendamento',
        [
          'Abra a Negociação para ver a consulta atual e as anteriores.',
          'Menos de 2 horas de antecedência, ou falta: envie /devido (cobrança de nova consulta) e pergunte se o paciente quer reagendar ou manter o horário.',
          'Com mais de 2 horas de antecedência o reagendamento segue normal, sem cobrança.',
          'Registre o novo horário e o motivo; altere o status para Resolvido.',
        ],
      ],
    ],
    prat: [
      {
        id: 'd1_0',
        deptKey: 'geral',
        text: 'Chat geral: abra a Negociação (aba Entregas), responda o paciente, registre nota interna e marque Resolvido.',
        hint: 'No Simulador, filtre por "Chat geral", clique no ícone de pasta ao lado do nome, confira Entregas, responda, adicione nota e mude o status para Resolvido.',
      },
      {
        id: 'd1_1',
        deptKey: 'agendamento',
        text: 'Agendamento: simule um agendamento, envie /importante, registre nota e encaminhe para Confirmação em andamento.',
        hint: 'No Simulador, filtre por "Agendamento", envie /importante, adicione nota e use Departamento → Confirmação em andamento.',
      },
      {
        id: 'd1_2',
        deptKey: 'reagendamento',
        text: 'Reagendamento: atenda um pedido com menos de 2 horas usando /devido, registre novo horário e motivo em nota.',
        hint: 'No Simulador, filtre por "Reagendamento", envie /devido, registre nota com novo horário/motivo e finalize como Resolvido.',
      },
    ],
    pool: [
      Q(
        'No Chat geral, o paciente pergunta quando chega o pedido. Qual é o primeiro passo?',
        [
          'Informar o prazo padrão de cabeça',
          'Encaminhar ao Agendamento',
          'Abrir a Negociação e conferir a aba Entregas',
          'Marcar como Resolvido e responder depois',
        ],
        2,
        'A Negociação mostra consultas e entregas; responder sem consultar é um palpite.'
      ),
      Q(
        'Um paciente do Chat geral quer marcar a primeira consulta. O correto é:',
        [
          'Marcar você mesma no Chat geral',
          'Encaminhar para Agendamento pelo botão Departamento',
          'Pedir que ligue depois',
          'Resolver e encerrar',
        ],
        1,
        'Dúvida ou pedido de outro setor deve ser encaminhado pelo botão Departamento.'
      ),
      Q(
        'Ao concluir um atendimento resolvido, o que deve ser feito? (marque todas)',
        [
          'Registrar nota interna do que foi resolvido',
          'Alterar o status do atendimento para Resolvido',
          'Apagar a conversa',
          'Enviar /faltou',
        ],
        [0, 1],
        'Nota interna e status Resolvido garantem histórico completo; nunca se apaga conversa.'
      ),
      Q(
        'Antes de oferecer horários no Agendamento, o que verificar na Negociação?',
        [
          'O endereço do paciente',
          'Se é primeira consulta ou retorno',
          'O valor das entregas',
          'O número de notas anteriores',
        ],
        1,
        'Primeira consulta e retorno têm fluxos e vínculos médicos diferentes.'
      ),
      Q(
        'Após confirmar o horário escolhido pelo paciente no Agendamento, qual atalho enviar?',
        ['/importante', '/confirmacao', '/acesso', '/faltou'],
        0,
        '/importante comunica a tolerância de 5 minutos e a regra de reagendamento (2h).'
      ),
      Q(
        'Concluído o agendamento, para onde o chat é encaminhado?',
        ['Chat geral', 'Confirmação em andamento', 'Suporte aos médicos', 'Fica no Agendamento'],
        1,
        'Após agendar e registrar a nota, encaminha-se para Confirmação em andamento.'
      ),
      Q(
        'O paciente entra na sala 6 minutos após o horário. Pela regra do /importante:',
        [
          'Está dentro da tolerância',
          'Passou da tolerância de até 5 minutos',
          'A tolerância é de 10 minutos',
          'Depende do médico',
        ],
        1,
        'A tolerância de atraso informada no /importante é de até 5 minutos.'
      ),
      Q(
        'O paciente avisa 1h30 antes que não poderá ir. O correto é:',
        [
          'Reagendar sem custo por ser mais de 1h',
          'Enviar /devido e perguntar se quer reagendar com nova cobrança ou manter o horário',
          'Recusar o reagendamento',
          'Encaminhar ao médico',
        ],
        1,
        'Menos de 2 horas de antecedência gera cobrança de nova consulta (/devido).'
      ),
      Q(
        'O paciente avisa com 3 horas de antecedência e quer reagendar. O correto é:',
        [
          'Enviar /devido',
          'Reagendar normalmente, sem cobrança, registrando o motivo',
          'Marcar como falta',
          'Pedir novo pagamento',
        ],
        1,
        'Com mais de 2 horas de antecedência o reagendamento ocorre sem custo.'
      ),
      Q(
        'O paciente faltou ontem e pede para remarcar sem pagar. A resposta correta é:',
        [
          'Remarcar sem custo',
          'Enviar /devido, pois falta gera cobrança de nova consulta',
          'Pedir desculpas e abrir exceção automática',
          'Encaminhar à Confirmação',
        ],
        1,
        'Falta à consulta exige novo pagamento conforme a regra do /devido.'
      ),
      Q(
        'Ao reagendar, o que deve constar nas notas internas? (marque todas)',
        [
          'O novo horário',
          'O motivo do reagendamento',
          'Dados pessoais sem relação com o caso',
          'Opinião pessoal sobre o paciente',
        ],
        [0, 1],
        'Novo horário e motivo objetivos permitem que o próximo atendente continue sem ruído.'
      ),
      Q(
        'No Reagendamento, o primeiro passo operacional é:',
        [
          'Enviar /devido imediatamente',
          'Abrir a Negociação para ver a consulta atual e as anteriores',
          'Resolver o chat',
          'Encaminhar ao Agendamento',
        ],
        1,
        'Sem verificar a consulta atual não há como validar antecedência nem histórico.'
      ),
    ],
  },
  {
    k: 'd2',
    nivel: 'Intermediário',
    titulo: 'Dia 2 · Nível Intermediário: Confirmação, Suporte aos Pacientes e Médicos',
    meta: 'Conduzir a confirmação ativa (4.1 a 4.4), tratar falhas de acesso e atrasos no CRM ao vivo e apoiar médicos durante a agenda.',
    subs: [
      [
        'Confirmação (4.1 a 4.4)',
        [
          'Véspera: link de confirmação. No dia: 07:00 (Tudo certo para hoje! ou Gostaria de tirar dúvidas), 2h antes (orientações de acesso) e 10 min antes (link; chat passa sozinho para Em andamento).',
          'Paciente confirmou: envie /confirmacao. Tirou dúvidas: esclareça primeiro e depois confirme.',
          'Sem contato: ligue; se não atender, envie solicitação de contato e registre todas as tentativas nas notas.',
        ],
      ],
      [
        'Suporte aos pacientes (em andamento, aguardando, faltou)',
        [
          '/acesso: pergunta se conseguiu acessar e orienta permitir câmera e microfone e clicar em Entrar na consulta.',
          'Se conseguiu, /aguarde (médico finalizando anterior). Se não conseguiu, /devido para decidir entre reagendar com cobrança ou manter horário.',
          'CRM: Em andamento (Chat do paciente, nota "Consulta em andamento", status Aguardando); Aguardando sem médico (/aguarde2); Faltou (nota de falta com/sem custo e /faltou).',
        ],
      ],
      [
        'Suporte aos médicos',
        [
          'Consulte o CRM para ver o status real da consulta do paciente antes de responder ao médico.',
          'Responda ao médico combinando o próximo passo e, se necessário, fale com o paciente pelo chat dele.',
          'Registre tudo nas notas e finalize como Resolvido.',
        ],
      ],
    ],
    prat: [
      {
        id: 'd2_0',
        deptKey: 'confirmacao',
        text: 'Confirmação: dispare os lembretes, envie /importante, confirme com /confirmacao e registre tentativa de contato em nota.',
        hint: 'Em "Consulta Médica - Confirmação", use /importante, /confirmacao, dispare os lembretes no topo do chat e salve uma nota.',
      },
      {
        id: 'd2_1',
        deptKey: 'andamento',
        text: 'Suporte aos pacientes & CRM: no CRM atenda um card Aguardando (/aguarde2) e um card Faltou (nota de falta + /faltou).',
        hint: 'Abra o CRM, acesse o Chat do paciente de um card Aguardando para enviar /aguarde2 e de um card Faltou para enviar /faltou com nota de Falta.',
      },
      {
        id: 'd2_2',
        deptKey: 'medicos',
        text: 'Suporte aos médicos: consulte o CRM, responda a um médico combinando o próximo passo e registre a nota.',
        hint: 'Filtre por "Suporte aos médicos", verifique o CRM, responda o médico no chat, adicione nota e finalize.',
      },
    ],
    pool: [
      Q(
        'Quando o paciente recebe o primeiro link de confirmação (etapa 4.1)?',
        ['2 horas antes', 'Um dia antes da consulta', 'No dia, às 07:00', 'Apenas se pedir'],
        1,
        'Na véspera (um dia antes) o paciente recebe o link para reforçar o compromisso.'
      ),
      Q(
        'Qual a sequência correta dos contatos automáticos no dia da consulta?',
        [
          '2h antes, 07:00, link de acesso',
          '07:00, 2 horas antes, link de acesso 10 minutos antes',
          'Link de acesso, 07:00, 2 horas antes',
          '07:00, link de acesso, 2 horas antes',
        ],
        1,
        '07:00 (confirmação/dúvidas) → 2h antes (preparo) → 10 min antes (link da sala).'
      ),
      Q(
        'No lembrete das 07:00 o paciente responde "Tudo certo para hoje!". Você envia:',
        ['/acesso', '/confirmacao', '/aguarde', '/devido'],
        1,
        '/confirmacao confirma a consulta e avisa que o link chega 10 minutos antes.'
      ),
      Q(
        'O paciente escolheu "Gostaria de tirar dúvidas". O correto é:',
        [
          'Confirmar na hora com /confirmacao',
          'Esclarecer as dúvidas e depois confirmar com /confirmacao',
          'Ignorar até 2h antes',
          'Reagendar',
        ],
        1,
        'Primeiro resolva as dúvidas do paciente; só então finalize a confirmação.'
      ),
      Q(
        'Sem contato do paciente no dia, quais ações estão corretas? (marque todas)',
        [
          'Ligar para confirmar',
          'Se não atender, enviar solicitação de contato',
          'Registrar todas as tentativas nas notas',
          'Cancelar a consulta imediatamente',
        ],
        [0, 1, 2],
        'A confirmação ativa exige ligação, solicitação de contato e registro integral em notas.'
      ),
      Q(
        'O que acontece 10 minutos antes da consulta?',
        [
          'Nada muda no chat',
          'O link de acesso é enviado e o chat passa sozinho para Em andamento',
          'O paciente é reagendado',
          'O status muda para Concluído',
        ],
        1,
        'O disparo de 10 minutos envia o link e transfere o chat para Em andamento.'
      ),
      Q(
        'O paciente diz que a câmera está bloqueada e não consegue entrar. A orientação é:',
        [
          'Reagendar na hora',
          'Permitir o acesso à câmera e ao microfone e clicar em Entrar na consulta',
          'Esperar o médico resolver',
          'Marcar falta imediatamente',
        ],
        1,
        'Essa orientação técnica faz parte do atalho /acesso.'
      ),
      Q(
        'Card em Aguardando: o paciente está na sala e o médico ainda não entrou. No Chat do paciente você envia:',
        ['/faltou', '/devido', '/aguarde2', '/importante'],
        2,
        '/aguarde2 pede para o paciente aguardar só mais um instante.'
      ),
      Q(
        'O paciente faltou à consulta. Qual combinação está correta?',
        [
          'Só enviar /faltou',
          'Registrar nota de falta (com ou sem custo) e enviar /faltou',
          'Reagendar sem custo',
          'Marcar como Resolvido sem nota',
        ],
        1,
        'A nota de falta (com ou sem custo) e o atalho /faltou são obrigatórios juntos.'
      ),
      Q(
        'O paciente não conseguiu acessar e vai decidir entre reagendar ou manter o horário. Qual atalho?',
        ['/aguarde', '/confirmacao', '/devido', '/acesso'],
        2,
        '/devido informa a regra das 2h e pergunta se deseja reagendar ou manter.'
      ),
      Q(
        'Um médico pergunta pelo paciente das 15h. O primeiro passo é:',
        [
          'Pedir que ele ligue para o paciente',
          'Consultar o CRM para ver o status da consulta',
          'Reagendar o paciente',
          'Marcar falta sem verificar',
        ],
        1,
        'Consultar o CRM primeiro dá visibilidade real se o paciente está Aguardando, Em andamento ou Faltou.'
      ),
      Q(
        'No card Em andamento do CRM, qual é o procedimento padrão no chat?',
        [
          'Enviar /faltou',
          'Abrir Chat do paciente, anotar "Consulta em andamento" e mudar status do atendimento para Aguardando',
          'Encaminhar à Confirmação',
          'Nenhuma ação',
        ],
        1,
        'Esse registro mantém a fila "Em atendimento" limpa e o histórico preciso.'
      ),
    ],
  },
  {
    k: 'd3',
    nivel: 'Avançado',
    titulo: 'Dia 3 · Nível Avançado: Solicitações, Rotina de Turno e Qualidade',
    meta: 'Dominar o fluxo completo de Solicitações aos médicos (5 colunas), levantamento de prioridades e passagem de turno sem falhas.',
    subs: [
      [
        'Solicitações (5 colunas)',
        [
          'Colunas: Pendente, Intervenção (o médico devolveu e o atendente age), Solicitado ao médico, Em atraso (cobrar o médico) e Concluído.',
          'Obrigatórios: motivo, médico, paciente e observações. Urgência só com justificativa real. Receita existente ou nova pela aba Anexos.',
          'Receita ilegível: Traduzir receita. Dúvida de dose: registre e peça ao médico — o atendente nunca decide dose.',
          'Motivo e médico podem ser alterados em Abrir detalhes; todas as edições ficam no histórico.',
        ],
      ],
      [
        'Rotina de turno e auditoria de qualidade',
        [
          'Início do turno: levantamento de Pendente, Intervenção e Em atraso, priorizando urgentes e mais antigas.',
          'Passagem de turno: registrar o que aguarda médico, atrasos, pacientes aguardando retorno e orientações.',
          'Antes de concluir: confirmar que o paciente recebeu o retorno e o registro está completo.',
        ],
      ],
    ],
    prat: [
      {
        id: 'd3_0',
        deptKey: 'solicitacoes',
        text: 'Solicitações: crie uma solicitação (ou edite motivo/médico), anexe arquivo se necessário e leve até Concluído.',
        hint: 'Abra a aba Solicitações, crie ou edite um card no Drawer e avance o status até Concluído.',
      },
      {
        id: 'd3_1',
        deptKey: 'solicitacoes',
        text: 'Levantamento & Passagem de turno: revise Pendente, Intervenção e Em atraso e registre uma passagem de turno em nota.',
        hint: 'No Simulador (Solicitações), escreva uma nota interna de passagem de turno citando atrasos e pendências.',
      },
      {
        id: 'd3_2',
        deptKey: 'solicitacoes',
        text: 'Fluxo de qualidade: responda uma dúvida de posologia encaminhando como Solicitação ao médico (sem orientar dose).',
        hint: 'No Simulador (Solicitações), crie uma solicitação "Posologia e orientações" a partir do painel direito e envie ao médico.',
      },
    ],
    pool: [
      Q(
        'Qual coluna reúne as solicitações devolvidas pelo médico que exigem ação do atendente?',
        ['Pendente', 'Intervenção', 'Em atraso', 'Concluído'],
        1,
        'Intervenção concentra os retornos médicos que precisam de ação do atendimento.'
      ),
      Q(
        'Quais campos são obrigatórios ao criar uma nova solicitação?',
        [
          'Só o paciente',
          'Motivo e médico',
          'Motivo, médico, paciente e observações',
          'Receita e anexos',
        ],
        2,
        'Motivo, médico, paciente e observações são os 4 campos obrigatórios.'
      ),
      Q(
        'Por que o campo Paciente só habilita depois de selecionar o Médico?',
        [
          'É um erro visual',
          'A lista de pacientes elegíveis depende do médico escolhido',
          'Para o médico aprovar antes',
          'É opcional',
        ],
        1,
        'Os pacientes vinculados são filtrados pelo médico responsável.'
      ),
      Q(
        'Quando usar a tag de urgência na solicitação?',
        [
          'Em todas as solicitações para ir mais rápido',
          'Somente quando há justificativa real para priorizar',
          'Só em laudos',
          'Nunca',
        ],
        1,
        'Se tudo for marcado como urgente, a priorização perde o efeito.'
      ),
      Q(
        'A receita está com letra ilegível. Qual é o motivo correto?',
        ['Dúvida', 'Traduzir receita', 'Laudo ou documento', 'Renovação de receita'],
        1,
        'O motivo específico "Traduzir receita" direciona corretamente para transcrição médica.'
      ),
      Q(
        'A posologia parece diferente do que o paciente relata. O correto é:',
        [
          'Orientar a dose que parecer mais segura',
          'Registrar e pedir confirmação ao médico via solicitação',
          'Ignorar a divergência',
          'Deixar o paciente ajustar por conta',
        ],
        1,
        'O atendente nunca define ou altera dose; sempre escala ao médico.'
      ),
      Q(
        'Como enviar uma nova receita junto à solicitação?',
        [
          'Colando o texto nas Observações',
          'Na aba Anexos do drawer, usando Anexar receita',
          'Não é possível enviar nova receita',
          'Apenas pelo chat geral',
        ],
        1,
        'Novas receitas e documentos de apoio são adicionados na aba Anexos.'
      ),
      Q(
        'Solicitação na coluna Em atraso. O que fazer?',
        [
          'Esperar mais 48h sem agir',
          'Concluir automaticamente',
          'Cobrar o médico e registrar a cobrança no histórico/notas',
          'Apagar e criar outra do zero',
        ],
        2,
        'Atraso exige cobrança ativa ao médico e registro formal.'
      ),
      Q(
        'Foi escolhido o médico errado em uma solicitação já criada. O correto é:',
        [
          'Apagar e refazer outra',
          'Abrir detalhes, alterar o médico e salvar (fica registrado no histórico)',
          'Avisar apenas por chat privado',
          'Concluir mesmo assim',
        ],
        1,
        'Editar nos detalhes preserva o rastreamento e registra a troca no histórico.'
      ),
      Q(
        'Qual é o primeiro passo operacional ao iniciar o turno em Solicitações?',
        [
          'Concluir tudo que estiver aberto',
          'Fazer o levantamento de Pendente, Intervenção e Em atraso, priorizando urgentes e antigas',
          'Marcar tudo como urgente',
          'Criar novas solicitações sem checar a fila',
        ],
        1,
        'O levantamento inicial define a fila crítica do turno.'
      ),
      Q(
        'O que deve constar obrigatoriamente na passagem de turno? (marque todas)',
        [
          'O que aguarda retorno do médico',
          'Solicitações em atraso',
          'Pacientes aguardando retorno',
          'Senhas pessoais de acesso',
        ],
        [0, 1, 2],
        'Pendências operacionais e atrasos devem ser passados formalmente para o próximo turno.'
      ),
      Q(
        'Antes de mover uma solicitação para Concluído, confirme que:',
        [
          'O motivo é Dúvida',
          'O paciente recebeu o retorno e o registro está completo',
          'Há pelo menos um anexo',
          'O médico está online no chat',
        ],
        1,
        'Concluir exige confirmação de entrega do retorno ao paciente e registro completo.'
      ),
    ],
  },
];

export const TRAINEE_INTEGRATED_POOL: TraineeQuestionRaw[] = [
  Q(
    'Paciente faltou à consulta, volta pedindo novo horário sem pagar e questiona a cobrança. Qual conjunto está correto?',
    [
      'Reagendar sem custo e apagar a nota de falta',
      'Nota de falta e /faltou; para reagendar, enviar /devido explicando a cobrança de nova consulta',
      'Enviar apenas /faltou',
      'Encaminhar para Suporte aos médicos',
    ],
    1,
    'Falta exige registro formal (nota + /faltou), e reagendamento pós-falta segue a regra do /devido.'
  ),
  Q(
    'No Chat geral o paciente pede um laudo médico para apresentar no trabalho. O correto é:',
    [
      'Prometer que o laudo sai em 1 hora',
      'Encaminhar para Solicitações e abrir solicitação com motivo Laudo ou documento',
      'Responder que a clínica não emite laudos',
      'Resolver e encerrar o chat',
    ],
    1,
    'Pedidos de documentos médicos são encaminhados e registrados em Solicitações.'
  ),
  Q(
    'Na Confirmação, o paciente não respondeu aos lembretes e a consulta é em 30 minutos. A ação correta é:',
    [
      'Esperar passivamente o link automático',
      'Ligar para confirmar; se não atender, enviar solicitação de contato e registrar todas as tentativas',
      'Reagendar por conta própria',
      'Marcar falta antes do horário',
    ],
    1,
    'Durante todo o expediente aplica-se a confirmação ativa (etapa 4.4).'
  ),
  Q(
    'Em plena Confirmação o paciente envia foto da receita e pergunta se pode dobrar a dose. A conduta é:',
    [
      'Responder que pode se estiver sentindo dor',
      'Não orientar dose; registrar e abrir solicitação "Posologia e orientações" ao médico',
      'Ignorar a pergunta e enviar /confirmacao',
      'Pedir que suspenda o produto',
    ],
    1,
    'Conduta clínica/posologia pertence exclusivamente ao médico.'
  ),
  Q(
    'Qual sequência descreve corretamente o atendimento quando o paciente acessou a sala, mas o médico atrasa?',
    [
      'Enviar /faltou e registrar nota de falta',
      'Enviar /aguarde2 no Chat do paciente e manter o card em Aguardando',
      'Enviar /devido imediatamente',
      'Reagendar sem consultar o médico',
    ],
    1,
    'Paciente já na sala esperando o médico: /aguarde2 no Chat do paciente.'
  ),
  Q(
    'Ao final do turno há uma solicitação Em atraso, uma em Intervenção e um paciente aguardando retorno. O que fazer?',
    [
      'Deixar sem registro para o próximo turno descobrir',
      'Cobrar o atraso quando possível e registrar todas as pendências na passagem de turno',
      'Concluir as duas para limpar o painel',
      'Apagar a solicitação em atraso',
    ],
    1,
    'Passagem de turno exige transparência total sobre atrasos, intervenções e retornos pendentes.'
  ),
];

export const TRILHA_STAGES: TrilhaStage[] = [
  {
    id: 'e1',
    t: 'Dia 1 · Boas-vindas e Regras de Ouro',
    d: 'Conhecer o setor, as normas de atendimento e as ferramentas operacionais.',
    items: [
      ['e1a', 'Revisar os fundamentos de atendimento e jornada do paciente', ''],
      ['e1b', 'Memorizar as regras de tolerância (5 min) e reagendamento (2h)', ''],
      ['e1c', 'Conhecer o fluxo entre Simulador, Consultas, CRM e Solicitações', ''],
      ['e1d', 'Validar acesso e comandos rápidos (/) no Simulador de IA', ''],
      ['e1e', 'Alinhar horários de entrada, pausa e passagem de turno com a liderança', ''],
    ],
    quiz: [
      [
        'Qual é o fluxo ideal de ponta a ponta?',
        [
          'Pagamento e agendamento no mesmo dia',
          'Pagamento, agendamento, consulta, importação e rastreio organizados sem ruído',
          'Consulta em até 7 dias',
          'Receita em até 48h',
        ],
        1,
      ],
      [
        'O paciente pergunta se o tratamento vai funcionar. O que fazer?',
        [
          'Garantir melhora rápida',
          'Explicar que o médico avaliará o caso na consulta e que a equipe acompanha a jornada',
          'Indicar uma dose inicial',
          'Dizer que não sabe',
        ],
        1,
      ],
      [
        'Um paciente relata crise aguda ou risco imediato. O que fazer?',
        [
          'Encerrar o atendimento',
          'Acolher, seguir o protocolo de urgência e acionar imediatamente a coordenação',
          'Enviar mensagem pronta e sair',
          'Pedir para retornar amanhã',
        ],
        1,
      ],
    ],
  },
  {
    id: 'e2',
    t: 'Dia 1 e 2 · Jornada e Ferramentas',
    d: 'Dominar o histórico em Negociação, CRM, Consultas e atalhos.',
    items: [
      ['e2a', 'Estudar a jornada: agendamento → lembrete véspera → 07:00 → 2h → 10 min → consulta', ''],
      ['e2b', 'Abrir a Negociação (Consultas e Entregas) antes de responder dúvidas', ''],
      ['e2c', 'Executar o passo a passo guiado de Agendamento e Chat geral', ''],
      ['e2d', 'Localizar consultas pendentes na tela Todas as Consultas sem o filtro padrão', ''],
      ['e2e', 'Praticar respostas com o Simulador de IA em múltiplos cenários', ''],
    ],
    quiz: [
      [
        'Quando o link da sala chega automaticamente para o paciente?',
        ['1 hora antes', '10 minutos antes', 'Na véspera', 'Só depois que o médico entra'],
        1,
      ],
      [
        'Onde fica o botão para abrir o histórico de Consultas e Entregas do paciente?',
        ['No Trello', 'No botão Abrir negociação (ícone de pasta) no chat', 'No Slack', 'Apenas no financeiro'],
        1,
      ],
      [
        'O retorno médico deve ser agendado preferencialmente com…',
        ['Qualquer médico livre', 'O mesmo médico da consulta anterior', 'Um médico aleatório', 'O primeiro horário da lista'],
        1,
      ],
    ],
  },
  {
    id: 'e3',
    t: 'Dia 2 · Normas na Prática e Crises',
    d: 'Reagendamento, cobrança, notas internas e conduta em atrasos.',
    items: [
      ['e3a', 'Aplicar a regra das 2 horas com /devido quando aplicável', ''],
      ['e3b', 'Registrar notas internas completas (data, hora, tentativas de contato e motivo)', ''],
      ['e3c', 'Conduzir confirmação ativa (etapas 4.1 a 4.4)', ''],
      ['e3d', 'Tratar bloqueio de câmera/microfone (/acesso) e atraso médico (/aguarde2)', ''],
    ],
    quiz: [
      [
        'Qual destes casos é reagendamento SEM custo?',
        [
          'Paciente faltou sem avisar',
          'Paciente avisou com 3 horas de antecedência',
          'Pedido 30 minutos antes',
          'Falta não justificada após o horário',
        ],
        1,
      ],
      [
        'Qual anotação interna segue o padrão corporativo?',
        [
          '“Deve ter esquecido.”',
          '“Paciente não compareceu à consulta das 10h. Tentativas de contato sem sucesso. Enviado /faltou.”',
          '“Faltou de novo.”',
          '“Não quis vir.”',
        ],
        1,
      ],
    ],
  },
  {
    id: 'e4',
    t: 'Dia 3 · Todos os Subsetores e Solicitações',
    d: 'Integrar todos os 7 subsetores, Kanban de Solicitações e passagem de turno.',
    items: [
      ['e4a', 'Executar os 6 roteiros guiados em Passo a Passo dos Subsetores', ''],
      ['e4b', 'Criar e editar solicitações médicas respeitando os campos obrigatórios', ''],
      ['e4c', 'Fazer levantamento das filas Pendente, Intervenção e Em atraso', ''],
      ['e4d', 'Concluir as provas diárias (80%+) e a Prova Final Hard (90%+)', ''],
    ],
    quiz: [
      [
        'Na tela de CRM, qual coluna exige intervenção imediata de acesso ou espera?',
        ['Concluídas', 'Aguardando e Em andamento', 'Arquivadas', 'Nenhuma'],
        1,
      ],
      [
        'O médico não entrou na sala e o paciente aguarda dentro da tolerância. O correto é:',
        [
          'Enviar /faltou para o paciente',
          'Enviar /aguarde2 ao paciente e alinhar com o médico no suporte',
          'Dizer que a culpa é da conexão do paciente',
          'Encerrar o chat como Resolvido',
        ],
        1,
      ],
    ],
  },
];

export const EQUIPE: TeamMember[] = [
  { apelido: 'Ana', nome: 'Ana Gabriela Garcia', email: 'agarcia@clickcannabis.com', subsetor: 'Auditoria' },
  { apelido: 'Michele', nome: 'Michele Xavier', email: 'mxavier@clickcannabis.com', subsetor: 'Auditoria' },
  { apelido: 'Brenda', nome: 'Brenda Miranda', email: 'bmiranda@clickcannabis.com', subsetor: 'Auditoria' },
  { apelido: 'Simone', nome: 'Simone Xavier', email: 'sxavier@clickcannabis.com', subsetor: 'Chat geral' },
  { apelido: 'Karol Nani', nome: 'Karolyne Nani de Souza', email: 'ksouza@clickcannabis.com', subsetor: 'Chat geral' },
  { apelido: 'Julyana', nome: 'Julyana Oliveira', email: 'juoliveira@clickcannabis.com', subsetor: 'Confirmação' },
  { apelido: 'Bel', nome: 'Isabel Bach', email: 'ibach@clickcannabis.com', subsetor: 'Confirmação' },
  { apelido: 'Rayssa', nome: 'Rayssa Silva Dimar', email: 'rdimar@clickcannabis.com', subsetor: 'Confirmação' },
  { apelido: 'Aninha', nome: 'Aninha', email: '', subsetor: 'Confirmação' },
  { apelido: 'Carla', nome: 'Carla Costa', email: 'ccosta@clickcannabis.com', subsetor: 'Suporte aos pacientes' },
  { apelido: 'Caca', nome: 'Caroline Schwantes Machado', email: 'cmachado@clickcannabis.com', subsetor: 'Suporte aos pacientes' },
  { apelido: 'Jamily', nome: 'Jamily Rodrigues', email: 'jrodrigues@clickcannabis.com', subsetor: 'Suporte aos pacientes' },
  { apelido: 'Luanna', nome: 'Luanna Pinheiro do Carmo', email: 'lpinheiro@clickcannabis.com', subsetor: 'Suporte aos pacientes' },
  { apelido: 'Yasmin', nome: 'Yasmin de Oliveira Telles Souza', email: 'ytelles@clickcannabis.com', subsetor: 'Suporte aos pacientes' },
  { apelido: 'Maju', nome: 'Maria Julia Máximo Pescarolli', email: 'mpescarolli@clickcannabis.com', subsetor: 'Suporte aos médicos' },
  { apelido: 'Tuany', nome: 'Tuany Felipe', email: 'tfelipe@clickcannabis.com', subsetor: 'Suporte aos médicos' },
  { apelido: 'Greicy', nome: 'Greicy Kelly Oliveira Quintela', email: 'gquintela@clickcannabis.com', subsetor: 'Agendamento e reagendamento' },
  { apelido: 'Naiara', nome: 'Naiara Santos', email: 'nasantos@clickcannabis.com', subsetor: 'Agendamento e reagendamento' },
];

export const TR_DIAS: Array<[string, string, string[]]> = [
  ['Segunda-feira', 'Chat geral + Agendamento', ['Chat geral', 'Agendamento']],
  ['Terça-feira', 'Reagendamento', ['Reagendamento']],
  ['Quarta-feira', 'Confirmação', ['Confirmação']],
  ['Quinta-feira', 'Suporte aos pacientes + Suporte aos médicos', ['Suporte aos pacientes', 'Suporte aos médicos']],
  ['Sexta-feira', 'Solicitação', ['Solicitação']],
];

export const TR_SUBS = [
  'Chat geral',
  'Agendamento',
  'Reagendamento',
  'Confirmação',
  'Suporte aos pacientes',
  'Suporte aos médicos',
  'Solicitação',
];

export const TR_HOL: Record<string, string> = {
  '2026-11-20': 'Feriado',
  '2026-12-24': 'Véspera de Natal',
  '2026-12-25': 'Natal',
  '2026-12-31': 'Véspera de Ano-Novo',
  '2027-01-01': 'Ano-Novo',
};

export const TR_NIV = ['', 'Precisa reforçar', 'Em desenvolvimento', 'Domina'];
