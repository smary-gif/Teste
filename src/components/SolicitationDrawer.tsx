import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Paperclip, X } from 'lucide-react';
import { MEDS, SOL_TIPOS } from '../data/defaults';
import type { PatientCase, SolAttachment } from '../types';
import { sanitizeRichHtml, stripHtmlCount } from '../utils/helpers';

export interface SolFormState {
  mode: 'new' | 'edit';
  pid: string;
  motivo: string;
  medico: string;
  urg: boolean;
  receita: string;
  obs: string;
  anexos: SolAttachment[];
}

interface SolicitationDrawerProps {
  initialForm: SolFormState;
  patients: PatientCase[];
  onClose: () => void;
  onSave: (form: SolFormState) => void;
  onToast: (msg: string) => void;
}

export function SolicitationDrawer({
  initialForm,
  patients,
  onClose,
  onSave,
  onToast,
}: SolicitationDrawerProps) {
  const [form, setForm] = useState<SolFormState>(initialForm);
  const [tab, setTab] = useState<'det' | 'anx'>('det');
  const obsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (obsRef.current && tab === 'det') {
      obsRef.current.innerHTML = form.obs || '';
    }
  }, [tab]);

  const isEdit = form.mode === 'edit';
  const editedPatient = isEdit ? patients.find((p) => p.id === form.pid) : undefined;
  const eligiblePatients = isEdit
    ? editedPatient
      ? [editedPatient]
      : []
    : form.medico
      ? patients.filter((p) => !p.isMed && !p.sol && p.medico === form.medico)
      : [];

  const currentPatient = form.pid ? patients.find((p) => p.id === form.pid) : undefined;

  const receitasList = currentPatient
    ? [0, 1].map(
        (j) =>
          `Receita #REC-${3100 + currentPatient.k * 2 + j} · ${String(
            ((currentPatient.k + j * 5) % 27) + 1
          ).padStart(2, '0')}/10/2026 · Produto prescrito (item fictício)`
      )
    : [];

  const obsChars = stripHtmlCount(form.obs);
  const missingField = !form.motivo
    ? 'motivo da solicitação'
    : !form.medico
      ? 'médico'
      : !form.pid
        ? 'paciente'
        : obsChars === 0
          ? 'observações'
          : obsChars > 4000
            ? 'observações (máximo de 4000 caracteres)'
            : '';

  const handleFormat = (cmd: string) => {
    if (!obsRef.current) return;
    obsRef.current.focus();
    document.execCommand(cmd);
    setForm((f) => ({ ...f, obs: sanitizeRichHtml(obsRef.current?.innerHTML || '') }));
  };

  const handleFileAttach = (kind: 'Receita' | 'Documento', file: File | undefined) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      onToast('Arquivo acima de 20 MB.');
      return;
    }
    setForm((f) => ({
      ...f,
      anexos: [
        ...f.anexos,
        { kind, nome: file.name, kb: Math.max(1, Math.round(file.size / 1024)) },
      ],
    }));
    onToast(`${kind} anexado: ${file.name}`);
  };

  const handleSubmit = () => {
    const cleanObs = obsRef.current ? sanitizeRichHtml(obsRef.current.innerHTML) : form.obs;
    const finalForm = { ...form, obs: cleanObs };
    const count = stripHtmlCount(cleanObs);
    if (!finalForm.motivo || !finalForm.medico || !finalForm.pid || count === 0 || count > 4000) {
      onToast(`Preencha: ${missingField || 'observações'}.`);
      return;
    }
    onSave(finalForm);
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-[rgba(6,20,12,0.45)] flex justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Editar solicitação' : 'Nova solicitação'}
    >
      <aside className="bg-[var(--surface)] w-full max-w-[520px] h-full flex flex-col shadow-2xl border-l border-[var(--line)]">
        <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">
              {isEdit && currentPatient
                ? `Solicitação de ${currentPatient.nome}`
                : 'Nova solicitação'}
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Revise as informações da sua solicitação.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="h-9 w-9 rounded-lg border border-[var(--line)] grid place-items-center hover:border-[var(--accent)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="inline-flex bg-[var(--surface-2)] p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setTab('det')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${
                tab === 'det'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--muted)]'
              }`}
            >
              Detalhes
            </button>
            <button
              type="button"
              onClick={() => setTab('anx')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${
                tab === 'anx'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--muted)]'
              }`}
            >
              Anexos{form.anexos.length ? ` (${form.anexos.length})` : ''}
            </button>
          </div>

          {tab === 'det' ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-bold">Dados da solicitação</p>
                <p className="text-xs text-[var(--muted)]">
                  {isEdit
                    ? 'Altere os dados abaixo e salve.'
                    : 'Informe os dados para realizar uma nova solicitação.'}
                </p>
              </div>

              <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                <span>
                  Motivo da solicitação <span className="text-[var(--danger)]">*</span>
                </span>
                <select
                  value={form.motivo}
                  onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] font-normal"
                >
                  <option value="">Selecione o motivo da solicitação</option>
                  {SOL_TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                <span>
                  Médico <span className="text-[var(--danger)]">*</span>
                </span>
                <select
                  value={form.medico}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      medico: e.target.value,
                      pid: isEdit ? f.pid : '',
                      receita: isEdit ? f.receita : '',
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] font-normal"
                >
                  <option value="">Selecione um médico</option>
                  {MEDS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
                <span>
                  Paciente <span className="text-[var(--danger)]">*</span>
                </span>
                <select
                  value={form.pid}
                  disabled={isEdit || !form.medico}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, pid: e.target.value, receita: '' }))
                  }
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] font-normal disabled:opacity-60"
                >
                  <option value="">
                    {form.medico
                      ? eligiblePatients.length
                        ? 'Selecione o paciente'
                        : 'Nenhum paciente disponível para este médico'
                      : 'Selecione um médico primeiro'}
                  </option>
                  {eligiblePatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </label>

              <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between gap-3">
                <div>
                  <strong className="text-xs block">Incluir tag de urgência</strong>
                  <span className="text-[11px] text-[var(--muted)]">
                    Ao incluir, sua solicitação será priorizada
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.urg}
                    onChange={(e) => setForm((f) => ({ ...f, urg: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[var(--line)] rounded-full peer peer-checked:bg-[var(--accent)] after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:after:translate-x-5" />
                </label>
              </div>

              <div className="pt-3 border-t border-[var(--line)] space-y-2">
                <strong className="text-xs block">Receita</strong>
                <p className="text-[11px] text-[var(--muted)]">
                  Selecione uma receita caso necessite de alteração. Para enviar uma nova receita,
                  use a aba Anexos.
                </p>
                <select
                  value={form.receita}
                  disabled={!currentPatient}
                  onChange={(e) => setForm((f) => ({ ...f, receita: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm disabled:opacity-60"
                >
                  <option value="">
                    {currentPatient ? 'Selecione uma receita' : 'Selecione um paciente primeiro'}
                  </option>
                  {receitasList.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setTab('anx')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
                >
                  Anexar arquivo externo
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="pt-3 border-t border-[var(--line)] space-y-1.5">
                <strong className="text-xs block">
                  Observações <span className="text-[var(--danger)]">*</span>
                </strong>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] focus-within:border-[var(--accent)]">
                  <div
                    ref={obsRef}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-multiline="true"
                    aria-label="Observações"
                    onInput={() =>
                      setForm((f) => ({
                        ...f,
                        obs: sanitizeRichHtml(obsRef.current?.innerHTML || ''),
                      }))
                    }
                    className="min-h-[120px] p-2.5 text-sm outline-none break-words"
                  />
                  <div className="flex gap-1 p-1.5 border-t border-[var(--line)]">
                    {[
                      ['bold', 'B'],
                      ['italic', 'I'],
                      ['underline', 'U'],
                      ['insertUnorderedList', '•'],
                      ['insertOrderedList', '1.'],
                    ].map(([cmd, label]) => (
                      <button
                        key={cmd}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleFormat(cmd)}
                        className="h-7 w-7 rounded-md border border-[var(--line)] text-xs font-semibold hover:border-[var(--accent)]"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  className={`text-right text-[11px] font-mono-num ${
                    obsChars === 0 || obsChars > 4000
                      ? 'text-[var(--danger)]'
                      : 'text-[var(--muted)]'
                  }`}
                >
                  {obsChars}/4000
                </div>
              </div>

              {isEdit && editedPatient?.sol && (
                <div className="pt-3 border-t border-[var(--line)] space-y-1.5">
                  <strong className="text-xs block">Histórico</strong>
                  <ol className="list-decimal pl-5 text-xs text-[var(--muted)] space-y-1">
                    {editedPatient.sol.h.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-bold">Anexos</p>
                <p className="text-xs text-[var(--muted)]">
                  Anexe a receita e os documentos da solicitação (até 20 MB cada).
                </p>
              </div>

              <div className="pt-3 border-t border-[var(--line)] space-y-2">
                <strong className="text-xs block">Receita</strong>
                <p className="text-[11px] text-[var(--muted)]">
                  Envie uma nova receita caso a atual precise ser substituída.
                </p>
                <label className="relative inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-semibold cursor-pointer hover:border-[var(--accent)]">
                  <Paperclip className="h-3.5 w-3.5" />
                  Anexar receita
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => handleFileAttach('Receita', e.target.files?.[0])}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
              </div>

              <div className="pt-3 border-t border-[var(--line)] space-y-2">
                <strong className="text-xs block">Documentos</strong>
                <p className="text-[11px] text-[var(--muted)]">
                  Laudos, exames ou outros documentos de apoio.
                </p>
                <label className="relative inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-semibold cursor-pointer hover:border-[var(--accent)]">
                  <Paperclip className="h-3.5 w-3.5" />
                  Anexar documento
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt"
                    onChange={(e) => handleFileAttach('Documento', e.target.files?.[0])}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
              </div>

              <div className="pt-3 border-t border-[var(--line)] space-y-2">
                <strong className="text-xs block">
                  Arquivos anexados ({form.anexos.length})
                </strong>
                {form.anexos.length ? (
                  <div className="space-y-1.5">
                    {form.anexos.map((a, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-xs"
                      >
                        <Paperclip className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1 truncate">
                          {a.nome} · {a.kb} KB
                        </span>
                        <span className="text-[11px] text-[var(--muted)]">{a.kind}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              anexos: f.anexos.filter((_, idx) => idx !== i),
                            }))
                          }
                          aria-label={`Remover ${a.nome}`}
                          className="h-6 w-6 rounded-md grid place-items-center hover:bg-[var(--surface-2)]"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted)]">Nenhum anexo adicionado.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[var(--line)] flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--line)] py-2.5 text-xs font-semibold hover:border-[var(--accent)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            id="sol-save"
            onClick={handleSubmit}
            className={`flex-1 rounded-xl py-2.5 text-xs font-semibold text-white ${
              missingField ? 'bg-[#7b827e]' : 'bg-[var(--accent)]'
            }`}
          >
            {isEdit ? 'Salvar alterações' : 'Criar solicitação'}
          </button>
        </div>
      </aside>
    </div>
  );
}
