import React, { useState } from 'react';
import { Bot, MessageCircle, Send, Trash2, X } from 'lucide-react';
import { DEFAULT_LEADERSHIP, EQUIPE } from '../data/defaults';
import type {
  MentorshipChatMsg,
  MentorshipComment,
  PortalConfig,
} from '../types';
import { fmtTs, initials } from '../utils/helpers';
import { StatusBadge, type BadgeTone } from './StatusBadge';

interface MentorshipViewProps {
  cfg: PortalConfig;
  isAdmin: boolean;
  traineeName: string;
  teamSubsectors?: Record<string, string>;
  onChangeMemberSubsector?: (memberName: string, nextSubsector: string) => void;
  commentsByPerson: Record<string, MentorshipComment[]>;
  onAddComment: (personKey: string, comment: MentorshipComment) => void;
  onDeleteComment: (personKey: string, commentId: string) => void;
  chatsByPerson: Record<string, MentorshipChatMsg[]>;
  onSendChatMsg: (personKey: string, msg: MentorshipChatMsg) => void;
  onOpenQuickSim?: (deptKey?: string) => void;
  onToast: (msg: string) => void;
}

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

const COMMENT_TONES: Record<MentorshipComment['tipo'], BadgeTone> = {
  Comentário: 'neutral',
  'Ponto de melhoria': 'warn',
  Elogio: 'ok',
  Sugestão: 'info',
};

export function MentorshipView({
  cfg,
  isAdmin,
  traineeName,
  teamSubsectors = {},
  onChangeMemberSubsector,
  commentsByPerson,
  onAddComment,
  onDeleteComment,
  chatsByPerson,
  onSendChatMsg,
  onOpenQuickSim,
  onToast,
}: MentorshipViewProps) {
  const [selectedName, setSelectedName] = useState<string>(EQUIPE[0].nome);
  const [tipo, setTipo] = useState<MentorshipComment['tipo']>('Comentário');
  const [texto, setTexto] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');

  const resolvedMembers = EQUIPE.map((m) => ({
    ...m,
    subsetor: teamSubsectors[m.nome] || m.subsetor,
  }));

  const bySub = resolvedMembers.reduce<Record<string, typeof resolvedMembers>>((acc, m) => {
    (acc[m.subsetor] = acc[m.subsetor] || []).push(m);
    return acc;
  }, {});

  const myKey = traineeName.trim() || 'Trainee';
  const activeMember = resolvedMembers.find((m) => m.nome === selectedName) || resolvedMembers[0];
  const matchedTraineeMember = resolvedMembers.find(
    (m) => m.nome.toLowerCase() === myKey.toLowerCase() || m.apelido.toLowerCase() === myKey.toLowerCase()
  );
  const activeKey = isAdmin ? activeMember.nome : myKey;
  const displayName = isAdmin ? activeMember.nome : myKey;
  const displaySub = isAdmin
    ? activeMember.subsetor
    : matchedTraineeMember?.subsetor || 'Programa Trainee (3 Dias)';

  const comments = commentsByPerson[activeKey] || [];
  const chatMsgs = chatsByPerson[activeKey] || [];

  const handlePostComment = () => {
    if (!texto.trim()) return;
    onAddComment(activeKey, {
      id: `mc_${Date.now()}`,
      tipo,
      texto: texto.trim(),
      autor: cfg.madrinha.nome || 'Madrinha',
      ts: Date.now(),
    });
    setTexto('');
    onToast(`Comentário registrado para ${displayName}.`);
  };

  const handleSendChat = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    onSendChatMsg(activeKey, {
      id: `mchat_${Date.now()}`,
      de: isAdmin ? 'madrinha' : 'trainee',
      texto: chatInput.trim(),
      ts: Date.now(),
    });
    setChatInput('');
  };

  const handleSubsectorUpdate = (memberName: string, nextSub: string) => {
    onChangeMemberSubsector?.(memberName, nextSub);
    onToast(`Subsetor de ${memberName} alterado para "${nextSub}".`);
  };

  return (
    <div className="max-w-[1380px] mx-auto space-y-5">
      <div>
        <p className="text-xs text-[var(--muted)]">Desenvolvimento & Treinamento</p>
        <h1 className="text-2xl font-bold mt-0.5">Portal de Apadrinhamento</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          {isAdmin
            ? 'Cada colaboradora tem seu espaço individual de feedbacks e você pode trocar os subsetores diretamente na lista.'
            : 'Este é o seu espaço individual com a treinadora de integração.'}
        </p>
      </div>

      <div className="rounded-xl bg-[var(--info-soft)] text-[var(--info)] px-4 py-3 text-xs space-y-1">
        <p>{cfg.madrinha.aviso}</p>
        <p className="font-semibold">
          Treinadora: {(cfg.lideranca || DEFAULT_LEADERSHIP).treinadora || cfg.madrinha.nome} ·
          Coordenadora: {(cfg.lideranca || DEFAULT_LEADERSHIP).coordenadora} · Liderança:{' '}
          {(cfg.lideranca || DEFAULT_LEADERSHIP).lideranca} · Liderança em treinamento:{' '}
          {(cfg.lideranca || DEFAULT_LEADERSHIP).liderancaTreinamento}
        </p>
      </div>

      <div className="grid gap-4 items-start grid-cols-1 md:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 max-h-[700px] overflow-y-auto space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold">Colaboradoras</h2>
            <span className="text-[10px] font-semibold text-[var(--muted)]">
              {resolvedMembers.length} pessoas
            </span>
          </div>
          {Object.entries(bySub).map(([sub, members]) => (
            <div key={sub} className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] px-1">
                {sub}
              </p>
              {members.map((m) => {
                const count = (commentsByPerson[m.nome] || []).length;
                const isSel = selectedName === m.nome;
                return (
                  <div
                    key={m.nome}
                    className={`rounded-xl border p-2 transition-colors space-y-1.5 ${
                      isSel
                        ? 'bg-[var(--accent-soft)] border-[var(--accent)]'
                        : 'border-transparent hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedName(m.nome)}
                      className="w-full flex items-center gap-2.5 text-left"
                    >
                      <span className="h-7 w-7 rounded-full bg-[var(--sunk)] text-[var(--accent)] font-bold text-[10px] grid place-items-center shrink-0">
                        {initials(m.apelido)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="text-xs block truncate">{m.apelido}</strong>
                        <span className="text-[11px] text-[var(--muted)] tabular-nums">
                          {count} registro(s)
                        </span>
                      </span>
                    </button>
                    {onChangeMemberSubsector && (
                      <select
                        value={m.subsetor}
                        onChange={(e) => handleSubsectorUpdate(m.nome, e.target.value)}
                        aria-label={`Alterar subsetor de ${m.apelido}`}
                        className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11px] font-medium focus:outline-none focus:border-[var(--accent)]"
                      >
                        {Array.from(new Set([...SUBSECTOR_OPTIONS, m.subsetor])).map((opt) => (
                          <option key={opt} value={opt}>
                            Subsetor: {opt}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </aside>

        <div className="space-y-4">
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 flex flex-wrap items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-[var(--accent)] text-[var(--accent-ink)] font-bold text-lg grid place-items-center shrink-0">
              {initials(displayName)}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-lg font-bold truncate">{displayName}</h2>
              <p className="text-xs text-[var(--muted)]">
                {displaySub} · Treinadora:{' '}
                <strong className="text-[var(--ink)]">{cfg.madrinha.nome}</strong>
              </p>
              {onChangeMemberSubsector && (isAdmin || matchedTraineeMember) && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-semibold text-[var(--muted)]">
                    Subsetor atual:
                  </span>
                  <select
                    value={isAdmin ? activeMember.subsetor : matchedTraineeMember!.subsetor}
                    onChange={(e) =>
                      handleSubsectorUpdate(
                        isAdmin ? activeMember.nome : matchedTraineeMember!.nome,
                        e.target.value
                      )
                    }
                    className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-[var(--accent)]"
                  >
                    {SUBSECTOR_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onOpenQuickSim && (
                <button
                  type="button"
                  onClick={() => onOpenQuickSim('geral')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2 text-xs font-semibold hover:border-[var(--accent)] whitespace-nowrap"
                >
                  <Bot className="h-3.5 w-3.5 text-[var(--accent)]" />
                  Simular caso
                </button>
              )}
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2 text-xs font-semibold whitespace-nowrap"
              >
                <MessageCircle className="h-4 w-4" />
                {isAdmin
                  ? `Conversar com ${activeMember?.apelido}`
                  : `Falar com a treinadora (${cfg.madrinha.nome})`}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold">Comentários da treinadora</h2>
              <p className="text-xs text-[var(--muted)]">
                Pontos de melhoria, elogios e sugestões.
              </p>
            </div>

            {isAdmin && (
              <div className="space-y-2.5 pb-4 border-b border-[var(--line)]">
                <div className="flex flex-wrap gap-2">
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as MentorshipComment['tipo'])}
                    className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs"
                  >
                    <option value="Comentário">Comentário</option>
                    <option value="Ponto de melhoria">Ponto de melhoria</option>
                    <option value="Elogio">Elogio</option>
                    <option value="Sugestão">Sugestão</option>
                  </select>
                </div>
                <textarea
                  rows={3}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={`Escreva um feedback para ${displayName}`}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm"
                />
                <button
                  type="button"
                  onClick={handlePostComment}
                  className="rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-2 text-xs font-semibold"
                >
                  Registrar comentário
                </button>
              </div>
            )}

            <div className="space-y-2.5">
              {comments.length ? (
                comments.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge tone={COMMENT_TONES[c.tipo]}>{c.tipo}</StatusBadge>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => onDeleteComment(activeKey, c.id)}
                          aria-label="Remover comentário"
                          className="text-[var(--danger)] hover:opacity-75"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.texto}</p>
                    <p className="text-[11px] text-[var(--muted)] font-mono-num">
                      {c.autor} · {fmtTs(c.ts)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--line)] p-6 text-center text-xs text-[var(--muted)]">
                  Nenhum comentário da treinadora ainda.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {chatOpen && (
        <div
          className="fixed inset-0 z-40 bg-[rgba(6,20,12,0.45)] flex justify-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setChatOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Chat com a madrinha"
        >
          <aside className="bg-[var(--surface)] w-full max-w-[460px] h-full flex flex-col shadow-2xl border-l border-[var(--line)]">
            <div className="p-4 border-b border-[var(--line)] flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[var(--accent)] text-[var(--accent-ink)] font-bold text-xs grid place-items-center shrink-0">
                {initials(isAdmin ? displayName : cfg.madrinha.nome)}
              </div>
              <div className="min-w-0 flex-1">
                <strong className="text-sm block truncate">
                  {isAdmin ? displayName : cfg.madrinha.nome}
                </strong>
                <span className="text-xs text-[var(--muted)] block">
                  Chat privado · Dúvidas do treinamento
                </span>
              </div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                aria-label="Fechar"
                className="h-8 w-8 rounded-lg border border-[var(--line)] grid place-items-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[var(--surface-2)]">
              {chatMsgs.length ? (
                chatMsgs.map((m) => {
                  const mine = isAdmin ? m.de === 'madrinha' : m.de === 'trainee';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col max-w-[80%] ${
                        mine ? 'ml-auto items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`rounded-xl px-3 py-2 text-xs whitespace-pre-wrap ${
                          mine
                            ? 'bg-[var(--bubble-out)] rounded-tr-sm'
                            : 'bg-[var(--bubble-in)] border border-[var(--line)] rounded-tl-sm'
                        }`}
                      >
                        {m.texto}
                      </div>
                      <span className="text-[10px] text-[var(--muted)] font-mono-num mt-0.5">
                        {fmtTs(m.ts)}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-[var(--muted)] text-center py-6">
                  Nenhuma mensagem ainda. Escreva sua primeira dúvida.
                </p>
              )}
            </div>

            <form
              onSubmit={handleSendChat}
              className="p-3 border-t border-[var(--line)] flex gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Escreva sua mensagem..."
                className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                type="submit"
                aria-label="Enviar"
                className="h-9 w-9 rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] grid place-items-center"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}
