import React, { useState, useEffect } from 'react';
import { FileCode, Plus } from 'lucide-react';
import type { PromptVersion, Project } from '../../types';
import { api } from '../../services/api';

interface PromptsViewProps {
  project: Project | null;
}

export const PromptsView: React.FC<PromptsViewProps> = ({ project }) => {
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);

  // New Prompt Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful, accurate, and concise AI assistant. Answer facts directly.');
  const [userTemplate, setUserTemplate] = useState('{question}\nContext: {context}');
  const [submitting, setSubmitting] = useState(false);

  const loadPrompts = async () => {
    if (!project) return;
    try {
      setLoading(true);
      const data = await api.getPromptVersions(project.id);
      setPrompts(data);
    } catch (err: any) {
      console.error('Failed to load prompts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrompts();
  }, [project?.id]);

  const handleCreatePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !name.trim()) return;

    try {
      setSubmitting(true);
      await api.createPromptVersion(project.id, {
        name: name.trim(),
        system_prompt: systemPrompt,
        user_template: userTemplate,
      });
      setShowAddModal(false);
      setName('');
      await loadPrompts();
    } catch (err: any) {
      alert(`Failed to save prompt: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileCode className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Prompt Templates & Versions</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage system instructions and user formatting templates with variable substitution (<code>{'{question}'}</code>, <code>{'{context}'}</code>).
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all self-start"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Prompt Version</span>
        </button>
      </div>

      {/* Prompts list */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400">Loading prompt versions...</div>
      ) : prompts.length === 0 ? (
        <div className="p-8 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">No prompt templates found. Click "New Prompt Version" to create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {prompts.map((p) => (
            <div
              key={p.id}
              className="p-5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{p.name}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                  Version {p.version}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider block mb-1">
                    System Prompt:
                  </span>
                  <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-800 dark:text-slate-300">
                    {p.system_prompt}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider block mb-1">
                    User Template:
                  </span>
                  <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-indigo-600 dark:text-indigo-300 font-medium">
                    {p.user_template}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 flex justify-between">
                <span>Created {new Date(p.created_at).toLocaleDateString()}</span>
                <span className="text-slate-400 dark:text-slate-500 font-mono">ID: {p.id.slice(0, 8)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Prompt Version Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create Prompt Version</h3>

            <form onSubmit={handleCreatePrompt} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Prompt Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard Production Prompt"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">System Prompt</label>
                <textarea
                  rows={3}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">User Template</label>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">Variables: {'{question}'}, {'{context}'}</span>
                </div>
                <textarea
                  rows={4}
                  value={userTemplate}
                  onChange={(e) => setUserTemplate(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Prompt Version'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
