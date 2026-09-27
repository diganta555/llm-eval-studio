import React from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Zap,
  TrendingUp,
  ChevronRight,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { RunListItem, Project } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { MetricBadge } from '../common/MetricBadge';
import { useTheme } from '../../context/ThemeContext';

interface DashboardViewProps {
  runs: RunListItem[];
  project: Project | null;
  onSelectRun: (runId: string) => void;
  onNewRunClick: () => void;
  onGoToDatasets: () => void;
  onGoToModels: () => void;
  onGoToCompare: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  runs,
  project,
  onSelectRun,
  onNewRunClick,
  onGoToDatasets,
  onGoToCompare,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Aggregate KPIs
  const totalRuns = runs.length;
  const completedRuns = runs.filter((r) => r.status === 'COMPLETED').length;
  const failedRuns = runs.filter((r) => r.status === 'FAILED').length;
  
  // Completed runs metrics averages
  const validCompleted = runs.filter((r) => r.status === 'COMPLETED');
  const avgCorrectness = validCompleted.length > 0 && validCompleted.some((r) => r.avg_correctness != null)
    ? validCompleted.reduce((acc, r) => acc + (r.avg_correctness || 0), 0) / validCompleted.filter(r => r.avg_correctness != null).length
    : null;

  const avgRelevance = validCompleted.length > 0 && validCompleted.some((r) => r.avg_relevance != null)
    ? validCompleted.reduce((acc, r) => acc + (r.avg_relevance || 0), 0) / validCompleted.filter(r => r.avg_relevance != null).length
    : null;

  const avgFaithfulness = validCompleted.length > 0 && validCompleted.some((r) => r.avg_faithfulness != null)
    ? validCompleted.reduce((acc, r) => acc + (r.avg_faithfulness || 0), 0) / validCompleted.filter(r => r.avg_faithfulness != null).length
    : null;

  const avgHallucination = validCompleted.length > 0 && validCompleted.some((r) => r.avg_hallucination != null)
    ? validCompleted.reduce((acc, r) => acc + (r.avg_hallucination || 0), 0) / validCompleted.filter(r => r.avg_hallucination != null).length
    : null;

  const totalTokens = runs.reduce((acc, r) => acc + (r.total_tokens || 0), 0);
  const avgLatency = validCompleted.length > 0
    ? validCompleted.reduce((acc, r) => acc + (r.mean_latency_ms || 0), 0) / validCompleted.length
    : 0;

  // Chart data: chronological order (oldest to newest)
  const chartData = [...validCompleted].reverse().map((r, idx) => ({
    name: `Run #${idx + 1} (${r.model_name.slice(0, 10)})`,
    correctness: r.avg_correctness != null ? Math.round(r.avg_correctness * 10) / 10 : null,
    relevance: r.avg_relevance != null ? Math.round(r.avg_relevance * 10) / 10 : null,
    faithfulness: r.avg_faithfulness != null ? Math.round(r.avg_faithfulness * 10) / 10 : null,
    hallucination: r.avg_hallucination != null ? Math.round(r.avg_hallucination * 10) / 10 : null,
    latency: Math.round(r.mean_latency_ms),
  }));

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900/10 via-purple-900/10 to-slate-900/5 dark:from-indigo-900/40 dark:via-purple-900/30 dark:to-slate-900/60 border border-indigo-200 dark:border-indigo-500/20 p-6 md:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
              <Activity className="w-3.5 h-3.5" />
              <span>Project: {project?.name || 'Default Evaluation Suite'}</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Evaluation & Benchmarking Studio
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
              Measure model accuracy, verify factual grounding against reference context, detect hallucinations, and evaluate latency & token footprint.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onNewRunClick}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
            >
              <Zap className="w-4 h-4" />
              <span>Launch New Eval</span>
            </button>
            <button
              onClick={onGoToCompare}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium text-sm transition-all shadow-sm"
            >
              <Layers className="w-4 h-4" />
              <span>Compare Runs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Correctness */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 relative overflow-hidden group hover:border-emerald-500/40 transition-colors shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Avg Correctness</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 font-semibold">
              Higher is better ↑
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-slate-900 dark:text-white">
              {avgCorrectness !== null ? `${avgCorrectness.toFixed(1)}%` : '—'}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Match against ground truth & rubric</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-60"></div>
        </div>

        {/* Relevance */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 relative overflow-hidden group hover:border-indigo-500/40 transition-colors shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Avg Relevance</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 font-semibold">
              Higher is better ↑
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-slate-900 dark:text-white">
              {avgRelevance !== null ? `${avgRelevance.toFixed(1)}%` : '—'}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Focus on user intent without filler</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-blue-400 opacity-60"></div>
        </div>

        {/* Faithfulness */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 relative overflow-hidden group hover:border-cyan-500/40 transition-colors shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Avg Faithfulness</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/60 font-semibold">
              Higher is better ↑
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-slate-900 dark:text-white">
              {avgFaithfulness !== null ? `${avgFaithfulness.toFixed(1)}%` : '—'}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Claims grounded in reference context</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-sky-400 opacity-60"></div>
        </div>

        {/* Hallucination */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 relative overflow-hidden group hover:border-rose-500/40 transition-colors shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Avg Hallucination</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 font-semibold">
              Lower is better ↓
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-3xl font-black font-mono ${avgHallucination !== null && avgHallucination > 25 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
              {avgHallucination !== null ? `${avgHallucination.toFixed(1)}%` : '—'}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Fabricated / unsupported claims detected</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-amber-500 opacity-60"></div>
        </div>
      </div>

      {/* Operational Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-sm">
          <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Runs</div>
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">{totalRuns}</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-sm">
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Completed / Failed</div>
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">{completedRuns} <span className="text-xs text-slate-400">/</span> <span className="text-rose-600 dark:text-rose-400">{failedRuns}</span></div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-sm">
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Mean Latency</div>
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">{avgLatency > 0 ? `${Math.round(avgLatency)} ms` : '—'}</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-sm">
          <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Tokens</div>
            <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">{totalTokens.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Metric Quality Trend Chart */}
      {chartData.length > 0 && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Evaluation Quality Trends Over Runs</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Historical performance across quality metrics (0 - 100%)</p>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-4">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Correctness ↑</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Relevance ↑</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span> Faithfulness ↑</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Hallucination ↓</span>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#e2e8f0'} vertical={false} />
                <XAxis dataKey="name" stroke={isDark ? '#64748b' : '#94a3b8'} tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} stroke={isDark ? '#64748b' : '#94a3b8'} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Line type="monotone" dataKey="correctness" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} name="Correctness ↑" />
                <Line type="monotone" dataKey="relevance" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Relevance ↑" />
                <Line type="monotone" dataKey="faithfulness" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} name="Faithfulness ↑" />
                <Line type="monotone" dataKey="hallucination" stroke="#f43f5e" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} name="Hallucination ↓" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Evaluation Runs Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 overflow-hidden space-y-0 shadow-sm">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Recent Evaluation Runs</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Inspect execution status, scores, latency, and token totals</p>
          </div>
          {runs.length > 0 && (
            <button
              onClick={onNewRunClick}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1"
            >
              <span>+ New Run</span>
            </button>
          )}
        </div>

        {runs.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-600/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">No evaluation runs recorded yet</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                Import or seed a test dataset and configure a model to launch your first LLM benchmark.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={onGoToDatasets}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
              >
                Inspect Datasets
              </button>
              <button
                onClick={onNewRunClick}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all"
              >
                Launch Evaluation
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Model & Provider</th>
                  <th className="py-3 px-4">Dataset</th>
                  <th className="py-3 px-4">Cases</th>
                  <th className="py-3 px-4">Scores (Corr / Rel / Faith / Hall)</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4">Tokens</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                {runs.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => onSelectRun(r.id)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 dark:text-slate-200">{r.model_name}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">{r.provider}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="text-slate-700 dark:text-slate-300 font-medium">{r.dataset_name}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">v{r.dataset_version}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-700 dark:text-slate-300">
                      {r.completed_cases}/{r.total_cases}
                      {r.failed_cases > 0 && (
                        <span className="ml-1.5 text-rose-600 dark:text-rose-400">({r.failed_cases} fail)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <MetricBadge name="Corr" score={r.avg_correctness} size="sm" showLabel={false} />
                        <MetricBadge name="Rel" score={r.avg_relevance} size="sm" showLabel={false} />
                        <MetricBadge name="Faith" score={r.avg_faithfulness} size="sm" showLabel={false} />
                        <MetricBadge name="Hall" score={r.avg_hallucination} size="sm" showLabel={false} />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-600 dark:text-slate-400">
                      {r.mean_latency_ms > 0 ? `${Math.round(r.mean_latency_ms)} ms` : '—'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-600 dark:text-slate-400">
                      {r.total_tokens ? r.total_tokens.toLocaleString() : '—'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-300 font-semibold">
                        View Details <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
