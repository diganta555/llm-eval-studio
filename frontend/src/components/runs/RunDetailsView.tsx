import React, { useState, useEffect } from 'react';
import {
  Activity,
  Ban,
  ArrowLeft,
  Sliders,
  FileSpreadsheet,
  FileCode,
  ChevronRight,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import type { RunSummary, CaseResult, Project } from '../../types';
import { api } from '../../services/api';
import { StatusBadge } from '../common/StatusBadge';
import { MetricBadge } from '../common/MetricBadge';
import { CaseDetailModal } from './CaseDetailModal';

interface RunDetailsViewProps {
  runId: string;
  project: Project | null;
  onBack: () => void;
  onCompareWithThis: (runId: string) => void;
}

export const RunDetailsView: React.FC<RunDetailsViewProps> = ({
  runId,
  onBack,
  onCompareWithThis,
}) => {
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [cases, setCases] = useState<CaseResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'FAILED'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // Selected Case for Modal
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const fetchRunData = async () => {
    try {
      const [sumData, caseData] = await Promise.all([
        api.getRunDetails(runId),
        api.getRunResults(runId, {
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          category: categoryFilter || undefined,
          search: searchQuery.trim() || undefined,
          limit: 100,
        }),
      ]);
      setSummary(sumData);
      setCases(caseData);
    } catch (err: any) {
      console.error('Failed to load run details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRunData();

    // Auto-poll if running or queued
    const interval = setInterval(() => {
      if (summary?.status === 'RUNNING' || summary?.status === 'QUEUED' || summary?.status === 'PENDING') {
        fetchRunData();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [runId, statusFilter, categoryFilter, searchQuery]);

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this evaluation run?')) return;
    try {
      setCancelling(true);
      await api.cancelRun(runId);
      await fetchRunData();
    } catch (err: any) {
      alert(`Failed to cancel run: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this evaluation run? This action cannot be undone.')) {
      return;
    }
    try {
      setDeleting(true);
      await api.deleteRun(runId);
      onBack();
    } catch (err: any) {
      alert(`Failed to delete run: ${err.message}`);
      setDeleting(false);
    }
  };

  const handleExport = (format: 'csv' | 'json') => {
    const url = api.getExportUrl(runId, format);
    window.open(url, '_blank');
  };

  // Categories list from cases
  const categories = Array.from(new Set(cases.map((c) => c.category).filter(Boolean))) as string[];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
            title="Back to Runs List"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Evaluation Run Details</h2>
              {summary && <StatusBadge status={summary.status} />}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              <span>Run ID: {runId.slice(0, 8)}</span>
              <span>•</span>
              <span>Dataset: {summary?.dataset_name} (v{summary?.dataset_version})</span>
              <span>•</span>
              <span>Model: {summary?.model_name}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchRunData()}
            className="p-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {summary && (summary.status === 'RUNNING' || summary.status === 'QUEUED') && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/80 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>{cancelling ? 'Cancelling...' : 'Cancel Run'}</span>
            </button>
          )}

          <button
            onClick={() => onCompareWithThis(runId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors shadow-sm"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Compare Run</span>
          </button>

          <div className="flex items-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 shadow-sm">
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>CSV</span>
            </button>
            <button
              onClick={() => handleExport('json')}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>JSON</span>
            </button>
          </div>

          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Delete this run"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/80 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-400 text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
          >
            <Trash2 className={`w-3.5 h-3.5 ${deleting ? 'animate-spin' : ''}`} />
            <span>{deleting ? 'Deleting...' : 'Delete'}</span>
          </button>
        </div>
      </div>

      {loading && !summary ? (
        <div className="p-16 text-center text-slate-500 dark:text-slate-400">Loading evaluation run summary...</div>
      ) : summary ? (
        <>
          {/* Live Progress Bar (if in progress) */}
          {(summary.status === 'RUNNING' || summary.status === 'QUEUED' || summary.status === 'PENDING') && (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-indigo-200 dark:border-indigo-500/30 space-y-2 shadow-sm">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                  <span>Evaluation in Progress ({summary.completed_cases + summary.failed_cases} of {summary.total_cases} test cases finished)</span>
                </span>
                <span className="font-mono text-slate-900 dark:text-white">{summary.progress_percent.toFixed(1)}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(summary.progress_percent, 5)}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Metric Quality Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {summary.metrics_summary.map((ms) => {
              const isHallucination = ms.metric_name.toLowerCase().includes('hallucination');
              return (
                <div
                  key={ms.metric_name}
                  className="p-5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 capitalize">
                      {ms.metric_name}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        isHallucination
                          ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
                          : 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                      }`}
                    >
                      {isHallucination ? 'Lower is better ↓' : 'Higher is better ↑'}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono text-slate-900 dark:text-white">
                      {ms.average_score !== null && ms.average_score !== undefined
                        ? `${ms.average_score.toFixed(1)}%`
                        : '—'}
                    </span>
                    {ms.pass_rate > 0 && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">({ms.pass_rate.toFixed(0)}% pass)</span>
                    )}
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-500 font-mono pt-1 border-t border-slate-100 dark:border-slate-800/80">
                    <span>Evaluated: {ms.evaluated_count}</span>
                    {ms.min_score !== null && ms.max_score !== null && (
                      <span>Range: {ms.min_score}% - {ms.max_score}%</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Operational KPIs (Latency, Tokens, Durations) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">Mean Latency</span>
              <span className="text-base font-bold font-mono text-slate-900 dark:text-white mt-1 block">
                {summary.mean_latency_ms > 0 ? `${Math.round(summary.mean_latency_ms)} ms` : '—'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">Median / p95 Latency</span>
              <span className="text-base font-bold font-mono text-slate-900 dark:text-white mt-1 block">
                {summary.median_latency_ms > 0 ? `${Math.round(summary.median_latency_ms)} / ${Math.round(summary.p95_latency_ms)} ms` : '—'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">Tokens (Prompt + Compl)</span>
              <span className="text-base font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1 block">
                {summary.total_tokens ? summary.total_tokens.toLocaleString() : '—'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">Avg Tokens / Case</span>
              <span className="text-base font-bold font-mono text-slate-700 dark:text-slate-300 mt-1 block">
                {summary.avg_tokens_per_case ? Math.round(summary.avg_tokens_per_case) : '—'}
              </span>
            </div>
          </div>

          {/* Test Cases Results Table */}
          <div className="rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 overflow-hidden space-y-0 shadow-sm">
            {/* Table Filters Bar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/90">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search questions or responses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Status selector */}
                <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 text-xs">
                  {(['ALL', 'SUCCESS', 'FAILED'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                        statusFilter === st ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                {/* Category selector if multiple */}
                {categories.length > 0 && (
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                  >
                    <option value="">All Categories</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Showing {cases.length} of {summary.total_cases} test cases
              </div>
            </div>

            {/* Cases Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Case ID</th>
                    <th className="py-3 px-4">Question</th>
                    <th className="py-3 px-4">Model Output Preview</th>
                    <th className="py-3 px-4">Metric Scores</th>
                    <th className="py-3 px-4">Latency</th>
                    <th className="py-3 px-4">Tokens</th>
                    <th className="py-3 px-4 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                  {cases.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCaseId(c.id)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                        {c.external_id || c.test_case_id.slice(0, 8)}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-900 dark:text-slate-200 font-medium">
                        {c.question}
                      </td>
                      <td className="py-3.5 px-4 max-w-sm truncate font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                        {c.output_text || (c.error_message ? <span className="text-rose-600 dark:text-rose-400">{c.error_message}</span> : '—')}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {c.metric_results.map((m) => (
                            <MetricBadge key={m.id} name={m.metric_name} score={m.score} showLabel={false} size="sm" />
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-600 dark:text-slate-400">
                        {c.latency_ms > 0 ? `${Math.round(c.latency_ms)} ms` : '—'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-600 dark:text-slate-400">
                        {c.total_tokens || '—'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCaseId(c.id);
                          }}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold flex items-center gap-1 ml-auto"
                        >
                          <span>Inspect</span>
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

      {/* Case Detail Modal (Page 6) */}
      {selectedCaseId && (
        <CaseDetailModal
          runId={runId}
          caseResultId={selectedCaseId}
          onClose={() => setSelectedCaseId(null)}
          onReviewAdded={() => fetchRunData()}
        />
      )}
    </div>
  );
};
