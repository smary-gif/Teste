export type VideoVisualType =
  | 'chat'
  | 'agendamento'
  | 'reagendamento'
  | 'confirmacao'
  | 'crm'
  | 'medicos'
  | 'kanban';

export interface SubsectorVideoScene {
  id: string;
  title: string;
  screenLabel: string;
  narration: string;
  visualType: VideoVisualType;
  highlights: string[];
  callout: string;
  durationSec: number;
  audioUrl?: string;
}

export interface SubsectorVideoScript {
  key: string;
  title: string;
  subtitle: string;
  totalLabel: string;
  externalVideoUrl?: string;
  scenes: SubsectorVideoScene[];
}

export const SUBSECTOR_VIDEOS: Record<string, SubsectorVideoScript> = {
  geral: {
    key: 'geral',
    title: 'Videoaula · Chat geral',
    subtitle: 'Triagem inicial, consulta à Negociação, encaminhamento entre setores e nota completa.',
    totalLabel: '4 cenas · ~48s',
    scenes: [
      {
        id: 'g1',
        title: '01. Filtrar o departamento e ler a dúvida',
        screenLabel: 'ClickChat · Selecionar departamento',
        narration:
          'No Chat geral, comece selecionando o departamento na barra superior. Abra a conversa do paciente e leia toda a mensagem com atenção antes de digitar qualquer resposta.',
        visualType: 'chat',
        highlights: ['Departamento: Chat geral', 'Ler histórico completo', 'Identificar pedido real'],
        callout: 'Nunca responda no automático sem checar se o assunto pertence a outro subsetor.',
        durationSec: 11,
      },
      {
        id: 'g2',
        title: '02. Abrir Negociação antes de responder',
        screenLabel: 'Negociação · Consultas e Entregas',
        narration:
          'Clique em Abrir Negociação ao lado do nome do paciente. Ali você confere consultas anteriores, status de pagamento e rastreio de entregas antes de passar qualquer prazo.',
        visualType: 'chat',
        highlights: ['Botão Abrir Negociação', 'Aba Entregas / Pedidos', 'Aba Consultas / Links'],
        callout: 'Consultas, entregas e Nota Fiscal estão centralizadas dentro da Negociação.',
        durationSec: 12,
      },
      {
        id: 'g3',
        title: '03. Responder ou encaminhar ao setor certo',
        screenLabel: 'ClickChat · Encaminhar Departamento',
        narration:
          'Se for dúvida geral ou entrega, responda com clareza e cordialidade. Se o paciente pedir reagendamento, laudo ou posologia, encaminhe o chat pelo botão Departamento para a fila correta.',
        visualType: 'chat',
        highlights: ['Resposta clara', 'Botão Departamento', 'Encaminhar se necessário'],
        callout: 'Dúvidas clínicas ou de dose nunca são respondidas no chat: encaminhe para Solicitações.',
        durationSec: 12,
      },
      {
        id: 'g4',
        title: '04. Registrar nota interna e concluir',
        screenLabel: 'Notas Internas · Status Resolvido',
        narration:
          'Por fim, registre na nota interna o que foi verificado e resolvido, informando canal e desfecho. Só depois altere o status do atendimento para Resolvido.',
        visualType: 'chat',
        highlights: ['Nota interna completa', 'Desfecho registrado', 'Status: Resolvido'],
        callout: 'Atendimento encerrado sem nota interna reprova na auditoria de qualidade.',
        durationSec: 11,
      },
    ],
  },

  agendamento: {
    key: 'agendamento',
    title: 'Videoaula · Agendamento',
    subtitle: 'Verificação de primeira consulta ou retorno, regra de agenda do dia e envio do /importante.',
    totalLabel: '4 cenas · ~50s',
    scenes: [
      {
        id: 'a1',
        title: '01. Conferir histórico na Negociação',
        screenLabel: 'Negociação · Primeira consulta vs Retorno',
        narration:
          'Ao atender em Agendamento, abra primeiro a Negociação do paciente para verificar se é primeira consulta ou retorno. Em retornos, priorize o mesmo médico do acompanhamento anterior.',
        visualType: 'agendamento',
        highlights: ['Abrir Negociação', 'Primeira consulta ou Retorno', 'Manter mesmo médico'],
        callout: 'Conferir o histórico evita agendar primeira consulta para quem já é paciente recorrente.',
        durationSec: 12,
      },
      {
        id: 'a2',
        title: '02. Checar agenda médica do dia',
        screenLabel: 'Agenda Médica · Regra Hoje vs Liderança',
        narration:
          'Lembre-se da regra da ClickCannabis: a agenda do médico abre somente no dia, Hoje. Para agendar em outra data, é obrigatório solicitar abertura à Liderança ou usar data específica liberada.',
        visualType: 'agendamento',
        highlights: ['Agenda aberta: Hoje', 'Outro dia: Liderança', 'Data específica liberada'],
        callout: 'Katlen Pfeifer, Stephanye ou Iris validam aberturas de agenda fora do dia atual.',
        durationSec: 13,
      },
      {
        id: 'a3',
        title: '03. Confirmar horário e enviar /importante',
        screenLabel: 'ClickChat · Atalho /importante',
        narration:
          'Assim que o paciente escolher o horário disponível, confirme o agendamento no sistema e envie imediatamente o comando /importante com a tolerância de 5 minutos e a regra das 2 horas.',
        visualType: 'agendamento',
        highlights: ['Confirmar data e hora', 'Enviar /importante', 'Tolerância 5 min · Regra 2h'],
        callout: 'O /importante protege a clínica e deixa o paciente ciente das regras desde o início.',
        durationSec: 13,
      },
      {
        id: 'a4',
        title: '04. Registrar nota e encaminhar para Confirmação',
        screenLabel: 'Departamento · Confirmação em andamento',
        narration:
          'Registre o médico, a data e o horário nas notas internas. Em seguida, encaminhe o atendimento no botão Departamento para Confirmação em andamento.',
        visualType: 'agendamento',
        highlights: ['Nota: médico + horário', 'Encaminhar Departamento', 'Confirmação em andamento'],
        callout: 'Nunca deixe um agendamento concluído parado na fila de Agendamento.',
        durationSec: 11,
      },
    ],
  },

  reagendamento: {
    key: 'reagendamento',
    title: 'Videoaula · Reagendamento',
    subtitle: 'Regra das 2 horas (/devido), agenda do dia vs Liderança, troca de médico e envio de links.',
    totalLabel: '5 cenas · ~62s',
    scenes: [
      {
        id: 'r1',
        title: '01. Avaliar prazo pela regra das 2 horas',
        screenLabel: 'Reagendamento · Aviso prévio ≥ 2h vs < 2h',
        narration:
          'Em Reagendamento, cheque primeiro o horário original na Negociação. Se o pedido tiver 2 horas ou mais de antecedência, o reagendamento é sem custo. Com menos de 2 horas ou falta, envie /devido.',
        visualType: 'reagendamento',
        highlights: ['Aviso ≥ 2h: sem custo', 'Menos de 2h ou falta: /devido', 'Novo pagamento necessário'],
        callout: 'Nunca libere isenção informal fora da regra das 2 horas sem autorização da Liderança.',
        durationSec: 13,
      },
      {
        id: 'r2',
        title: '02. Regra da agenda: Hoje vs Outro dia',
        screenLabel: 'Agenda do Médico · Hoje vs Solicitação à Liderança',
        narration:
          'Na tela de reagendamento, a agenda do médico mostra os horários livres de Hoje. Se o paciente precisar de outro dia, clique em Outro dia, selecione a data e envie a solicitação à Liderança ou use data específica liberada.',
        visualType: 'reagendamento',
        highlights: ['Agenda de Hoje: aberta', 'Outro dia: Solicitar Liderança', 'Data específica liberada'],
        callout: 'O sistema bloqueia a confirmação em outro dia até a solicitação ou liberação da data.',
        durationSec: 14,
      },
      {
        id: 'r3',
        title: '03. Alterar o médico durante o reagendamento',
        screenLabel: 'Reagendar Consulta · Troca de Médico',
        narration:
          'Se o médico atual não tiver horário disponível, você pode alterar o médico responsável diretamente dentro do reagendamento para visualizar e escolher os horários abertos de outro médico.',
        visualType: 'reagendamento',
        highlights: ['Selecionar novo médico', 'Horários atualizam na hora', 'Confirmar novo horário'],
        callout: 'Sempre confirme com o paciente se ele aceita a troca do profissional antes de salvar.',
        durationSec: 12,
      },
      {
        id: 'r4',
        title: '04. Encaminhar link de consulta, convidado ou Nota Fiscal',
        screenLabel: 'Menu da Consulta · Encaminhamento no Chat',
        narration:
          'Se o paciente precisar do link de acesso, link de convidado para acompanhante ou Nota Fiscal, encaminhe diretamente pelo menu da consulta ou na aba Links e Nota Fiscal da Negociação.',
        visualType: 'reagendamento',
        highlights: ['Link de consulta', 'Link de convidado', 'Nota Fiscal (NFS-e)'],
        callout: 'Use o link de convidado para acompanhantes; nunca envie o link exclusivo do médico.',
        durationSec: 12,
      },
      {
        id: 'r5',
        title: '05. Nota interna e encerramento do atendimento',
        screenLabel: 'Notas Internas · Status Resolvido',
        narration:
          'Anote nova data, horário, médico, enquadramento da regra de 2 horas e o que foi encaminhado. Depois, finalize o atendimento alterando o status para Resolvido.',
        visualType: 'reagendamento',
        highlights: ['Registrar novo horário', 'Registrar regra aplicada', 'Status: Resolvido'],
        callout: 'Histórico completo garante rastreabilidade para Confirmação e Suporte.',
        durationSec: 11,
      },
    ],
  },

  confirmacao: {
    key: 'confirmacao',
    title: 'Videoaula · Confirmação (4.1 a 4.4)',
    subtitle: 'Localização sem filtro padrão em Consultas, lembretes do dia e confirmação ativa 4.4.',
    totalLabel: '5 cenas · ~64s',
    scenes: [
      {
        id: 'c1',
        title: '01. Localizar consultas pendentes no sistema',
        screenLabel: 'Consultas · Todas as consultas',
        narration:
          'No sistema de Consultas, acesse Todas as consultas e remova a tag Status: Confirmadas clicando no X. Filtre o dia e o horário desejados e ajuste para 50 linhas por página.',
        visualType: 'confirmacao',
        highlights: ['Remover tag Confirmadas', 'Filtrar data e horário', 'Exibir 50 linhas'],
        callout: 'Manter a tag Confirmadas oculta justamente os pacientes que ainda não confirmaram!',
        durationSec: 13,
      },
      {
        id: 'c2',
        title: '02. Acessar o chat pela consulta e enviar /importante',
        screenLabel: 'Menu ⋮ · Acessar chat · /importante',
        narration:
          'Nos três pontinhos da linha da consulta, clique em Acessar chat. O paciente já recebeu o template automático de agendamento; reforce com o atalho /importante.',
        visualType: 'confirmacao',
        highlights: ['Menu ⋮ → Acessar chat', 'Conferir template enviado', 'Enviar /importante'],
        callout: 'Confirme também se a anamnese está preenchida antes do horário da consulta.',
        durationSec: 12,
      },
      {
        id: 'c3',
        title: '03. Acompanhar lembretes 4.1, 4.2 e 4.3',
        screenLabel: 'Linha do tempo · Véspera → 07:00 → 2h → 10 min',
        narration:
          'A jornada segue 4 marcos: na véspera vai o lembrete de confirmação; às 07:00 sai a mensagem do dia; 2 horas antes vão as instruções de câmera e microfone; e 10 minutos antes sai o link da sala.',
        visualType: 'confirmacao',
        highlights: ['4.1 Véspera', '4.2 07:00 e 2h antes', '4.3 Link 10 min antes'],
        callout: 'Assim que o paciente confirmar presença, envie imediatamente /confirmacao.',
        durationSec: 14,
      },
      {
        id: 'c4',
        title: '04. Confirmação ativa (etapa 4.4) quando não há resposta',
        screenLabel: 'Etapa 4.4 · Ligação e Pedido de Contato',
        narration:
          'Se o paciente não respondeu aos lembretes no dia, faça a confirmação ativa ligando para ele. Se não atender, envie pedido de contato no WhatsApp e registre cada tentativa com horário e canal na nota interna.',
        visualType: 'confirmacao',
        highlights: ['Ligar ativamente', 'Enviar pedido de contato', 'Registrar tentativas na nota'],
        callout: 'Registro das tentativas protege a próxima atendente e reduz faltas na agenda médica.',
        durationSec: 14,
      },
      {
        id: 'c5',
        title: '05. Transição automática para Em andamento',
        screenLabel: '10 min antes · Em andamento',
        narration:
          'Dez minutos antes da consulta, o link é disparado e o chat passa para Em andamento, seguindo com o suporte de entrada em sala.',
        visualType: 'confirmacao',
        highlights: ['Link enviado 10 min antes', 'Fluxo Em andamento', 'Paciente pronto para entrar'],
        callout: 'Pacientes bem orientados na confirmação entram no horário sem travar a fila médica.',
        durationSec: 11,
      },
    ],
  },

  andamento: {
    key: 'andamento',
    title: 'Videoaula · Suporte aos pacientes (Em andamento e Aguardando)',
    subtitle: 'Suporte de entrada na sala (/acesso), gestão do CRM e condução de atraso ou falta.',
    totalLabel: '4 cenas · ~52s',
    scenes: [
      {
        id: 's1',
        title: '01. Validar acesso na sala com /acesso',
        screenLabel: 'Em andamento · /acesso',
        narration:
          'Dez minutos antes do horário, o paciente recebe o link. Envie /acesso para saber se ele conseguiu entrar e reforce que precisa liberar câmera e microfone antes de clicar em Entrar na consulta.',
        visualType: 'crm',
        highlights: ['Enviar /acesso', 'Permitir câmera e microfone', 'Acompanhar entrada'],
        callout: 'Grande parte das faltas aparentes é apenas bloqueio de permissão de câmera no celular.',
        durationSec: 13,
      },
      {
        id: 's2',
        title: '02. Atualizar o card no CRM para Aguardando',
        screenLabel: 'CRM · Em andamento → Aguardando',
        narration:
          'Se o paciente já entrou, envie /aguarde e abra o CRM pelo ícone à direita do chat. No card em Em andamento, abra o Chat do paciente, registre a nota "Consulta em andamento" e mude o status para Aguardando.',
        visualType: 'crm',
        highlights: ['Enviar /aguarde', 'Abrir CRM', 'Nota: Consulta em andamento'],
        callout: 'Manter o CRM atualizado informa aos médicos e colegas exatamente quem já está em sala.',
        durationSec: 13,
      },
      {
        id: 's3',
        title: '03. Médico atrasou? Use /aguarde2 na coluna Aguardando',
        screenLabel: 'CRM · Coluna Aguardando · /aguarde2',
        narration:
          'Quando o paciente está na sala esperando e o médico ainda está finalizando a consulta anterior, envie /aguarde2 pelo Chat do paciente no CRM e alinhe a previsão no Suporte aos médicos.',
        visualType: 'crm',
        highlights: ['Coluna Aguardando', 'Enviar /aguarde2', 'Alinhar com médico'],
        callout: 'Comunicação rápida tranquiliza o paciente e evita desistência na sala.',
        durationSec: 12,
      },
      {
        id: 's4',
        title: '04. Paciente não entrou: /faltou e nota de falta',
        screenLabel: 'CRM · Coluna Faltou · /faltou',
        narration:
          'Se o paciente não entrou após a tolerância de 5 minutos e não respondeu ao suporte, adicione a nota de falta indicando se é com ou sem custo e envie o comando /faltou.',
        visualType: 'crm',
        highlights: ['Tolerância de 5 minutos', 'Nota de falta (custo/sem custo)', 'Enviar /faltou'],
        callout: 'Caso o paciente volte pedindo novo horário depois da falta, aplique o /devido.',
        durationSec: 13,
      },
    ],
  },

  medicos: {
    key: 'medicos',
    title: 'Videoaula · Suporte aos médicos',
    subtitle: 'Atendimento ágil ao corpo clínico cruzando CRM, chat do paciente e alinhamento de agenda.',
    totalLabel: '4 cenas · ~48s',
    scenes: [
      {
        id: 'm1',
        title: '01. Abrir a solicitação do médico com prioridade',
        screenLabel: 'ClickChat · Suporte aos médicos',
        narration:
          'No departamento Suporte aos médicos, o atendimento precisa de resposta ágil porque há uma agenda clínica rodando em tempo real. Leia a mensagem do profissional e identifique qual paciente ele citou.',
        visualType: 'medicos',
        highlights: ['Departamento: Suporte aos médicos', 'Identificar médico e paciente', 'Prioridade de agenda'],
        callout: 'Nunca responda ao médico no achismo antes de checar o CRM e o chat do paciente.',
        durationSec: 12,
      },
      {
        id: 'm2',
        title: '02. Cruzar status no CRM e no Chat do paciente',
        screenLabel: 'CRM + Chat do paciente',
        narration:
          'Antes de confirmar uma ausência ao médico, verifique o card no CRM e abra o chat do paciente. Se o paciente estiver com erro de áudio ou vídeo, acione /acesso imediatamente e avise o médico para aguardar.',
        visualType: 'medicos',
        highlights: ['Checar coluna no CRM', 'Olhar chat do paciente', 'Evitar falsa falta'],
        callout: 'Cruzar os dois lados salva consultas que seriam encerradas por falha técnica simples.',
        durationSec: 13,
      },
      {
        id: 'm3',
        title: '03. Alinhar atrasos, encaixes e próximos passos',
        screenLabel: 'Suporte aos médicos · Retorno objetivo',
        narration:
          'Se o médico informar atraso na consulta anterior, atualize o paciente na sala com /aguarde2. Combine claramente com o médico se ele segue aguardando ou se a consulta será marcada como falta.',
        visualType: 'medicos',
        highlights: ['Atraso médico → /aguarde2', 'Confirmar próximo passo', 'Comunicação objetiva'],
        callout: 'Comunicação clara entre suporte e médico mantém a agenda fluida durante todo o turno.',
        durationSec: 12,
      },
      {
        id: 'm4',
        title: '04. Registrar nota interna e encerrar',
        screenLabel: 'Notas Internas · Resolvido',
        narration:
          'Registre na nota interna do médico e do paciente tudo o que foi alinhado e altere o atendimento para Resolvido quando a pendência estiver concluída.',
        visualType: 'medicos',
        highlights: ['Nota no chat médico e paciente', 'Desfecho documentado', 'Status: Resolvido'],
        callout: 'Se houver pedido de receita ou laudo pendente, registre também no Kanban de Solicitações.',
        durationSec: 11,
      },
    ],
  },

  solicitacoes: {
    key: 'solicitacoes',
    title: 'Videoaula · Solicitações (Kanban 5 colunas)',
    subtitle: 'Priorização por risco de SLA, proibição de posologia sem médico e entrega validada.',
    totalLabel: '4 cenas · ~52s',
    scenes: [
      {
        id: 'k1',
        title: '01. Priorizar a fila por risco de SLA',
        screenLabel: 'Kanban · Em atraso → Intervenção → Pendente',
        narration:
          'Na abertura do turno em Solicitações, ataque primeiro a coluna Em atraso, principalmente cards urgentes, e a coluna Intervenção, onde o paciente já espera nossa entrega. Só depois escoe os Pendentes novos.',
        visualType: 'kanban',
        highlights: ['1º Em atraso (urgentes)', '2º Intervenção', '3º Pendente'],
        callout: 'Limpar cards novos ignorando atrasos antigos gera perda grave de SLA.',
        durationSec: 13,
      },
      {
        id: 'k2',
        title: '02. Abrir solicitação correta ao médico',
        screenLabel: 'Solicitações · Motivo e Anexos',
        narration:
          'Sempre que o paciente pedir tradução de receita, dúvida de posologia, renovação, alteração de receita ou laudo médico, abra uma solicitação vinculada ao médico responsável com anexo e observação clara.',
        visualType: 'kanban',
        highlights: ['Traduzir receita', 'Posologia e orientações', 'Laudo ou documento'],
        callout: 'Jamais oriente gotas, dose ou ajuste terapêutico por conta própria, mesmo sendo veterana.',
        durationSec: 13,
      },
      {
        id: 'k3',
        title: '03. Validar clareza antes de enviar ao paciente',
        screenLabel: 'Intervenção · Conferência de Receita',
        narration:
          'Quando o médico responder na coluna Intervenção, revise se o documento e a posologia estão 100% legíveis. Se continuar confuso, devolva ao médico pedindo esclarecimento antes de encaminhar ao paciente.',
        visualType: 'kanban',
        highlights: ['Conferir legibilidade', 'Não estimar posologia', 'Validar anexo correto'],
        callout: 'Enviar receita errada ou posologia ambígua coloca o paciente em risco clínico.',
        durationSec: 13,
      },
      {
        id: 'k4',
        title: '04. Entregar no chat e concluir o card',
        screenLabel: 'Kanban · Concluído',
        narration:
          'Envie o retorno completo e os anexos conferidos no chat do paciente, registre a entrega nas notas internas e só então mova o card para Concluído.',
        visualType: 'kanban',
        highlights: ['Entrega confirmada no chat', 'Nota interna registrada', 'Coluna: Concluído'],
        callout: 'Card só vai para Concluído depois que o paciente recebeu tudo corretamente.',
        durationSec: 12,
      },
    ],
  },
};
