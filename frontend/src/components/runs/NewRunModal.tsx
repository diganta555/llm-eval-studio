import React, { useState, useEffect } from 'react';
import {
  Zap,
  X,
  Play,
  CheckSquare,
  Square,
  AlertCircle,
  Database,
  Cpu,
  FileCode,
  Sliders,
  Activity
} from 'lucide-react';
import type { Project, Dataset, ModelConfig, PromptVersion } from '../../types';
import { api } from '../../services/api';

interface NewRunModalProps {
  project: Project | null;
  onClose: () => void;
  onRunStarted: (runId: string) => void;
  preselectedDatasetId?: string;
}

const PROVIDER_COLORS: Record<string, { active: string; icon: string }> = {
  openai: {
    active: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-200 shadow-sm',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  anthropic: {
    active: 'bg-orange-50 dark:bg-orange-950/40 border-orange-300 dark:border-orange-700/60 text-orange-900 dark:text-orange-200 shadow-sm',
    icon: 'text-orange-600 dark:text-orange-400',
  },
  mock: {
    active: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 shadow-sm',
    icon: 'text-slate-600 dark:text-slate-400',
  },
};

const INACTIVE_STYLE = 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400';

export const NewRunModal: React.FC<NewRunModalProps> = ({
  project,
  onClose,
  onRunStarted,
  preselectedDatasetId,
}) => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedDatasetId, setSelectedDatasetId] = useState(preselectedDatasetId || '');
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(new Set());
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [maxConcurrency, setMaxConcurrency] = useState(2);
  const [submitting, setSubmitting] = useState(false);

  // Metric checkboxes
  const [metricCorrectness, setMetricCorrectness] = useState(true);
  const [metricRelevance, setMetricRelevance] = useState(true);
  const [metricFaithfulness, setMetricFaithfulness] = useState(true);
  const [metricHallucination, setMetricHallucination] = useState(true);

  useEffect(() => {
    if (!project) return;
    const fetchResources = async () => {
      try {
        setLoading(true);
        const [dList, mList, pList] = await Promise.all([
          api.getDatasets(project.id),
          api.getModelConfigs(project.id),
          api.getPromptVersions(project.id),
        ]);
        setDatasets(dList);
        setModels(mList);
        setPrompts(pList);

        if (dList.length > 0 && !selectedDatasetId) {
          setSelectedDatasetId(preselectedDatasetId || dList[0].id);
        }
        // Pre-select the first model by default
        if (mList.length > 0) {
          setSelectedModelIds(new Set([mList[0].id]));
        }
        if (pList.length > 0) {
          setSelectedPromptId(pList[0].id);
        }
      } catch (err: any) {
        console.error('Error fetching resources for new run:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchResources();
  }, [project?.id, preselectedDatasetId]);

  const toggleModel = (id: string) => {
    setSelectedModelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllModels = () => {
    if (selectedModelIds.size === models.length) {
      setSelectedModelIds(new Set());
    } else {
      setSelectedModelIds(new Set(models.map((m) => m.id)));
    }
  };

  const activeMetrics: string[] = [];
  if (metricCorrectness) activeMetrics.push('correctness');
  if (metricRelevance) activeMetrics.push('relevance');
  if (metricFaithfulness) activeMetrics.push('faithfulness');
  if (metricHallucination) activeMetrics.push('hallucination');

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);
  const selectedModels = models.filter((m) => selectedModelIds.has(m.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !selectedDatasetId || selectedModelIds.size === 0) {
      alert('Please select a dataset and at least one model configuration.');
      return;
    }
    if (activeMetrics.length === 0) {
      alert('Please select at least one evaluation metric.');
      return;
    }

    try {
      setSubmitting(true);
      let lastRunId = '';

      // Launch one evaluation run per selected model
      const modelIdArray = Array.from(selectedModelIds);
      for (const modelId of modelIdArray) {
        const res = await api.startEvaluationRun({
          project_id: project.id,
          dataset_id: selectedDatasetId,
          model_config_id: modelId,
          prompt_version_id: selectedPromptId || undefined,
          metrics: activeMetrics,
          max_concurrency: maxConcurrency,
        });
        lastRunId = res.run_id;
      }

      onRunStarted(lastRunId);
    } catch (err: any) {
      alert(`Failed to start evaluation run: ${err.message}`);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Configure & Launch Evaluation Run</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Snapshot configurations, execute model inference, and trigger LLM judges.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">Loading resources...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-1">
            {/* Step 1: Select Dataset */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>1. Select Benchmark Dataset Version *</span>
              </label>
              {datasets.length === 0 ? (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>No datasets available. Please create or seed a dataset first!</span>
                </div>
              ) : (
                <select
                  value={selectedDatasetId}
                  onChange={(e) => setSelectedDatasetId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} (v{d.version}) — {d.test_case_count} test cases
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Step 2: Select Model Config(s) — Multi-select */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>2. Select Target Model(s) * — pick one or more</span>
                </label>
                <button
                  type="button"
                  onClick={selectAllModels}
                  className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
                >
                  {selectedModelIds.size === models.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              {models.length === 0 ? (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>No model configurations found.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {models.map((m) => {
                    const isSelected = selectedModelIds.has(m.id);
                    const colors = PROVIDER_COLORS[m.provider] || PROVIDER_COLORS.mock;
                    const providerLabel = m.provider.toUpperCase();
                    const hasKey = m.has_api_key !== false;

                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => toggleModel(m.id)}
                        className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all ${
                          isSelected ? colors.active : INACTIVE_STYLE
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className={`w-4 h-4 ${colors.icon} mt-0.5 shrink-0`} />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-200 truncate">{m.name}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono">{m.model_name}</span>
                            <span className="px-1 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/70 text-[9px] font-bold uppercase tracking-wide">
                              {providerLabel}
                            </span>
                            {!hasKey && m.provider !== 'mock' && (
                              <span className="px-1 py-0.5 rounded bg-amber-200/70 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 text-[9px] font-bold">
                                NO KEY
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedModelIds.size > 1 && (
                <div className="mt-1.5 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                  ⚡ {selectedModelIds.size} models selected — one evaluation run will be created per model.
                </div>
              )}
            </div>

            {/* Step 3: Select Prompt Version */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>3. Select Prompt Template Version (Optional)</span>
              </label>
              <select
                value={selectedPromptId}
                onChange={(e) => setSelectedPromptId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Default Production Prompt</option>
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (v{p.version})
                  </option>
                ))}
              </select>
            </div>

            {/* Step 4: Metric Checkboxes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>4. Select Evaluation Dimensions & Rubrics *</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMetricCorrectness(!metricCorrectness)}
                  className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all ${
                    metricCorrectness
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-200 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {metricCorrectness ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-200">Correctness</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Match expected answer</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMetricRelevance(!metricRelevance)}
                  className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all ${
                    metricRelevance
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700/60 text-indigo-900 dark:text-indigo-200 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {metricRelevance ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-200">Relevance</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Addresses question directly</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMetricFaithfulness(!metricFaithfulness)}
                  className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all ${
                    metricFaithfulness
                      ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-300 dark:border-cyan-700/60 text-cyan-900 dark:text-cyan-200 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {metricFaithfulness ? (
                    <CheckSquare className="w-4 h-4 text-cyan-600 dark:text-cyan-400 mt-0.5 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-200">Faithfulness</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Grounded in reference context</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMetricHallucination(!metricHallucination)}
                  className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all ${
                    metricHallucination
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700/60 text-rose-900 dark:text-rose-200 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {metricHallucination ? (
                    <CheckSquare className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-200">Hallucination</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Detect unsupported claims</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Step 5: Concurrency Slider */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Max Worker Concurrency</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{maxConcurrency} concurrent cases</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={maxConcurrency}
                onChange={(e) => setMaxConcurrency(parseInt(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>1 (Sequential / Rate Limit Safe)</span>
                <span>5 (High Speed)</span>
              </div>
            </div>

            {/* Confirmation Summary Snapshot Card */}
            <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/50 space-y-2 text-xs">
              <div className="font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                <span>Pre-Flight Execution Snapshot:</span>
              </div>
              <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-[11px] text-slate-700 dark:text-slate-300">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Dataset:</span>{' '}
                  <span className="font-medium text-slate-900 dark:text-white">{selectedDataset?.name || '—'} (v{selectedDataset?.version})</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Scope:</span>{' '}
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{selectedDataset?.test_case_count || 0} Test Cases</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 dark:text-slate-400">Target Model(s):</span>{' '}
                  <span className="font-mono text-indigo-600 dark:text-indigo-300 font-semibold">
                    {selectedModels.length > 0
                      ? selectedModels.map((m) => `${m.model_name} (${m.provider})`).join(' · ')
                      : '— none selected —'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Runs to launch:</span>{' '}
                  <span className="font-mono text-indigo-600 dark:text-indigo-300 font-bold">{selectedModelIds.size}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Active Metrics:</span>{' '}
                  <span className="font-semibold text-slate-900 dark:text-white">{activeMetrics.join(', ') || 'None'}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || datasets.length === 0 || selectedModelIds.size === 0 || activeMetrics.length === 0}
                className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>
                  {submitting
                    ? 'Starting Execution...'
                    : selectedModelIds.size > 1
                      ? `Launch ${selectedModelIds.size} Evaluation Runs`
                      : 'Start Evaluation Run'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
