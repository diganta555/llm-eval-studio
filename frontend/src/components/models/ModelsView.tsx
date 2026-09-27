import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Plus,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Play,
  KeyRound,
  Sparkles,
  RefreshCw,
  Trash2
} from 'lucide-react';
import type { ModelConfig, ModelConnectionTestResponse, Project } from '../../types';
import { api } from '../../services/api';

interface ModelsViewProps {
  project: Project | null;
}

interface ModelPreset {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'mock';
  model_name: string;
  description: string;
  temperature: number;
  max_tokens: number;
  secret_reference?: string;
}

const MODEL_PRESETS: ModelPreset[] = [
  {
    id: 'gpt-4o-mini',
    name: 'OpenAI GPT-4o Mini (Fast & Cheap)',
    provider: 'openai',
    model_name: 'gpt-4o-mini',
    description: 'Fast, highly cost-efficient small model for everyday evaluations.',
    temperature: 0.0,
    max_tokens: 1000,
    secret_reference: 'OPENAI_API_KEY',
  },
  {
    id: 'gpt-4o',
    name: 'OpenAI GPT-4o (Flagship Multimodal)',
    provider: 'openai',
    model_name: 'gpt-4o',
    description: 'High-intelligence flagship model with excellent reasoning.',
    temperature: 0.0,
    max_tokens: 1000,
    secret_reference: 'OPENAI_API_KEY',
  },
  {
    id: 'gpt-4-turbo',
    name: 'OpenAI GPT-4 Turbo',
    provider: 'openai',
    model_name: 'gpt-4-turbo',
    description: 'High capability model with broad world knowledge.',
    temperature: 0.0,
    max_tokens: 1000,
    secret_reference: 'OPENAI_API_KEY',
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Anthropic Claude 3.5 Sonnet',
    provider: 'anthropic',
    model_name: 'claude-3-5-sonnet-20241022',
    description: 'State-of-the-art coding, reasoning, and instruction following.',
    temperature: 0.0,
    max_tokens: 1000,
    secret_reference: 'ANTHROPIC_API_KEY',
  },
  {
    id: 'claude-3-haiku',
    name: 'Anthropic Claude 3 Haiku',
    provider: 'anthropic',
    model_name: 'claude-3-haiku-20240307',
    description: 'Near-instant response speed for lightweight eval benchmarks.',
    temperature: 0.0,
    max_tokens: 1000,
    secret_reference: 'ANTHROPIC_API_KEY',
  },
  {
    id: 'claude-3-opus',
    name: 'Anthropic Claude 3 Opus',
    provider: 'anthropic',
    model_name: 'claude-3-opus-20240229',
    description: 'Deep reasoning for complex, nuanced evaluation tasks.',
    temperature: 0.0,
    max_tokens: 1000,
    secret_reference: 'ANTHROPIC_API_KEY',
  },
  {
    id: 'mock-eval-model',
    name: 'Mock Evaluator (Offline / Fast Demo)',
    provider: 'mock',
    model_name: 'mock-eval-model',
    description: 'Simulated responses with zero latency and no API keys required.',
    temperature: 0.0,
    max_tokens: 1000,
  },
];

export const ModelsView: React.FC<ModelsViewProps> = ({ project }) => {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // New Model Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('gpt-4o-mini');
  const [name, setName] = useState('OpenAI GPT-4o Mini (Fast & Cheap)');
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'mock'>('openai');
  const [modelName, setModelName] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState<number>(0.0);
  const [maxTokens, setMaxTokens] = useState<number>(1000);
  const [secretRef, setSecretRef] = useState('OPENAI_API_KEY');
  const [isCustom, setIsCustom] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Interactive Test Connection Tool
  const [testProvider, setTestProvider] = useState<'openai' | 'anthropic' | 'mock'>('openai');
  const [testModelPreset, setTestModelPreset] = useState<string>('gpt-4o-mini');
  const [customTestModel, setCustomTestModel] = useState<string>('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ModelConnectionTestResponse | null>(null);

  // Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState<ModelConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadModels = async () => {
    if (!project) return;
    try {
      setLoading(true);
      const data = await api.getModelConfigs(project.id);
      setModels(data);
    } catch (err: any) {
      console.error('Failed to load model configs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, [project?.id]);

  // When preset changes in Modal, auto-populate all fields
  const handlePresetSelect = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (presetId === 'custom') {
      setIsCustom(true);
      setName('');
      setModelName('');
      return;
    }
    setIsCustom(false);
    const preset = MODEL_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setName(preset.name);
      setProvider(preset.provider);
      setModelName(preset.model_name);
      setTemperature(preset.temperature);
      setMaxTokens(preset.max_tokens);
      setSecretRef(preset.secret_reference || '');
    }
  };

  // Provider changed in connection tester
  const handleTestProviderChange = (newProvider: 'openai' | 'anthropic' | 'mock') => {
    setTestProvider(newProvider);
    setTestResult(null);
    if (newProvider === 'openai') {
      setTestModelPreset('gpt-4o-mini');
    } else if (newProvider === 'anthropic') {
      setTestModelPreset('claude-3-5-sonnet-20241022');
    } else {
      setTestModelPreset('mock-eval-model');
    }
  };

  const getEffectiveTestModel = () => {
    if (testModelPreset === 'custom') {
      return customTestModel.trim() || 'gpt-4o-mini';
    }
    return testModelPreset;
  };

  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !name.trim()) return;

    try {
      setSubmitting(true);
      await api.createModelConfig(project.id, {
        name: name.trim(),
        provider,
        model_name: modelName.trim(),
        parameters: {
          temperature: Number(temperature),
          max_tokens: Number(maxTokens),
          top_p: 1.0,
        },
        secret_reference: provider === 'openai' ? (secretRef || 'OPENAI_API_KEY') : provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : undefined,
      });
      setShowAddModal(false);
      setName('');
      await loadModels();
    } catch (err: any) {
      alert(`Failed to save model config: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const targetModel = getEffectiveTestModel();
      const res = await api.testModelConnection(testProvider, targetModel);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        latency_ms: 0,
        message: err.message || 'Connection test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDeleteModel = async () => {
    if (!project || !deleteTarget) return;
    try {
      setDeleting(true);
      await api.deleteModelConfig(project.id, deleteTarget.id);
      setDeleteTarget(null);
      await loadModels();
    } catch (err: any) {
      alert(err.message || 'Failed to delete model configuration');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Model Configurations</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Select, configure, and test target LLMs (OpenAI, Anthropic Claude, Mock) with custom parameters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadModels}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title="Refresh models"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              handlePresetSelect('gpt-4o-mini');
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Model Config</span>
          </button>
        </div>
      </div>

      {/* API Key Setup Info Card */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-blue-50/80 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-blue-950/30 border border-indigo-100 dark:border-indigo-900/40 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-950 dark:text-indigo-200">
            <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>How to Configure API Keys</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3 h-3" /> OpenAI
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-400 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Anthropic
            </span>
          </div>
        </div>
        <p className="text-[12px] text-slate-600 dark:text-slate-400 leading-relaxed">
          Keys are configured in your <code className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">backend/.env</code> file. The backend reads them securely and evaluates runs without exposing keys to the browser.
        </p>
      </div>

      {/* Model Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Configured Models ({models.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">Loading model configurations...</div>
        ) : models.length === 0 ? (
          <div className="p-8 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center shadow-sm space-y-3">
            <Cpu className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs text-slate-500 dark:text-slate-400">No model configurations found in this project.</p>
            <button
              onClick={() => {
                handlePresetSelect('gpt-4o-mini');
                setShowAddModal(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Model</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {models.map((m) => {
              const providerColor =
                m.provider === 'openai'
                  ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                  : m.provider === 'anthropic'
                    ? 'bg-orange-50 dark:bg-orange-950/80 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/60'
                    : 'bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/60';

              return (
                <div
                  key={m.id}
                  className="p-5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all space-y-4 flex flex-col justify-between shadow-sm group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {m.name}
                        </h3>
                        <div className="text-xs font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                          {m.model_name}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider border ${providerColor}`}>
                        {m.provider}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-950/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800/80 font-mono">
                      <div>
                        <span className="text-slate-500 text-[10px] block">Temperature:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-semibold">{m.parameters?.temperature ?? 0.0}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">Max Tokens:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-semibold">{m.parameters?.max_tokens ?? 1000}</span>
                      </div>
                    </div>

                    {(m.provider === 'openai' || m.provider === 'anthropic') && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Secret: <code>{m.secret_reference || (m.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY')}</code></span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Added {new Date(m.created_at).toLocaleDateString()}</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setDeleteTarget(m)}
                        className="text-xs text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete this model config"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                      <button
                        onClick={() => {
                          handleTestProviderChange(m.provider);
                          setTestModelPreset(m.model_name);
                          handleTestConnection();
                        }}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" />
                        <span>Test Probe</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Interactive Connection Tester Panel with Dropdown */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <span>Interactive Model Connection & Latency Tester</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select a provider and model from the dropdown to send a quick probe request and measure round-trip latency.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Provider</label>
            <select
              value={testProvider}
              onChange={(e) => handleTestProviderChange(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="mock">Mock Evaluator (Local / Offline)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Model (Select Dropdown)</label>
            <select
              value={testModelPreset}
              onChange={(e) => setTestModelPreset(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
            >
              {testProvider === 'openai' && (
                <>
                  <option value="gpt-4o-mini">gpt-4o-mini (Default Fast)</option>
                  <option value="gpt-4o">gpt-4o (Flagship)</option>
                  <option value="gpt-4-turbo">gpt-4-turbo</option>
                  <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                  <option value="custom">-- Custom Model Name --</option>
                </>
              )}
              {testProvider === 'anthropic' && (
                <>
                  <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet-20241022</option>
                  <option value="claude-3-haiku-20240307">claude-3-haiku-20240307</option>
                  <option value="claude-3-opus-20240229">claude-3-opus-20240229</option>
                  <option value="custom">-- Custom Model Name --</option>
                </>
              )}
              {testProvider === 'mock' && (
                <option value="mock-eval-model">mock-eval-model</option>
              )}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="w-full py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{testing ? 'Testing Round-Trip...' : 'Test Connection'}</span>
            </button>
          </div>
        </div>

        {testModelPreset === 'custom' && (
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Enter Custom Model ID</label>
            <input
              type="text"
              placeholder="e.g. o1-preview or custom-ft-model"
              value={customTestModel}
              onChange={(e) => setCustomTestModel(e.target.value)}
              className="w-full md:w-1/2 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {testResult && (
          <div
            className={`p-4 rounded-xl border text-xs space-y-2 animate-in fade-in duration-150 ${
              testResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                )}
                <span>{testResult.message}</span>
              </div>
              <div className="font-mono text-xs px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold">
                Latency: {testResult.latency_ms} ms
              </div>
            </div>

            {testResult.sample_response && (
              <div className="p-2.5 rounded bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                <span className="text-slate-500 block mb-0.5 font-sans font-semibold">Sample Model Output:</span>
                "{testResult.sample_response}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* Easy Add Model Configuration Modal with Dropdown Presets */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add Model Configuration</h3>
              </div>
              <span className="text-xs text-slate-500">Easy Dropdown Setup</span>
            </div>

            <form onSubmit={handleCreateModel} className="space-y-4">
              {/* Preset Dropdown */}
              <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
                <label className="block text-xs font-bold text-indigo-950 dark:text-indigo-200">
                  Select a Pre-Configured Model Preset
                </label>
                <select
                  value={selectedPresetId}
                  onChange={(e) => handlePresetSelect(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 shadow-sm"
                >
                  <optgroup label="OpenAI Models">
                    <option value="gpt-4o-mini">OpenAI GPT-4o Mini (Fast & Cost Efficient)</option>
                    <option value="gpt-4o">OpenAI GPT-4o (Flagship Multimodal)</option>
                    <option value="gpt-4-turbo">OpenAI GPT-4 Turbo</option>
                  </optgroup>
                  <optgroup label="Anthropic Claude Models">
                    <option value="claude-3-5-sonnet">Anthropic Claude 3.5 Sonnet (State-of-the-Art)</option>
                    <option value="claude-3-haiku">Anthropic Claude 3 Haiku (Ultra Fast)</option>
                    <option value="claude-3-opus">Anthropic Claude 3 Opus (Nuanced Reasoning)</option>
                  </optgroup>
                  <optgroup label="Offline / Demo">
                    <option value="mock-eval-model">Mock Evaluator (No Keys Required)</option>
                  </optgroup>
                  <optgroup label="Custom">
                    <option value="custom">-- Custom Model Configuration --</option>
                  </optgroup>
                </select>
                <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300">
                  Selecting a preset automatically pre-fills the name, provider, model ID, and parameters below.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Configuration Display Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. OpenAI GPT-4o Mini (Fast & Cheap)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Provider</label>
                  <select
                    value={provider}
                    disabled={!isCustom}
                    onChange={(e) => setProvider(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-75"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="mock">Mock</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Model ID *</label>
                  <input
                    type="text"
                    required
                    disabled={!isCustom}
                    placeholder="e.g. gpt-4o-mini"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-75"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Temperature (0.0 = deterministic)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Max Tokens</label>
                  <input
                    type="number"
                    min="10"
                    max="4096"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
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
                  {submitting ? 'Saving...' : 'Add Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-rose-100 dark:bg-rose-950/60">
                <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delete Model Config?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">{deleteTarget.name}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{deleteTarget.provider} / {deleteTarget.model_name}</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteModel}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3 h-3" />
                <span>{deleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
