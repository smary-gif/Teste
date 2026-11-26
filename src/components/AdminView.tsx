import React, { useEffect, useState } from 'react';
import { DEFAULT_CONFIG } from '../data/defaults';
import type { PortalConfig } from '../types';
import { cloneData } from '../utils/helpers';

interface AdminViewProps {
  cfg: PortalConfig;
  onSaveConfig: (next: PortalConfig) => void;
  onToast: (msg: string) => void;
}

export function AdminView({ cfg, onSaveConfig, onToast }: AdminViewProps) {
  const [draft, setDraft] = useState<PortalConfig>(() => cloneData(cfg));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) {
      setDraft(cloneData(cfg));
    }
  }, [cfg, dirty]);

  const updateDraft = (updater: (d: PortalConfig) => PortalConfig) => {
    setDraft((prev) => updater(cloneData(prev)));
    setDirty(true);
  };

  const handleSave = () => {
    const cleaned = cloneData(draft);
    cleaned.pacientesSimulados = Math.max(
      8,
      Math.min(30, Number(cleaned.pacientesSimulados) || 15)
    );
    cleaned.atalhos = cleaned.atalhos.map((a) => ({
      cmd: a.cmd.trim().startsWith('/') ? a.cmd.trim() : `/${a.cmd.trim()}`,
      texto: a.texto,
    }));
    if (!cleaned.filtroDepartamentos.includes('Todos')) {
      cleaned.filtroDepartamentos.unshift('Todos');
    }
    onSaveConfig(cleaned);
    setDirty(false);
    onToast('Configurações salvas e aplicadas ao portal.');
  };

  const handleResetDefaults = () => {
    setDraft(cloneData(DEFAULT_CONFIG));
    setDirty(true);
    onToast('Padrão carregado. Clique em "Salvar alterações" para aplicar.');
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-5 pb-16">
      <div>
        <p className="text-xs text-[var(--muted)]">Somente coordenação / instrutora</p>
        <h1 className="text-2xl font-bold mt-0.5">Administração</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Personalize identidade, departamentos, passo a passo dos subsetores, atalhos de mensagem
          e templates automáticos.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
          <h2 className="text-base font-bold">Identidade do portal</h2>
          <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
            <span>Nome do portal</span>
            <input
              type="text"
              value={draft.portalNome}
              onChange={(e) =>
                updateDraft((d) => ({ ...d, portalNome: e.target.value }))
              }
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] font-normal"
            />
          </label>
          <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
            <span>Subtítulo</span>
            <input
              type="text"
              value={draft.portalSub}
              onChange={(e) =>
                updateDraft((d) => ({ ...d, portalSub: e.target.value }))
              }
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] font-normal"
            />
          </label>
          <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
            <span>Pacientes simulados por departamento (8 a 30)</span>
            <input
              type="number"
              min={8}
              max={30}
              value={draft.pacientesSimulados}
              onChange={(e) =>
                updateDraft((d) => ({
                  ...d,
                  pacientesSimulados: Number(e.target.value),
                }))
              }
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] font-normal"
            />
          </label>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
          <h2 className="text-base font-bold">Instrutora / Madrinha</h2>
          <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
            <span>Nome</span>
            <input
              type="text"
              value={draft.madrinha.nome}
              onChange={(e) =>
                updateDraft((d) => ({
                  ...d,
                  madrinha: { ...d.madrinha, nome: e.target.value },
                }))
              }
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] font-normal"
            />
          </label>
          <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
            <span>Cargo</span>
            <input
              type="text"
              value={draft.madrinha.cargo}
              onChange={(e) =>
                updateDraft((d) => ({
                  ...d,
                  madrinha: { ...d.madrinha, cargo: e.target.value },
                }))
              }
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] font-normal"
            />
          </label>
          <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
            <span>Aviso informativo</span>
            <textarea
              rows={3}
              value={draft.madrinha.aviso}
              onChange={(e) =>
                updateDraft((d) => ({
                  ...d,
                  madrinha: { ...d.madrinha, aviso: e.target.value },
                }))
              }
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] font-normal"
            />
          </label>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
          <h2 className="text-base font-bold">Departamentos</h2>
          <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
            <span>Barra "Selecionar departamento para trabalhar" (1 por linha)</span>
            <textarea
              rows={6}
              value={draft.filtroDepartamentos.join('\n')}
              onChange={(e) =>
                updateDraft((d) => ({
                  ...d,
                  filtroDepartamentos: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)] font-normal"
            />
          </label>
          <label className="block space-y-1 text-xs font-semibold text-[var(--muted)]">
            <span>Lista do botão "Departamento" (encaminhar chat)</span>
            <textarea
              rows={7}
              value={draft.encaminharDepartamentos.join('\n')}
              onChange={(e) =>
                updateDraft((d) => ({
                  ...d,
                  encaminharDepartamentos: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)] font-normal"
            />
          </label>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
          <h2 className="text-base font-bold">Atalhos de mensagem</h2>
          <p className="text-xs text-[var(--muted)]">
            Use {'{$first_name}'} para inserir o primeiro nome do paciente.
          </p>
          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {draft.atalhos.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-2.5 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item.cmd}
                    onChange={(e) =>
                      updateDraft((d) => {
                        d.atalhos[idx].cmd = e.target.value;
                        return d;
                      })
                    }
                    className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-mono-num"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft((d) => {
                        d.atalhos.splice(idx, 1);
                        return d;
                      })
                    }
                    className="text-xs font-semibold text-[var(--danger)] px-2"
                  >
                    Remover
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={item.texto}
                  onChange={(e) =>
                    updateDraft((d) => {
                      d.atalhos[idx].texto = e.target.value;
                      return d;
                    })
                  }
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              updateDraft((d) => {
                d.atalhos.push({ cmd: '/novo', texto: '' });
                return d;
              })
            }
            className="rounded-xl border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--accent)]"
          >
            Adicionar atalho
          </button>
        </section>
      </div>

      <div className="sticky bottom-3 flex justify-end z-20">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-xl px-4 py-2.5 flex flex-wrap items-center gap-3">
          <span className="text-xs text-[var(--muted)]">
            {dirty ? 'Alterações não salvas' : 'Tudo salvo'}
          </span>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="rounded-xl border border-[var(--line)] px-3 py-1.5 text-xs font-semibold"
          >
            Restaurar padrão
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(cloneData(cfg));
              setDirty(false);
            }}
            className="rounded-xl border border-[var(--line)] px-3 py-1.5 text-xs font-semibold"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] px-4 py-1.5 text-xs font-semibold"
          >
            Salvar alterações
          </button>
        </div>
      </div>
    </div>
  );
}
