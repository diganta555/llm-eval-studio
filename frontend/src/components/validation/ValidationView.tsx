import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Database,
  Plus,
  RefreshCw,
  Sliders,
  Sparkles,
  Search,
  FileCheck,
  TrendingUp,
  Cpu,
  Trash2,
  Info,
} from 'lucide-react';
import type {
  Project,
  ValidationDataset,
  ValidationDatasetDetail,
  ValidationCase,
  ValidationRun,
  ValidationRunDetail,
  ValidationCaseResult,
} from '../../types';
import { api } from '../../services/api';

interface ValidationViewProps {
  project: Project | null;
}

export const ValidationView: React.FC<ValidationViewProps> = ({ project }) => {
  // Datasets state
  const [datasets, setDatasets] = useState<ValidationDataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [datasetDetail, setDatasetDetail] = useState<ValidationDatasetDetail | null>(null);
  const [loadingDatasets, setLoadingDatasets] = useState(false);

  // Runs state
  const [runs, setRuns] = useState<ValidationRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<ValidationRunDetail | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [runningValidation, setRunningValidation] = useState(false);

  // Active view tab inside Validation
  const [subTab, setSubTab] = useState<'benchmark' | 'datasets' | 'cases'>('benchmark');

  // Filtering & search
  const [selectedMetricFilter, setSelectedMetricFilter] = useState<string>('all');
  const [agreementFilter, setAgreementFilter] = useState<'all' | 'match' | 'mismatch'>('all');
  const [caseReviewFilter, setCaseReviewFilter] = useState<'all' | 'reviewed' | 'provisional'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'reviewed' | 'provisional' | 'disputed'>('all');

  // Modals & Drawers
  const [showNewDatasetModal, setShowNewDatasetModal] = useState(false);
  const [showRunConfigModal, setShowRunConfigModal] = useState(false);
  const [inspectCase, setInspectCase] = useState<{
    caseData?: ValidationCase;
    resultData?: ValidationCaseResult;
  } | null>(null);

  // Run config modal state
  const [includeUnreviewed, setIncludeUnreviewed] = useState(true);
  const [forceMock, setForceMock] = useState(true);

  // New dataset form state
  const [newDatasetName, setNewDatasetName] = useState('');
  const [newDatasetDesc, setNewDatasetDesc] = useState('');
  const [creatingDataset, setCreatingDataset] = useState(false);

  // Action status messages
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Load datasets for current project
  const loadDatasets = async () => {
    if (!project) return;
    try {
      setLoadingDatasets(true);
      const list = await api.getValidationDatasets(project.id);
      setDatasets(list);
      if (list.length > 0 && !selectedDatasetId) {
        setSelectedDatasetId(list[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load validation datasets:', err);
    } finally {
      setLoadingDatasets(false);
    }
  };

  // Load runs for current project
  const loadRuns = async () => {
    if (!project) return;
    try {
      setLoadingRuns(true);
      const list = await api.getValidationRuns(project.id);
      setRuns(list);
      if (list.length > 0 && !selectedRunId) {
        setSelectedRunId(list[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load validation runs:', err);
    } finally {
      setLoadingRuns(false);
    }
  };

  // Load dataset detail when selected
  useEffect(() => {
    if (!selectedDatasetId) {
      setDatasetDetail(null);
      return;
    }
    const fetchDetail = async () => {
      try {
        const detail = await api.getValidationDatasetDetail(selectedDatasetId);
        setDatasetDetail(detail);
      } catch (err: any) {
        console.error('Failed to load dataset detail:', err);
      }
    };
    fetchDetail();
  }, [selectedDatasetId]);

  // Load run detail when selected
  useEffect(() => {
    if (!selectedRunId) {
      setRunDetail(null);
      return;
    }
    const fetchRun = async () => {
      try {
        const detail = await api.getValidationRunDetail(selectedRunId);
        setRunDetail(detail);
      } catch (err: any) {
        console.error('Failed to load run detail:', err);
      }
    };
    fetchRun();
  }, [selectedRunId]);

  // Initial load
  useEffect(() => {
    loadDatasets();
    loadRuns();
  }, [project?.id]);

  // Seed sample dataset
  const handleSeedSample = async () => {
    if (!project) return;
    try {
      setLoadingDatasets(true);
      const ds = await api.seedSampleValidationDataset(project.id);
      showNotify('success', `Created sample dataset "${ds.name}" with 30 cases.`);
      await loadDatasets();
      setSelectedDatasetId(ds.id);
      // Auto-trigger a validation run for this new dataset
      handleTriggerRun(ds.id, true, true);
    } catch (err: any) {
      showNotify('error', `Failed to seed dataset: ${err.message}`);
    } finally {
      setLoadingDatasets(false);
    }
  };

  // Trigger validation run
  const handleTriggerRun = async (datasetId?: string, incUnreviewed = includeUnreviewed, mock = forceMock) => {
    const targetDatasetId = datasetId || selectedDatasetId;
    if (!project || !targetDatasetId) {
      showNotify('error', 'Please select a dataset to validate');
      return;
    }

    try {
      setRunningValidation(true);
      const run = await api.startValidationRun(project.id, {
        dataset_id: targetDatasetId,
        include_unreviewed: incUnreviewed,
        force_mock: mock,
      });
      showNotify('success', `Validation run completed! Overall accuracy: ${run.results_summary?.overall?.accuracy ?? 100}%`);
      setShowRunConfigModal(false);
      await loadRuns();
      setSelectedRunId(run.id);
      setSubTab('benchmark');
    } catch (err: any) {
      showNotify('error', `Validation run failed: ${err.message}`);
    } finally {
      setRunningValidation(false);
    }
  };

  // Create custom dataset
  const handleCreateDataset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !newDatasetName.trim()) return;
    try {
      setCreatingDataset(true);
      const ds = await api.createValidationDataset(project.id, {
        name: newDatasetName.trim(),
        description: newDatasetDesc.trim(),
      });
      showNotify('success', `Validation dataset "${ds.name}" created!`);
      setNewDatasetName('');
      setNewDatasetDesc('');
      setShowNewDatasetModal(false);
      await loadDatasets();
      setSelectedDatasetId(ds.id);
      setSubTab('datasets');
    } catch (err: any) {
      showNotify('error', `Failed to create dataset: ${err.message}`);
    } finally {
      setCreatingDataset(false);
    }
  };

  // Delete dataset
  const handleDeleteDataset = async (datasetId: string, name: string) => {
    if (!window.confirm(`Delete validation dataset "${name}" and all its cases?`)) return;
    try {
      await api.deleteValidationDataset(datasetId);
      showNotify('success', `Dataset "${name}" deleted.`);
      await loadDatasets();
      if (selectedDatasetId === datasetId) {
        setSelectedDatasetId(null);
      }
    } catch (err: any) {
      showNotify('error', `Failed to delete dataset: ${err.message}`);
    }
  };

  // Quick review status toggle for a case
  const handleUpdateCaseStatus = async (caseId: string, newStatus: 'provisional' | 'reviewed' | 'disputed') => {
    try {
      const updated = await api.updateValidationCase(caseId, {
        review_status: newStatus,
        reviewed_by: 'QA Engineer',
      });
      showNotify('success', `Case status updated to ${newStatus}`);
      // Refresh dataset detail
      if (selectedDatasetId) {
        const detail = await api.getValidationDatasetDetail(selectedDatasetId);
        setDatasetDetail(detail);
      }
      if (inspectCase?.caseData?.id === caseId) {
        setInspectCase({
          ...inspectCase,
          caseData: updated,
        });
      }
    } catch (err: any) {
      showNotify('error', `Failed to update case: ${err.message}`);
    }
  };

  // Filtered case results for active run
  const filteredCaseResults = (runDetail?.case_results || []).filter((cr) => {
    if (selectedMetricFilter !== 'all' && cr.metric.toLowerCase() !== selectedMetricFilter.toLowerCase()) {
      return false;
    }
    if (agreementFilter === 'match' && cr.agreement !== true) return false;
    if (agreementFilter === 'mismatch' && cr.agreement !== false) return false;
    if (caseReviewFilter === 'reviewed' && cr.review_status !== 'reviewed') return false;
    if (caseReviewFilter === 'provisional' && cr.review_status !== 'provisional') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchQ = cr.question.toLowerCase().includes(q);
      const matchCat = cr.category?.toLowerCase().includes(q);
      const matchAns = cr.model_answer.toLowerCase().includes(q);
      if (!matchQ && !matchCat && !matchAns) return false;
    }
    return true;
  });

  // Filtered dataset cases for cases review tab
  const filteredDatasetCases = (datasetDetail?.cases || []).filter((c) => {
    if (statusFilter !== 'all' && c.review_status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchQ = c.question.toLowerCase().includes(q);
      const matchCat = c.category?.toLowerCase().includes(q);
      const matchAns = c.model_answer.toLowerCase().includes(q);
      if (!matchQ && !matchCat && !matchAns) return false;
    }
    return true;
  });

  // Overall calculations with strict verified vs provisional separation
  const overallSummary = (runDetail?.results_summary as any)?.overall;
  const verifiedAccuracy = overallSummary?.verified_accuracy ?? null;
  const provisionalAgreement = overallSummary?.provisional_accuracy ?? null;
  const hasReviewedCases = (runDetail?.reviewed_cases ?? 0) > 0;
  const isInsufficient = overallSummary?.has_insufficient_reviewed ?? ((runDetail?.reviewed_cases ?? 0) < 5);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border text-sm font-medium transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-500 text-white border-emerald-600'
              : 'bg-rose-500 text-white border-rose-600'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Ground Truth Validation</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                  Calibrated
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Benchmark evaluation metric accuracy against human-reviewed ground truth labels for "{project?.name}".
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {datasets.length === 0 && (
            <button
              onClick={handleSeedSample}
              disabled={loadingDatasets}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all hover:shadow"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Seed 30 Sample Cases</span>
            </button>
          )}

          <button
            onClick={() => setShowRunConfigModal(true)}
            disabled={runningValidation || datasets.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all hover:shadow disabled:opacity-50"
          >
            {runningValidation ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Validating Metrics...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Validation</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowNewDatasetModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-500" />
            <span>New Dataset</span>
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 text-sm">
        <button
          onClick={() => setSubTab('benchmark')}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition-all ${
            subTab === 'benchmark'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Benchmark & Metrics Accuracy</span>
          {runDetail && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-mono">
              {verifiedAccuracy !== null
                ? `${verifiedAccuracy}% Verified`
                : provisionalAgreement !== null
                ? `${provisionalAgreement}% Provisional`
                : 'Done'}
            </span>
          )}
        </button>

        <button
          onClick={() => setSubTab('cases')}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition-all ${
            subTab === 'cases'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Ground Truth Cases & Human Review</span>
          {datasetDetail && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
              {datasetDetail.cases.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setSubTab('datasets')}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition-all ${
            subTab === 'datasets'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Validation Datasets</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
            {datasets.length}
          </span>
        </button>
      </div>

      {/* Empty State when no datasets exist */}
      {datasets.length === 0 && !loadingDatasets && (
        <div className="p-8 md:p-12 rounded-2xl bg-gradient-to-br from-indigo-50/50 via-white to-slate-50 dark:from-indigo-950/20 dark:via-slate-900/60 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/40 text-center space-y-6 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className="max-w-xl mx-auto space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Calibrate and Validate Your Metric Engine
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Ground truth validation lets you ensure that LLM evaluation metrics (Correctness, Relevance,
              Faithfulness, Hallucination) reliably agree with verified human expert judgments before trusting
              eval outputs in CI/CD or production.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleSeedSample}
              disabled={loadingDatasets}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md transition-all hover:shadow-indigo-500/20"
            >
              <Sparkles className="w-4 h-4" />
              <span>Seed 30 Sample Benchmark Cases</span>
            </button>
            <button
              onClick={() => setShowNewDatasetModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-sm shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4 text-indigo-500" />
              <span>Create Empty Dataset</span>
            </button>
          </div>
        </div>
      )}

      {/* SUBTAB 1: BENCHMARK & METRICS ACCURACY */}
      {subTab === 'benchmark' && datasets.length > 0 && (
        <div className="space-y-6">
          {/* Notice banner when reviewed cases are insufficient */}
          {runDetail && isInsufficient && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3 shadow-sm animate-in fade-in">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <span className="font-bold text-sm block">Notice: Provisional Ground Truth Benchmark</span>
                <p className="leading-relaxed">
                  {overallSummary?.status_notice ||
                    `Only ${runDetail.reviewed_cases} of ${runDetail.total_cases} cases are human-reviewed. Results are marked PROVISIONAL and cannot be certified as VALIDATED until at least 5 reviewed ground-truth cases are completed per metric.`}
                </p>
              </div>
              <button
                onClick={() => setSubTab('cases')}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors shrink-0 shadow-sm"
              >
                Review Cases Now
              </button>
            </div>
          )}

          {/* Top Run Selector & Overall Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Run Selection Card */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Active Validation Run
                </label>
                <select
                  value={selectedRunId || ''}
                  disabled={loadingRuns}
                  onChange={(e) => setSelectedRunId(e.target.value)}
                  className="w-full text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {runs.map((r, i) => (
                    <option key={r.id} value={r.id}>
                      Run #{runs.length - i} • {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({r.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Cases Evaluated:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {runDetail?.total_cases ?? 0}
                </span>
              </div>
            </div>

            {/* Overall Accuracy Card - Clearly labeled as Verified or Provisional */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold uppercase tracking-wider">
                  {hasReviewedCases && verifiedAccuracy !== null ? 'Verified Accuracy' : 'Provisional Agreement'}
                </span>
                <TrendingUp className={`w-4 h-4 ${hasReviewedCases ? 'text-emerald-500' : 'text-amber-500'}`} />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {hasReviewedCases && verifiedAccuracy !== null
                    ? `${verifiedAccuracy}%`
                    : provisionalAgreement !== null
                    ? `${provisionalAgreement}%`
                    : 'N/A'}
                </span>
                <span className={`text-xs font-medium ${hasReviewedCases ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {hasReviewedCases ? 'Verified ground truth' : 'Provisional rate'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {hasReviewedCases && verifiedAccuracy !== null
                  ? `Calibrated against ${overallSummary?.reviewed_comparisons ?? 0} reviewed cases`
                  : `Based on ${overallSummary?.provisional_comparisons ?? 29} unreviewed cases • Not verified accuracy`}
              </p>
              <div className="mt-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${hasReviewedCases ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min((hasReviewedCases ? verifiedAccuracy : provisionalAgreement) || 0, 100)}%` }}
                />
              </div>
            </div>

            {/* Review Coverage Card */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold uppercase tracking-wider">Ground Truth Review</span>
                <FileCheck className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {runDetail?.reviewed_cases ?? 0}
                  <span className="text-sm font-normal text-slate-400"> / {runDetail?.total_cases ?? 0}</span>
                </span>
                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  Reviewed
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {(runDetail?.total_cases ?? 0) - (runDetail?.reviewed_cases ?? 0)} provisional case(s) remaining
              </p>
              <div className="mt-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      Math.round(((runDetail?.reviewed_cases ?? 0) / Math.max(1, runDetail?.total_cases ?? 1)) * 100),
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Validation Certification Status Card */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold uppercase tracking-wider">Validation State</span>
                <Cpu className="w-4 h-4 text-purple-500" />
              </div>
              <div className="mt-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold uppercase tracking-wider ${
                    overallSummary?.status === 'validated'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-400 dark:border-emerald-800'
                      : overallSummary?.status === 'insufficient_data'
                      ? 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/70 dark:text-orange-400 dark:border-orange-800'
                      : overallSummary?.status === 'needs_calibration'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/70 dark:text-rose-400 dark:border-rose-800'
                      : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/70 dark:text-amber-400 dark:border-amber-800'
                  }`}
                >
                  {overallSummary?.status === 'validated' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  <span>{overallSummary?.status ?? 'PROVISIONAL'}</span>
                </span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                {overallSummary?.status_notice ||
                  'Metrics cannot be marked VALIDATED until reviewed against human ground truth.'}
              </p>
            </div>
          </div>

          {/* Metric Dimensions Cards Grid */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-500" />
                  <span>Metric Calibration & Confusion Matrices</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Confusion matrices are computed strictly from eligible pass/fail cases. Excluded cases (e.g. absent context) are documented in sample size notes.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(runDetail?.metric_results || []).map((m) => {
                const isMetricValidated = m.status === 'validated';
                const isInsufficient = m.status === 'insufficient_data';
                const hasReviewed = m.reviewed_count > 0;

                return (
                  <div
                    key={m.metric_name}
                    className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors flex flex-col justify-between"
                  >
                    <div>
                      {/* Metric Header & Status Badge */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold capitalize text-slate-900 dark:text-white">
                          {m.metric_name}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold uppercase ${
                            isMetricValidated
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-400 dark:border-emerald-800'
                              : isInsufficient
                              ? 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/70 dark:text-orange-400 dark:border-orange-800'
                              : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/70 dark:text-amber-400 dark:border-amber-800'
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>

                      {/* Status Notice Pill */}
                      {m.status_notice && (
                        <div className="mt-1.5 p-1.5 rounded bg-slate-50 dark:bg-slate-800/60 text-[10px] text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800 flex items-start gap-1.5">
                          <Info className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                          <span>{m.status_notice}</span>
                        </div>
                      )}

                      {/* Accuracy Scores (Verified vs Provisional) */}
                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Verified Accuracy:</span>
                          <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                            {m.accuracy !== null ? `${m.accuracy}%` : '—'}
                          </span>
                        </div>
                        {m.provisional_accuracy !== null && m.provisional_accuracy !== undefined && (
                          <div className="flex items-baseline justify-between text-xs">
                            <span className="text-slate-400 font-medium">Provisional Agreement:</span>
                            <span className="font-semibold font-mono text-amber-600 dark:text-amber-400">
                              {m.provisional_accuracy}%
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Secondary Metrics */}
                      <div className="grid grid-cols-3 gap-1.5 text-center text-xs border-t border-slate-100 dark:border-slate-800 pt-2 font-mono">
                        <div className="p-1 rounded bg-slate-50 dark:bg-slate-800/60">
                          <span className="text-[9px] text-slate-400 block font-sans">Prec</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {hasReviewed && m.precision !== null
                              ? `${m.precision}%`
                              : m.provisional_precision !== null && m.provisional_precision !== undefined
                              ? `${m.provisional_precision}%*`
                              : '—'}
                          </span>
                        </div>
                        <div className="p-1 rounded bg-slate-50 dark:bg-slate-800/60">
                          <span className="text-[9px] text-slate-400 block font-sans">Recall</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {hasReviewed && m.recall !== null
                              ? `${m.recall}%`
                              : m.provisional_recall !== null && m.provisional_recall !== undefined
                              ? `${m.provisional_recall}%*`
                              : '—'}
                          </span>
                        </div>
                        <div className="p-1 rounded bg-slate-50 dark:bg-slate-800/60">
                          <span className="text-[9px] text-slate-400 block font-sans">F1</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {hasReviewed && m.f1_score !== null
                              ? `${m.f1_score}%`
                              : m.provisional_f1_score !== null && m.provisional_f1_score !== undefined
                              ? `${m.provisional_f1_score}%*`
                              : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Confusion Matrix Mini-Grid with Denominators */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                          <span>
                            Confusion Matrix ({hasReviewed ? `Verified: ${m.reviewed_sample_count ?? 0}` : `Provisional: ${m.provisional_sample_count ?? 0}`})
                          </span>
                          <span>MAE: {hasReviewed && m.mae !== null ? m.mae : m.provisional_mae ?? '—'}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-center font-mono text-[11px]">
                          <div className="p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300">
                            <span className="text-[9px] block text-emerald-600/70 font-sans">TP (Agree Pass)</span>
                            <span className="font-bold">
                              {hasReviewed ? m.true_positives : m.provisional_true_positives ?? 0}
                            </span>
                          </div>
                          <div className="p-1.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300">
                            <span className="text-[9px] block text-rose-600/70 font-sans">FP (Type I)</span>
                            <span className="font-bold">
                              {hasReviewed ? m.false_positives : m.provisional_false_positives ?? 0}
                            </span>
                          </div>
                          <div className="p-1.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300">
                            <span className="text-[9px] block text-rose-600/70 font-sans">FN (Type II)</span>
                            <span className="font-bold">
                              {hasReviewed ? m.false_negatives : m.provisional_false_negatives ?? 0}
                            </span>
                          </div>
                          <div className="p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300">
                            <span className="text-[9px] block text-emerald-600/70 font-sans">TN (Agree Fail)</span>
                            <span className="font-bold">
                              {hasReviewed ? m.true_negatives : m.provisional_true_negatives ?? 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sample Size & Denominator Explanation Box */}
                    {m.sample_size_explanation && (
                      <div className="mt-3 p-2 rounded bg-slate-50 dark:bg-slate-800/70 text-[10px] text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800/80 leading-relaxed">
                        <span className="font-bold block text-slate-700 dark:text-slate-300 mb-0.5">Sample Size:</span>
                        {m.sample_size_explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deep-Dive Case-by-Case Comparison Table */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Validation Test Results by Case</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                    Showing {filteredCaseResults.length} of {runDetail?.case_results?.length ?? 0} rows
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Comparison of ground truth expected labels against metric predictions ({runDetail?.reviewed_cases ?? 0} reviewed, {(runDetail?.total_cases ?? 0) - (runDetail?.reviewed_cases ?? 0)} provisional).
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Review Status Filter */}
                <select
                  value={caseReviewFilter}
                  onChange={(e) => setCaseReviewFilter(e.target.value as any)}
                  className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Review Statuses</option>
                  <option value="reviewed">Reviewed Cases Only</option>
                  <option value="provisional">Provisional Cases Only</option>
                </select>

                {/* Metric Filter */}
                <select
                  value={selectedMetricFilter}
                  onChange={(e) => setSelectedMetricFilter(e.target.value)}
                  className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Metrics</option>
                  <option value="correctness">Correctness</option>
                  <option value="relevance">Relevance</option>
                  <option value="faithfulness">Faithfulness</option>
                  <option value="hallucination">Hallucination</option>
                </select>

                {/* Agreement Filter */}
                <select
                  value={agreementFilter}
                  onChange={(e) => setAgreementFilter(e.target.value as any)}
                  className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Outcomes</option>
                  <option value="match">Agreement (Match)</option>
                  <option value="mismatch">Discrepancy (Mismatch)</option>
                </select>

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search question / category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44 sm:w-56"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Question / Input</th>
                    <th className="py-2.5 px-3">Metric</th>
                    <th className="py-2.5 px-3">Review Status</th>
                    <th className="py-2.5 px-3">Ground Truth</th>
                    <th className="py-2.5 px-3">Metric Prediction</th>
                    <th className="py-2.5 px-3">Agreement</th>
                    <th className="py-2.5 px-3">Score Error</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                  {filteredCaseResults.map((cr, idx) => (
                    <tr
                      key={`${cr.case_id}-${cr.metric}-${idx}`}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      onClick={() => setInspectCase({ resultData: cr })}
                    >
                      <td className="py-3 px-3 max-w-xs">
                        <div className="font-medium text-slate-900 dark:text-slate-100 line-clamp-2">
                          {cr.question}
                        </div>
                        {cr.category && (
                          <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                            {cr.category}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold capitalize text-slate-700 dark:text-slate-300">
                          {cr.metric}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-mono font-semibold uppercase tracking-wider ${
                            cr.review_status === 'reviewed'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                              : cr.review_status === 'disputed'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
                          }`}
                        >
                          {cr.review_status === 'reviewed' ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Info className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          )}
                          <span>{cr.review_status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 font-mono">
                          {cr.expected_pass !== null ? (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                cr.expected_pass
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {cr.expected_pass ? 'PASS' : 'FAIL'}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 font-mono">
                              N/A
                            </span>
                          )}
                          <span className="text-slate-500">
                            {cr.expected_score !== null ? `${cr.expected_score}` : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 font-mono">
                          {cr.predicted_pass !== null ? (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                cr.predicted_pass
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {cr.predicted_pass ? 'PASS' : 'FAIL'}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 font-mono">
                              N/A
                            </span>
                          )}
                          <span className="text-slate-500">
                            {cr.predicted_score !== null ? `${Math.round(cr.predicted_score * 10) / 10}` : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {cr.agreement === true ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Matched</span>
                          </span>
                        ) : cr.agreement === false ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Mismatch</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                            <Info className="w-3 h-3" />
                            <span>N/A (Excluded)</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                        {cr.score_error !== null ? `Δ ${Math.round(cr.score_error * 10) / 10}` : '-'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectCase({ resultData: cr });
                          }}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition-colors"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredCaseResults.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No cases match the selected metric or filter criteria.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: GROUND TRUTH CASES & HUMAN REVIEW */}
      {subTab === 'cases' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Dataset Cases Review
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Inspect, review, and confirm ground truth labels. Reviewed cases form the golden benchmark.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Review Statuses</option>
                <option value="provisional">Provisional</option>
                <option value="reviewed">Reviewed</option>
                <option value="disputed">Disputed</option>
              </select>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search cases..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48"
                />
              </div>
            </div>
          </div>

          {/* Cases List */}
          <div className="space-y-3">
            {filteredDatasetCases.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                          c.review_status === 'reviewed'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                            : c.review_status === 'disputed'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                        }`}
                      >
                        {c.review_status}
                      </span>
                      {c.category && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                          {c.category}
                        </span>
                      )}
                      {c.reviewed_by && (
                        <span className="text-[11px] text-slate-400">
                          Reviewed by {c.reviewed_by}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white pt-1">
                      {c.question}
                    </h4>
                  </div>

                  {/* Quick Review Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {c.review_status !== 'reviewed' && (
                      <button
                        onClick={() => handleUpdateCaseStatus(c.id, 'reviewed')}
                        className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:hover:bg-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirm Review</span>
                      </button>
                    )}
                    {c.review_status !== 'disputed' && (
                      <button
                        onClick={() => handleUpdateCaseStatus(c.id, 'disputed')}
                        className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:hover:bg-rose-900 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Dispute</span>
                      </button>
                    )}
                    <button
                      onClick={() => setInspectCase({ caseData: c })}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
                    >
                      Details
                    </button>
                  </div>
                </div>

                {/* Expected Labels Chips */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-[11px] text-slate-400 font-medium">Expected Labels:</span>
                  {Object.entries(c.expected_labels || {}).map(([metricName, label]) => (
                    <span
                      key={metricName}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
                    >
                      <span className="font-sans capitalize text-slate-600 dark:text-slate-300">{metricName}:</span>
                      <span
                        className={`font-bold ${
                          label.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {label.passed ? 'PASS' : 'FAIL'}
                      </span>
                      {label.score !== null && (
                        <span className="text-slate-400">({label.score})</span>
                      )}
                    </span>
                  ))}
                </div>

                {/* Model Answer Preview */}
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-700 dark:text-slate-300">
                  <span className="text-slate-400 font-semibold block mb-0.5">Model Output under test:</span>
                  <p className="line-clamp-2">{c.model_answer}</p>
                </div>
              </div>
            ))}

            {filteredDatasetCases.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs">
                No cases found for the selected review status.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: VALIDATION DATASETS */}
      {subTab === 'datasets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Validation Datasets ({datasets.length})
            </h3>
            <button
              onClick={() => setShowNewDatasetModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Dataset</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {datasets.map((ds) => (
              <div
                key={ds.id}
                className={`p-4 rounded-xl border transition-all ${
                  selectedDatasetId === ds.id
                    ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{ds.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {ds.description || 'No description provided.'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteDataset(ds.id, ds.name)}
                    className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                    title="Delete dataset"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">Cases: {ds.case_count}</span>
                  <span className="text-emerald-600 dark:text-emerald-400">Reviewed: {ds.reviewed_count}</span>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedDatasetId(ds.id);
                      setSubTab('benchmark');
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition-colors"
                  >
                    View Benchmark
                  </button>
                  <button
                    onClick={() => {
                      setSelectedDatasetId(ds.id);
                      setSubTab('cases');
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
                  >
                    Review Cases
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: RUN VALIDATION CONFIG */}
      {showRunConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-indigo-600 fill-current" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Run Ground Truth Validation</h3>
              </div>
              <button
                onClick={() => setShowRunConfigModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Select Dataset
                </label>
                <select
                  value={selectedDatasetId || ''}
                  onChange={(e) => setSelectedDatasetId(e.target.value)}
                  className="w-full text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.case_count} cases, {d.reviewed_count} reviewed)
                    </option>
                  ))}
                </select>
              </div>

              {/* Options */}
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeUnreviewed}
                    onChange={(e) => setIncludeUnreviewed(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                      Include Provisional (Unreviewed) Cases
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      When enabled, evaluates all 30 sample cases even before human sign-off.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceMock}
                    onChange={(e) => setForceMock(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                      Deterministic Local Evaluation Mode (Fast)
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Executes deterministic regex, keyword, and local logic without consuming OpenAI API credits.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowRunConfigModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleTriggerRun()}
                disabled={runningValidation}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all flex items-center gap-2"
              >
                {runningValidation ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing Run...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start Validation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE VALIDATION DATASET */}
      {showNewDatasetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleCreateDataset}
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Create Validation Dataset</h3>
              <button
                type="button"
                onClick={() => setShowNewDatasetModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Dataset Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3 Customer Support Golden Set"
                  value={newDatasetName}
                  onChange={(e) => setNewDatasetName(e.target.value)}
                  className="w-full text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Purpose, domain, and review guidelines for this validation set..."
                  value={newDatasetDesc}
                  onChange={(e) => setNewDatasetDesc(e.target.value)}
                  className="w-full text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowNewDatasetModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingDataset || !newDatasetName.trim()}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all disabled:opacity-50"
              >
                {creatingDataset ? 'Creating...' : 'Create Dataset'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DRAWER / MODAL: INSPECT CASE DETAIL */}
      {inspectCase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Validation Case Inspector</h3>
              </div>
              <button
                onClick={() => setInspectCase(null)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Case Details */}
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-400 uppercase tracking-wider block text-[10px]">
                  Question / User Input
                </span>
                <p className="mt-1 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 font-medium">
                  {inspectCase.resultData?.question || inspectCase.caseData?.question}
                </p>
              </div>

              {(inspectCase.resultData?.reference_answer || inspectCase.caseData?.reference_answer) && (
                <div>
                  <span className="font-semibold text-slate-400 uppercase tracking-wider block text-[10px]">
                    Reference / Ground Truth Answer
                  </span>
                  <p className="mt-1 p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 border border-emerald-100 dark:border-emerald-800/40">
                    {inspectCase.resultData?.reference_answer || inspectCase.caseData?.reference_answer}
                  </p>
                </div>
              )}

              {(inspectCase.resultData?.reference_context || inspectCase.caseData?.reference_context) && (
                <div>
                  <span className="font-semibold text-slate-400 uppercase tracking-wider block text-[10px]">
                    Reference Context
                  </span>
                  <p className="mt-1 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                    {inspectCase.resultData?.reference_context || inspectCase.caseData?.reference_context}
                  </p>
                </div>
              )}

              <div>
                <span className="font-semibold text-slate-400 uppercase tracking-wider block text-[10px]">
                  Model Output Under Evaluation
                </span>
                <p className="mt-1 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100">
                  {inspectCase.resultData?.model_answer || inspectCase.caseData?.model_answer}
                </p>
              </div>

              {/* Evaluator Output & Agreement */}
              {inspectCase.resultData && (
                <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-900 dark:text-indigo-300 capitalize text-sm">
                      {inspectCase.resultData.metric} Metric Calibration
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        inspectCase.resultData.agreement
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400'
                      }`}
                    >
                      {inspectCase.resultData.agreement ? 'Agreement Confirmed' : 'Calibration Mismatch'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 font-mono">
                    <div className="p-2 rounded bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/40">
                      <span className="text-[10px] text-slate-400 font-sans block">Ground Truth Expected</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {inspectCase.resultData.expected_pass ? 'PASS' : 'FAIL'} (Score: {inspectCase.resultData.expected_score ?? 'N/A'})
                      </span>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/40">
                      <span className="text-[10px] text-slate-400 font-sans block">Metric Engine Prediction</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {inspectCase.resultData.predicted_pass ? 'PASS' : 'FAIL'} (Score: {inspectCase.resultData.predicted_score ?? 'N/A'})
                      </span>
                    </div>
                  </div>

                  {inspectCase.resultData.predicted_reason && (
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Evaluator Reasoning
                      </span>
                      <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
                        {inspectCase.resultData.predicted_reason}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setInspectCase(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
