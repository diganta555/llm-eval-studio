import React, { useState } from 'react';
import {
  Activity,
  Zap,
  Sliders,
  ChevronRight,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { RunListItem, Project } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { MetricBadge } from '../common/MetricBadge';
import { api } from '../../services/api';

interface RunsListViewProps {
  runs: RunListItem[];
  project: Project | null;
  onSelectRun: (runId: string) => void;
  onNewRunClick: () => void;
  onCompareRuns: (runId?: string) => void;
  onRefresh?: () => Promise<void> | void;
}

export const RunsListView: React.FC<RunsListViewProps> = ({
  runs,
  project,
  onSelectRun,
  onNewRunClick,
  onCompareRuns,
  onRefresh,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const handleDeleteRun = async (e: React.MouseEvent, runId: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this evaluation run? This action cannot be undone.')) {
      return;
    }
    try {
      setDeletingId(runId);
      await api.deleteRun(runId);
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err: any) {
      alert(`Failed to delete run: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const hasActiveRun = runs.some((r) =>
    ['running', 'queued', 'pending'].includes(r.status.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Evaluation Runs</span>
            </h2>
            {hasActiveRun && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-400 border border-blue-200 dark:border-blue-800 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                Live Polling
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            History of all benchmark executions, scores, durations, and token usage for project "{project?.name}".
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh runs"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-500' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
          <button
            onClick={() => onCompareRuns()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors shadow-sm"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Compare Runs</span>
          </button>
          <button
            onClick={onNewRunClick}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>New Evaluation Run</span>
          </button>
        </div>
      </div>

      {/* Runs Table */}
      {runs.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">No evaluation runs recorded</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              Start an evaluation run to score your models across correctness, relevance, and factual grounding.
            </p>
          </div>
          <button
            onClick={onNewRunClick}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all inline-flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Start Evaluation</span>
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Target Model</th>
                  <th className="py-3 px-4">Benchmark Dataset</th>
                  <th className="py-3 px-4">Cases</th>
                  <th className="py-3 px-4">Scores (Corr / Rel / Faith / Hall)</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4">Tokens</th>
                  <th className="py-3 px-4">Executed At</th>
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
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleDeleteRun(e, r.id)}
                          disabled={deletingId === r.id}
                          title="Delete this evaluation run"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors opacity-80 group-hover:opacity-100"
                        >
                          <Trash2 className={`w-3.5 h-3.5 ${deletingId === r.id ? 'animate-spin' : ''}`} />
                        </button>
                        <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-300 font-semibold">
                          Details <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
