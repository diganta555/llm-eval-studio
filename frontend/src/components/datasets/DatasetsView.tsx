import React, { useState, useEffect } from 'react';
import {
  Database,
  Upload,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Eye,
  Plus,
  Sparkles,
  Search,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import type { Dataset, DatasetDetail, DatasetImportPreview, Project } from '../../types';
import { api } from '../../services/api';

interface DatasetsViewProps {
  project: Project | null;
  onNewRunForDataset?: (datasetId: string) => void;
}

export const DatasetsView: React.FC<DatasetsViewProps> = ({ project, onNewRunForDataset }) => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDatasetDetail, setSelectedDatasetDetail] = useState<DatasetDetail | null>(null);
  const [, setLoadingDetail] = useState(false);

  // Upload/Create Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [datasetName, setDatasetName] = useState('');
  const [inputMode, setInputMode] = useState<'upload' | 'paste'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [preview, setPreview] = useState<DatasetImportPreview | null>(null);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');

  const loadDatasets = async () => {
    if (!project) return;
    try {
      setLoading(true);
      const data = await api.getDatasets(project.id);
      setDatasets(data);
    } catch (err: any) {
      console.error('Failed to load datasets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatasets();
  }, [project?.id]);

  const handleSeedDemo = async () => {
    if (!project) return;
    try {
      setLoading(true);
      await api.seedDemoDataset(project.id);
      await loadDatasets();
    } catch (err: any) {
      alert(`Failed to seed demo dataset: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleValidatePreview = async () => {
    try {
      setValidating(true);
      let res: DatasetImportPreview;
      if (inputMode === 'upload' && selectedFile) {
        res = await api.previewDataset(selectedFile, undefined, selectedFile.name.endsWith('.csv') ? 'csv' : 'json');
      } else if (inputMode === 'paste' && rawText.trim()) {
        res = await api.previewDataset(undefined, rawText.trim(), 'json');
      } else {
        alert('Please provide a file or paste dataset JSON content first.');
        return;
      }
      setPreview(res);
    } catch (err: any) {
      alert(`Validation error: ${err.message}`);
    } finally {
      setValidating(false);
    }
  };

  const handleCreateDataset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !datasetName.trim()) return;

    try {
      setSubmitting(true);
      if (inputMode === 'upload' && selectedFile) {
        await api.uploadDatasetFile(project.id, datasetName.trim(), selectedFile);
      } else if (preview && preview.preview_cases.length > 0) {
        await api.createDataset(project.id, datasetName.trim(), preview.preview_cases, 'raw_paste.json');
      } else {
        alert('Please validate the dataset content before submitting.');
        return;
      }
      setShowCreateModal(false);
      resetModal();
      await loadDatasets();
    } catch (err: any) {
      alert(`Error creating dataset: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const resetModal = () => {
    setDatasetName('');
    setSelectedFile(null);
    setRawText('');
    setPreview(null);
  };

  const handleViewDetails = async (datasetId: string) => {
    try {
      setLoadingDetail(true);
      const detail = await api.getDatasetDetail(datasetId);
      setSelectedDatasetDetail(detail);
    } catch (err: any) {
      alert(`Failed to load dataset details: ${err.message}`);
    } finally {
      setLoadingDetail(false);
    }
  };

  const sampleJsonTemplate = JSON.stringify(
    [
      {
        external_id: "case-001",
        question: "What is the capital of France?",
        expected_answer: "The capital of France is Paris.",
        context: "France is a country located in Western Europe. Its capital and largest city is Paris.",
        category: "geography"
      },
      {
        external_id: "case-002",
        question: "Explain the purpose of evaluation in LLM workflows.",
        expected_answer: "Evaluation measures model accuracy, grounding, and detects hallucinations before production.",
        context: "Evaluation systems score LLM responses using deterministic assertions and model judges.",
        category: "ai_engineering"
      }
    ],
    null,
    2
  );

  const filteredCases = selectedDatasetDetail?.test_cases.filter(
    (c) =>
      c.question.toLowerCase().includes(caseSearch.toLowerCase()) ||
      c.external_id.toLowerCase().includes(caseSearch.toLowerCase()) ||
      (c.category && c.category.toLowerCase().includes(caseSearch.toLowerCase()))
  ) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Evaluation Datasets</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Immutable versioned benchmark sets containing questions, expected answers, and reference context.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSeedDemo}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors shadow-sm"
            title="Import demo benchmark with 10 questions"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span>Seed Demo Benchmark</span>
          </button>
          <button
            onClick={() => {
              setShowCreateModal(true);
              resetModal();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Import Dataset</span>
          </button>
        </div>
      </div>

      {/* Dataset List Cards */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400">Loading datasets...</div>
      ) : datasets.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">No datasets found in this project</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              Upload your custom JSON/CSV evaluation suite or quickly load our pre-built demo benchmark.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleSeedDemo}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Load Demo Benchmark</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
            >
              Upload Custom File
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {datasets.map((d) => (
            <div
              key={d.id}
              className="p-5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 group shadow-sm"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                    {d.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                    v{d.version}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
                  <span>{d.test_case_count} test cases</span>
                  {d.source_filename && (
                    <>
                      <span>•</span>
                      <span className="truncate max-w-[140px] text-slate-400">{d.source_filename}</span>
                    </>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  Created {new Date(d.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  onClick={() => handleViewDetails(d.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Inspect Cases</span>
                </button>
                {onNewRunForDataset && (
                  <button
                    onClick={() => onNewRunForDataset(d.id)}
                    className="py-1.5 px-3 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 hover:bg-indigo-100 dark:hover:bg-indigo-600/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-500/30 transition-colors"
                  >
                    Eval Run
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dataset Detail / Inspector Drawer */}
      {selectedDatasetDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col p-6 overflow-hidden shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedDatasetDetail.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-mono border border-indigo-200 dark:border-indigo-800">
                    v{selectedDatasetDetail.version}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {selectedDatasetDetail.test_case_count} total test cases • Source: {selectedDatasetDetail.source_filename || 'manual'}
                </p>
              </div>
              <button
                onClick={() => setSelectedDatasetDetail(null)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search filter */}
            <div className="py-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search test questions, categories, or IDs..."
                  value={caseSearch}
                  onChange={(e) => setCaseSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Cases list */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {filteredCases.map((tc, idx) => (
                <div key={tc.id || idx} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{tc.external_id}</span>
                    {tc.category && (
                      <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 text-[10px] font-mono">
                        {tc.category}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Question:</span>
                    <p className="text-slate-900 dark:text-slate-200 mt-0.5 font-medium">{tc.question}</p>
                  </div>
                  {tc.expected_answer && (
                    <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40">
                      <span className="text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold">Expected Answer:</span>
                      <p className="text-slate-700 dark:text-slate-300 mt-0.5 text-[11px]">{tc.expected_answer}</p>
                    </div>
                  )}
                  {tc.context && (
                    <div className="p-2.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900/40">
                      <span className="text-cyan-700 dark:text-cyan-400 text-[11px] font-semibold">Reference Context (Ground Truth):</span>
                      <p className="text-slate-700 dark:text-slate-300 mt-0.5 text-[11px]">{tc.context}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Drawer Footer */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedDatasetDetail(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload / Create Modal with Live Validation & Preview */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Import Evaluation Dataset</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Validate schema and preview rows before creating an immutable dataset version.</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDataset} className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Dataset Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Legal Q&A Benchmark v1"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Toggle Input Mode */}
              <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setInputMode('upload');
                    setPreview(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-2 transition-all ${
                    inputMode === 'upload' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>File Upload (JSON / CSV)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputMode('paste');
                    if (!rawText) setRawText(sampleJsonTemplate);
                    setPreview(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-2 transition-all ${
                    inputMode === 'paste' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Paste JSON Text</span>
                </button>
              </div>

              {/* Mode 1: File Upload */}
              {inputMode === 'upload' && (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center hover:border-indigo-500 transition-colors bg-slate-50 dark:bg-transparent">
                    <input
                      type="file"
                      id="dataset-file-input"
                      accept=".json,.csv"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedFile(e.target.files[0]);
                          if (!datasetName) {
                            setDatasetName(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                          }
                          setPreview(null);
                        }
                      }}
                      className="hidden"
                    />
                    <label htmlFor="dataset-file-input" className="cursor-pointer space-y-2 block">
                      <FileSpreadsheet className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mx-auto" />
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {selectedFile ? selectedFile.name : 'Click to select JSON or CSV file'}
                      </div>
                      <p className="text-[11px] text-slate-500">Supports standard JSON array or CSV with question, expected_answer, context columns.</p>
                    </label>
                  </div>
                </div>
              )}

              {/* Mode 2: Paste JSON */}
              {inputMode === 'paste' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">JSON Test Cases Array</label>
                    <button
                      type="button"
                      onClick={() => setRawText(sampleJsonTemplate)}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                    >
                      Insert Example Schema
                    </button>
                  </div>
                  <textarea
                    rows={7}
                    value={rawText}
                    onChange={(e) => {
                      setRawText(e.target.value);
                      setPreview(null);
                    }}
                    className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Validate & Preview Action */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleValidatePreview}
                  disabled={validating || (inputMode === 'upload' && !selectedFile) || (inputMode === 'paste' && !rawText.trim())}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{validating ? 'Validating...' : 'Validate & Preview Schema'}</span>
                </button>

                {preview && (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-4 h-4" /> {preview.valid_rows} Valid Rows
                    </span>
                    {preview.invalid_rows > 0 && (
                      <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-4 h-4" /> {preview.invalid_rows} Invalid
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Preview & Row-Level Errors */}
              {preview && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
                  {preview.validation_errors.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Row-Level Errors Detected:</span>
                      </div>
                      <ul className="list-disc list-inside text-[11px] text-rose-600 dark:text-rose-300">
                        {preview.validation_errors.slice(0, 5).map((err, i) => (
                          <li key={i}>
                            Row #{err.row_index + 1} {err.external_id ? `(${err.external_id})` : ''}: {err.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                    Preview First {preview.preview_cases.length} Test Cases:
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                    {preview.preview_cases.map((c, i) => (
                      <div key={i} className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]">
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{c.external_id}: </span>
                        <span className="text-slate-800 dark:text-slate-200">{c.question}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !datasetName.trim() || (inputMode === 'upload' && !selectedFile) || (inputMode === 'paste' && !rawText.trim())}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all disabled:opacity-50"
                >
                  {submitting ? 'Saving Dataset...' : 'Save & Import Dataset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
