import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Zap,
  ChevronRight,
  X,
  Plus
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import type { RunListItem, RunComparisonResponse, CaseComparisonRow, Project } from '../../types';
import { api } from '../../services/api';
import { MetricBadge } from '../common/MetricBadge';
import { useTheme } from '../../context/ThemeContext';

interface CompareRunsViewProps {
  runs: RunListItem[];
  project: Project | null;
  initialRunAId?: string;
  onNewRunClick?: () => void;
}

export const CompareRunsView: React.FC<CompareRunsViewProps> = ({
  runs,
  initialRunAId,
  onNewRunClick,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [runAId, setRunAId] = useState(initialRunAId || (runs[0]?.id ?? ''));
  const [runBId, setRunBId] = useState(runs[1]?.id ?? (runs[0]?.id ?? ''));
  const [comparison, setComparison] = useState<RunComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected Case comparison for deep modal
  const [inspectCase, setInspectCase] = useState<CaseComparisonRow | null>(null);

  const fetchComparison = async () => {
    if (!runAId || !runBId || runAId === runBId) {
      setComparison(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await api.compareRuns(runAId, runBId);
      setComparison(res);
    } catch (err: any) {
      setError(err.message || 'Comparison failed');
      setComparison(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (runs.length >= 2) {
      if (!runAId) setRunAId(runs[0].id);
      if (!runBId || runBId === runs[0].id) setRunBId(runs[1].id);
    } else if (runs.length === 1) {
      setRunAId(runs[0].id);
      setRunBId(runs[0].id);
    }
  }, [runs]);

  useEffect(() => {
    if (runAId && runBId && runAId !== runBId) {
      fetchComparison();
    }
  }, [runAId, runBId]);

  // Chart data for metric comparison
  const chartData = comparison?.metrics.map((m) => ({
    name: m.metric_name.toUpperCase(),
    RunA: m.run_a_score != null ? Math.round(m.run_a_score * 10) / 10 : 0,
    RunB: m.run_b_score != null ? Math.round(m.run_b_score * 10) / 10 : 0,
  })) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Evaluation Run Comparison & Regressions</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Compare model quality deltas, detect prompt regressions, and analyze latency / token shifts side-by-side.
          </p>
        </div>

        {onNewRunClick && (
          <button
            onClick={onNewRunClick}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all self-start"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Evaluation Run</span>
          </button>
        )}
      </div>

      {/* Empty State when fewer than 2 runs */}
      {runs.length < 2 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-center shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <GitCompare className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {runs.length === 0 ? 'No Evaluation Runs Yet' : 'Second Run Needed for Comparison'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {runs.length === 0
                ? 'Run your first evaluation benchmark to start collecting model quality metrics.'
                : 'You have 1 completed run. Launch an evaluation with a second model (e.g., Claude 3.5 Sonnet or GPT-4o) to compare metrics side-by-side.'}
            </p>
          </div>
          {onNewRunClick && (
            <button
              onClick={onNewRunClick}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md hover:shadow-indigo-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Launch Evaluation Run</span>
            </button>
          )}
        </div>
      ) : (
        /* Run Selector Bar */
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Run A */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Baseline (Run A)
              </label>
              <select
                value={runAId}
                onChange={(e) => setRunAId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.model_name} ({r.provider}) — {r.dataset_name} v{r.dataset_version} ({new Date(r.created_at).toLocaleTimeString()})
                  </option>
                ))}
              </select>
            </div>

            {/* Run B */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Candidate (Run B)
              </label>
              <select
                value={runBId}
                onChange={(e) => setRunBId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-purple-500 cursor-pointer shadow-sm"
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.model_name} ({r.provider}) — {r.dataset_name} v{r.dataset_version} ({new Date(r.created_at).toLocaleTimeString()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {runAId === runBId && (
            <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Both dropdowns have the same run selected. Please pick a different run in either dropdown.</span>
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center text-slate-500 dark:text-slate-400">Computing evaluation comparisons...</div>
      ) : error ? (
        <div className="p-6 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <div>
            <div className="font-bold">Incompatible Runs for Comparison</div>
            <div className="mt-1">{error}</div>
          </div>
        </div>
      ) : comparison ? (
        <>
          {/* Comparison Quality Metric Delta Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {comparison.metrics.map((m) => {
              const isHallucination = m.metric_name.toLowerCase().includes('hallucination');
              const delta = m.delta ?? 0;
              const hasImprovement = isHallucination ? delta < 0 : delta > 0;
              const hasRegression = isHallucination ? delta > 0 : delta < 0;

              return (
                <div
                  key={m.metric_name}
                  className="p-5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 capitalize">
                      {m.metric_name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {isHallucination ? 'Lower is better ↓' : 'Higher is better ↑'}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div className="space-y-0.5">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        A: <span className="font-mono font-bold text-slate-900 dark:text-slate-200">{m.run_a_score !== null ? `${m.run_a_score}%` : '—'}</span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        B: <span className="font-mono font-bold text-slate-900 dark:text-slate-200">{m.run_b_score !== null ? `${m.run_b_score}%` : '—'}</span>
                      </div>
                    </div>

                    <div
                      className={`flex items-center gap-1 font-mono font-black text-lg px-2.5 py-1 rounded-lg border ${
                        hasImprovement
                          ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                          : hasRegression
                          ? 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {hasImprovement ? <TrendingUp className="w-4 h-4" /> : hasRegression ? <TrendingDown className="w-4 h-4" /> : null}
                      <span>
                        {delta > 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Operational Latency & Token Deltas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-300">Mean Latency Shift</div>
                  <div className="text-xs text-slate-500 font-mono">
                    A: {Math.round(comparison.mean_latency_a_ms)} ms → B: {Math.round(comparison.mean_latency_b_ms)} ms
                  </div>
                </div>
              </div>
              <div className="font-mono text-sm font-bold text-slate-900 dark:text-slate-200">
                {comparison.latency_delta_ms > 0 ? `+${Math.round(comparison.latency_delta_ms)} ms` : `${Math.round(comparison.latency_delta_ms)} ms`}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-300">Total Token Shift</div>
                  <div className="text-xs text-slate-500 font-mono">
                    A: {comparison.total_tokens_a.toLocaleString()} → B: {comparison.total_tokens_b.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="font-mono text-sm font-bold text-slate-900 dark:text-slate-200">
                {comparison.token_delta > 0 ? `+${comparison.token_delta.toLocaleString()}` : `${comparison.token_delta.toLocaleString()}`}
              </div>
            </div>
          </div>

          {/* Side-by-Side Metric Comparison Bar Chart */}
          {chartData.length > 0 && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Side-by-Side Quality Dimension Scores</h3>
              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
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
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                    <Bar dataKey="RunA" name={`Baseline: ${comparison.run_a_model}`} fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="RunB" name={`Candidate: ${comparison.run_b_model}`} fill="#a855f7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Case-by-Case Regression and Improvement Table */}
          <div className="rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Per-Case Improvements & Regressions</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Inspect outputs and score shifts case-by-case</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {comparison.cases.filter((c) => c.improved).length} Improved ↑
                </span>
                <span>•</span>
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  {comparison.cases.filter((c) => c.regressed).length} Regressed ↓
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Case ID</th>
                    <th className="py-3 px-4">Question</th>
                    <th className="py-3 px-4">Baseline Output (Run A)</th>
                    <th className="py-3 px-4">Candidate Output (Run B)</th>
                    <th className="py-3 px-4">Classification</th>
                    <th className="py-3 px-4 text-right">Inspect Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                  {comparison.cases.map((c) => (
                    <tr
                      key={c.test_case_id}
                      onClick={() => setInspectCase(c)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                        {c.external_id}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-900 dark:text-slate-200 font-medium">
                        {c.question}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                        {c.run_a_output || '—'}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                        {c.run_b_output || '—'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {c.improved ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                            Improved ↑
                          </span>
                        ) : c.regressed ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
                            Regressed ↓
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800">
                            Neutral
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectCase(c);
                          }}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold flex items-center gap-1 ml-auto"
                        >
                          <span>Compare</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {/* Side-by-Side Deep Diff Inspection Modal */}
      {inspectCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400">
                  <GitCompare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Side-by-Side Case Output Diff</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Case ID: {inspectCase.external_id}</p>
                </div>
              </div>
              <button onClick={() => setInspectCase(null)} className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Question */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                <span className="text-slate-500 uppercase tracking-wider font-bold text-[10px]">Test Question:</span>
                <p className="text-slate-900 dark:text-slate-100 font-semibold text-sm">{inspectCase.question}</p>
              </div>

              {/* Side by side outputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Run A */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-indigo-200 dark:border-indigo-900/40 space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-indigo-700 dark:text-indigo-400">Run A (Baseline): {comparison?.run_a_model}</span>
                    <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">{Math.round(inspectCase.run_a_latency_ms)} ms</span>
                  </div>
                  <div className="font-mono text-slate-800 dark:text-slate-200 text-xs leading-relaxed whitespace-pre-wrap">
                    {inspectCase.run_a_output || <span className="text-slate-400 italic">No output</span>}
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap gap-1">
                    {Object.entries(inspectCase.metric_scores_a).map(([name, score]) => (
                      <MetricBadge key={name} name={name} score={score} size="sm" />
                    ))}
                  </div>
                </div>

                {/* Run B */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-purple-200 dark:border-purple-900/40 space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-purple-700 dark:text-purple-400">Run B (Candidate): {comparison?.run_b_model}</span>
                    <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">{Math.round(inspectCase.run_b_latency_ms)} ms</span>
                  </div>
                  <div className="font-mono text-slate-800 dark:text-slate-200 text-xs leading-relaxed whitespace-pre-wrap">
                    {inspectCase.run_b_output || <span className="text-slate-400 italic">No output</span>}
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap gap-1">
                    {Object.entries(inspectCase.metric_scores_b).map(([name, score]) => (
                      <MetricBadge key={name} name={name} score={score} size="sm" />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-900/90 shrink-0">
              <button
                onClick={() => setInspectCase(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                Close Diff
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
