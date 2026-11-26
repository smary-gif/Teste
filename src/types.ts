export type AppView =
  | 'trainee'
  | 'simulacao'
  | 'subsetores'
  | 'solicitacoes'
  | 'consultas'
  | 'crm'
  | 'trilha'
  | 'treinamento'
  | 'apadrinhamento'
  | 'administracao';

export type AtendStatus =
  | 'Aberto Pelo Clico'
  | 'Indefinido'
  | 'Resolvido'
  | 'Aberto'
  | 'Fechado'
  | 'Aguardando'
  | 'Em Atendimento';

export type AtendTabKey = 'abertos' | 'aguardando' | 'finalizados';
export type CrmStatus = 'Aguardando' | 'Em andamento' | 'Faltou';
export type SolStatus = 'pendente' | 'intervencao' | 'medico' | 'atraso' | 'concluido';
export type ConfirmPhase = 'agendado' | 'confirmacao' | 'pre' | 'acesso';

export interface GuideStep {
  titulo: string;
  quando: string;
  texto: string;
  detalhe: string;
}

export interface ShortcutItem {
  cmd: string;
  texto: string;
}

export interface SubsectorGuide {
  tour: string;
  nome: string;
  desc: string;
  passos: string;
}

export interface CareerLevel {
  nome: string;
  desc: string;
}

export interface PortalConfig {
  portalNome: string;
  portalSub: string;
  madrinha: {
    nome: string;
    cargo: string;
    aviso: string;
  };
  promocao: string;
  filtroDepartamentos: string[];
  encaminharDepartamentos: string[];
  guia: GuideStep[];
  atalhos: ShortcutItem[];
  templates: {
    agendamento: string;
    lembrete7h: string;
    lembrete2h: string;
    acesso: string;
  };
  niveis: CareerLevel[];
  aprimorarPadrao: string[];
  subsetores: SubsectorGuide[];
  pacientesSimulados: number;
  treinoInicio: string;
  treinoOrdem: string[];
}

export interface ChatMessage {
  id: string;
  from: 'sys' | 'api' | 'op' | 'pac' | 'evt';
  text: string;
  label?: string;
  d?: string;
  t: string;
}

export interface InternalNote {
  id: string;
  tipo: string;
  text: string;
  audio?: string | null;
  t: string;
}

export interface PatientScenario {
  id?: string;
  tipo?: string;
  desc: string;
  first?: string;
  replies?: string[];
  entrega?: boolean;
  silent?: number;
  crm?: CrmStatus;
}

export interface ConsultationHistoryItem {
  num: string;
  data: string;
  tipo: string;
  medico: string;
  obs: string;
}

export interface DeliveryHistoryItem {
  pedido: string;
  data: string;
  itens: string;
  status: string;
}

export interface SolAttachment {
  kind: 'Receita' | 'Documento';
  nome: string;
  kb: number;
}

export interface SolicitationRecord {
  tipo: string;
  medico: string;
  st: SolStatus;
  urg: boolean;
  receita: string;
  obs: string;
  anexos: SolAttachment[];
  h: string[];
}

export interface PatientCase {
  id: string;
  key: string;
  dept: string;
  k: number;
  first: string;
  nome: string;
  proc: string;
  tel: string;
  medico: string;
  link: string;
  email: string;
  hora: string;
  data: string;
  tipo: string;
  isMed?: boolean;
  status: string;
  crm: CrmStatus | null;
  atend: AtendStatus;
  fase: ConfirmPhase;
  ev: number;
  sc: PatientScenario;
  msgs: ChatMessage[];
  notas: InternalNote[];
  opCount: number;
  typing: boolean;
  unread: boolean;
  hist: {
    consultas: ConsultationHistoryItem[];
    entregas: DeliveryHistoryItem[];
  };
  medMsgs: string[];
  sol?: SolicitationRecord;
  scriptIdx?: Record<string, number>;
}

export interface ConsultationRow {
  id: string;
  pid: string | null;
  nome: string;
  proc: string;
  medico: string;
  dateKey: string;
  dataBr: string;
  hora: string;
  tipo: string;
  status: string;
  anamnese: boolean;
}

export type TraineeStageKey = 'd1' | 'd2' | 'd3' | 'final';

export interface TraineeQuestionRaw {
  q: string;
  o: string[];
  c: number | number[];
  w: string;
}

export interface TraineeQuestionShuffled {
  q: string;
  o: string[];
  c: number[];
  m: boolean;
  w: string;
}

export interface TraineePracticeTask {
  id: string;
  text: string;
  deptKey?: string;
  hint: string;
}

export interface TraineeDayDef {
  k: 'd1' | 'd2' | 'd3';
  nivel: 'Básico' | 'Intermediário' | 'Avançado';
  titulo: string;
  meta: string;
  subs: Array<[string, string[]]>;
  prat: TraineePracticeTask[];
  pool: TraineeQuestionRaw[];
}

export interface TraineeProgressStore {
  prac: Record<string, boolean>;
  best: Partial<Record<TraineeStageKey, number>>;
  tries: Partial<Record<TraineeStageKey, number>>;
  date: Partial<Record<TraineeStageKey, string>>;
  simSignals: Record<string, boolean>;
}

export interface TrilhaStage {
  id: string;
  t: string;
  d: string;
  items: Array<[string, string, string]>;
  quiz: Array<[string, string[], number]>;
}

export interface TeamMember {
  apelido: string;
  nome: string;
  email: string;
  subsetor: string;
}

export interface CronoSubProgress {
  teoria?: boolean;
  tData?: string;
  pratica?: boolean;
  pData?: string;
  nivel?: string;
  obs?: string;
}

export interface CronoRecord {
  nome: string;
  subs: Record<string, CronoSubProgress>;
  obsGeral?: string;
  statusManual?: string;
  at?: number;
  por?: string;
}

export interface MentorshipComment {
  id: string;
  tipo: 'Comentário' | 'Ponto de melhoria' | 'Elogio' | 'Sugestão';
  texto: string;
  autor: string;
  ts: number;
}

export interface MentorshipChatMsg {
  id: string;
  de: 'trainee' | 'madrinha';
  texto: string;
  ts: number;
}

export interface CoachStep {
  sel: string;
  text: string;
  sig?: string;
  check?: (value: string) => boolean;
  view?: AppView;
}
