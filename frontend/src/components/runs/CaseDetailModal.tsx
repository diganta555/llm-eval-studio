import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  Scale,
  UserCheck,
  Copy,
  ShieldCheck
} from 'lucide-react';
import type { CaseResult } from '../../types';
import { api } from '../../services/api';
import { MetricBadge } from '../common/MetricBadge';
import { StatusBadge } from '../common/StatusBadge';

interface CaseDetailModalProps {
  runId: string;
  caseResultId: string;
  onClose: () => void;
  onReviewAdded?: () => void;
}

export const CaseDetailModal: React.FC<CaseDetailModalProps> = ({
  runId,
  caseResultId,
  onClose,
  onReviewAdded,
}) => {
  const [detail, setDetail] = useState<CaseResult | null>(null);
  const [loading, setLoading] = useState(true);

  // Human review form
  const [humanScore, setHumanScore] = useState<number>(85);
  const [metricName, setMetricName] = useState<string>('overall');
  const [reviewerId, setReviewerId] = useState<string>('evaluator_1');
  const [comment, setComment] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadCaseDetail = async () => {
    try {
      setLoading(true);
      const data = await api.getCaseResultDetail(runId, caseResultId);
      setDetail(data);
    } catch (err: any) {
      console.error('Failed to load case detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCaseDetail();
  }, [runId, caseResultId]);

  const handleCopyOutput = () => {
    if (detail?.output_text) {
      navigator.clipboard.writeText(detail.output_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    try {
      setSubmittingReview(true);
      await api.submitHumanReview(runId, detail.id, {
        reviewer_id: reviewerId,
        metric_name: metricName,
        human_score: Number(humanScore),
        comment: comment.trim() || undefined,
      });
      setComment('');
      await loadCaseDetail();
      if (onReviewAdded) onReviewAdded();
    } catch (err: any) {
      alert(`Failed to save human review: ${err.message}`);
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Case Inspection & Evaluation Detail</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-mono font-semibold">
                  {detail?.external_id || 'Case'}
                </span>
                {detail && <StatusBadge status={detail.status} />}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Inspect generated LLM response, judge rubrics, and calibrate with human feedback.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading || !detail ? (
          <div className="p-16 text-center text-slate-500 dark:text-slate-400">Loading case details...</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Operational stats header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">Latency</span>
                <span className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-1 block">
                  {detail.latency_ms > 0 ? `${detail.latency_ms} ms` : '—'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">Prompt Tokens</span>
                <span className="text-sm font-bold font-mono text-slate-700 dark:text-slate-300 mt-1 block">
                  {detail.prompt_tokens ?? '—'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">Completion Tokens</span>
                <span className="text-sm font-bold font-mono text-slate-700 dark:text-slate-300 mt-1 block">
                  {detail.completion_tokens ?? '—'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">Total Tokens</span>
                <span className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1 block">
                  {detail.total_tokens ?? '—'}
                </span>
              </div>
            </div>

            {/* Error banner if failed */}
            {detail.error_message && (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Execution Error: {detail.error_code || 'PROVIDER_ERROR'}</div>
                  <div className="mt-1 font-mono text-[11px]">{detail.error_message}</div>
                </div>
              </div>
            )}

            {/* Test Case Inputs Grid */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Input Specification</h4>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 font-semibold block mb-1">User Question / Prompt:</span>
                  <div className="text-slate-900 dark:text-slate-100 font-medium text-sm leading-relaxed">
                    {detail.question}
                  </div>
                </div>

                {detail.input_snapshot?.context && (
                  <div className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900/40">
                    <span className="text-cyan-700 dark:text-cyan-400 text-[11px] font-semibold block mb-1">Reference Ground Truth Context:</span>
                    <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">{detail.input_snapshot.context}</p>
                  </div>
                )}

                {detail.input_snapshot?.expected_answer && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
                    <span className="text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold block mb-1">Expected Ground Truth Answer:</span>
                    <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">{detail.input_snapshot.expected_answer}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Target Model Output */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Target Model Output</h4>
                <button
                  onClick={handleCopyOutput}
                  className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copied!' : 'Copy Response'}</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-mono leading-relaxed whitespace-pre-wrap">
                {detail.output_text || <span className="text-slate-400 italic">No output generated</span>}
              </div>
            </div>

            {/* Evaluator & Metric Results */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>LLM Judge & Evaluator Breakdown</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {detail.metric_results.map((m) => (
                  <div key={m.id} className="p-4 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-slate-200 capitalize text-sm">{m.metric_name}</span>
                      <MetricBadge name={m.metric_name} score={m.score} showLabel={false} size="md" />
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-3">
                      <span>Judge: {m.evaluator_model || 'LLM Judge'}</span>
                      <span>•</span>
                      <span>Rubric v{m.rubric_version}</span>
                      {m.passed !== null && (
                        <>
                          <span>•</span>
                          <span className={m.passed ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-semibold'}>
                            {m.passed ? 'PASSED' : 'FAILED'}
                          </span>
                        </>
                      )}
                    </div>

                    {m.reason && (
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                        <span className="text-slate-500 font-semibold block mb-0.5">Judge Explanation & Rationale:</span>
                        {m.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Human Evaluation & Calibration Section */}
            <div className="p-5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/50 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Human Review & Evaluator Calibration</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Record ground-truth human judgments to calibrate and validate automated LLM judges.
                  </p>
                </div>
              </div>

              {/* Existing Reviews */}
              {detail.human_reviews && detail.human_reviews.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Past Human Reviews</span>
                  {detail.human_reviews.map((hr) => (
                    <div key={hr.id} className="p-3 rounded-lg bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs flex items-start justify-between gap-4 shadow-sm">
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {hr.reviewer_id} scored: <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{hr.human_score}%</span>
                          {hr.metric_name && <span className="text-slate-500 dark:text-slate-400 font-normal"> for {hr.metric_name}</span>}
                        </div>
                        {hr.comment && <p className="text-slate-600 dark:text-slate-400 mt-1 text-[11px] italic">"{hr.comment}"</p>}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                        {new Date(hr.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Review Form */}
              <form onSubmit={handleAddReview} className="p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Submit New Human Review</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Human Score (0 - 100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={humanScore}
                      onChange={(e) => setHumanScore(parseFloat(e.target.value))}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Metric Target</label>
                    <select
                      value={metricName}
                      onChange={(e) => setMetricName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="overall">Overall Quality</option>
                      <option value="correctness">Correctness</option>
                      <option value="relevance">Relevance</option>
                      <option value="faithfulness">Faithfulness</option>
                      <option value="hallucination">Hallucination</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Reviewer Handle</label>
                    <input
                      type="text"
                      value={reviewerId}
                      onChange={(e) => setReviewerId(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Reviewer Rationale & Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Model missed subtle nuance in context paragraph 2..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all disabled:opacity-50"
                  >
                    {submittingReview ? 'Saving Review...' : 'Record Human Evaluation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-900/90 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
          >
            Close Detail
          </button>
        </div>
      </div>
    </div>
  );
};
