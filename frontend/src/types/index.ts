export interface Project {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
}

export interface TestCase {
  id?: string;
  external_id: string;
  question: string;
  expected_answer?: string | null;
  context?: string | null;
  category?: string | null;
  case_metadata?: Record<string, any>;
  enabled?: boolean;
  created_at?: string;
}

export interface Dataset {
  id: string;
  project_id: string;
  name: string;
  version: number;
  test_case_count: number;
  source_filename?: string | null;
  created_at: string;
}

export interface DatasetDetail extends Dataset {
  test_cases: TestCase[];
}

export interface DatasetRowValidationError {
  row_index: number;
  external_id?: string | null;
  error: string;
}

export interface DatasetImportPreview {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  preview_cases: TestCase[];
  validation_errors: DatasetRowValidationError[];
}

export interface ModelConfig {
  id: string;
  project_id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'mock';
  model_name: string;
  parameters: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    [key: string]: any;
  };
  secret_reference?: string | null;
  has_api_key?: boolean;
  created_at: string;
}

export interface ModelConnectionTestResponse {
  success: boolean;
  latency_ms: number;
  message: string;
  sample_response?: string | null;
}

export interface PromptVersion {
  id: string;
  project_id: string;
  name: string;
  version: number;
  system_prompt: string;
  user_template: string;
  created_at: string;
}

export interface MetricSummary {
  metric_name: string;
  average_score?: number | null;
  min_score?: number | null;
  max_score?: number | null;
  evaluated_count: number;
  not_applicable_count: number;
  passed_count: number;
  pass_rate: number;
}

export interface RunSummary {
  run_id: string;
  project_id: string;
  dataset_id: string;
  dataset_name?: string | null;
  dataset_version?: number | null;
  model_config_id: string;
  model_name?: string | null;
  provider?: string | null;
  prompt_version_id?: string | null;
  prompt_name?: string | null;
  status: 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  total_cases: number;
  completed_cases: number;
  failed_cases: number;
  progress_percent: number;
  started_at?: string | null;
  finished_at?: string | null;
  duration_seconds?: number | null;
  mean_latency_ms: number;
  median_latency_ms: number;
  p95_latency_ms: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  avg_tokens_per_case: number;
  metrics_summary: MetricSummary[];
  configuration_snapshot: Record<string, any>;
  error_summary?: string | null;
  created_at: string;
}

export interface RunListItem {
  id: string;
  project_id: string;
  dataset_name: string;
  dataset_version: number;
  model_name: string;
  provider: string;
  status: 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  total_cases: number;
  completed_cases: number;
  failed_cases: number;
  avg_correctness?: number | null;
  avg_relevance?: number | null;
  avg_faithfulness?: number | null;
  avg_hallucination?: number | null;
  mean_latency_ms: number;
  total_tokens: number;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
}

export interface MetricResult {
  id: string;
  case_result_id: string;
  metric_name: string;
  score?: number | null;
  score_scale_min: number;
  score_scale_max: number;
  passed?: boolean | null;
  reason?: string | null;
  evaluator_type: string;
  evaluator_model?: string | null;
  rubric_version: string;
  raw_output?: Record<string, any> | null;
  created_at: string;
}

export interface HumanReview {
  id: string;
  case_result_id: string;
  reviewer_id: string;
  metric_name?: string | null;
  human_score: number;
  comment?: string | null;
  created_at: string;
}

export interface CaseResult {
  id: string;
  run_id: string;
  test_case_id: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  external_id?: string | null;
  question?: string | null;
  category?: string | null;
  output_text?: string | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  latency_ms: number;
  started_at: string;
  finished_at?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  metric_results: MetricResult[];
  human_reviews: HumanReview[];
  input_snapshot?: Record<string, any>;
}

export interface MetricComparison {
  metric_name: string;
  run_a_score?: number | null;
  run_b_score?: number | null;
  delta?: number | null;
  delta_percent?: number | null;
  improved?: boolean | null;
}

export interface CaseComparisonRow {
  test_case_id: string;
  external_id: string;
  question: string;
  run_a_output?: string | null;
  run_b_output?: string | null;
  run_a_latency_ms: number;
  run_b_latency_ms: number;
  run_a_tokens?: number | null;
  run_b_tokens?: number | null;
  metric_scores_a: Record<string, number | null>;
  metric_scores_b: Record<string, number | null>;
  regressed: boolean;
  improved: boolean;
}

export interface RunComparisonResponse {
  run_a_id: string;
  run_b_id: string;
  compatible: boolean;
  compatibility_reason?: string | null;
  run_a_model: string;
  run_b_model: string;
  dataset_name: string;
  dataset_version: number;
  metrics: MetricComparison[];
  mean_latency_a_ms: number;
  mean_latency_b_ms: number;
  latency_delta_ms: number;
  total_tokens_a: number;
  total_tokens_b: number;
  token_delta: number;
  cases: CaseComparisonRow[];
}

export interface SystemStatus {
  app_name: string;
  version: string;
  database: string;
  openai_api_key_configured: boolean;
  anthropic_api_key_configured: boolean;
  default_model: string;
  judge_model: string;
  mock_mode_available: boolean;
}

// --- Ground Truth Validation Types ---

export interface ExpectedLabel {
  passed: boolean | null;
  score: number | null;
}

export interface ValidationCase {
  id: string;
  dataset_id: string;
  question: string;
  reference_answer: string | null;
  reference_context: string | null;
  model_answer: string;
  expected_labels: Record<string, ExpectedLabel>;
  review_status: 'provisional' | 'reviewed' | 'disputed';
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  category: string | null;
  created_at: string;
}

export interface ValidationDataset {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  version: number;
  case_count: number;
  reviewed_count: number;
  created_at: string;
}

export interface ValidationDatasetDetail extends ValidationDataset {
  cases: ValidationCase[];
}

export interface MetricValidationResult {
  metric_name: string;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1_score: number | null;
  mae: number | null;
  sample_count: number;
  reviewed_count: number;
  reviewed_sample_count?: number;
  provisional_count?: number;
  na_count?: number;
  status: 'pending' | 'provisional' | 'insufficient_data' | 'validated' | 'needs_calibration';
  status_notice?: string;
  sample_size_explanation?: string;
  true_positives: number;
  false_positives: number;
  true_negatives: number;
  false_negatives: number;
  // Provisional metrics (when unreviewed cases are evaluated)
  provisional_accuracy?: number | null;
  provisional_precision?: number | null;
  provisional_recall?: number | null;
  provisional_f1_score?: number | null;
  provisional_mae?: number | null;
  provisional_true_positives?: number;
  provisional_false_positives?: number;
  provisional_true_negatives?: number;
  provisional_false_negatives?: number;
  provisional_sample_count?: number;
}

export interface ValidationCaseResult {
  case_id: string;
  question: string;
  reference_answer: string | null;
  reference_context: string | null;
  model_answer: string;
  metric: string;
  expected_pass: boolean | null;
  expected_score: number | null;
  predicted_pass: boolean | null;
  predicted_score: number | null;
  predicted_reason: string;
  agreement: boolean | null;
  score_error: number | null;
  review_status: string;
  is_reviewed?: boolean;
  explanation: string;
  category: string | null;
}

export interface ValidationRunSummary {
  overall: {
    total_cases?: number;
    total_comparisons: number;
    reviewed_cases?: number;
    provisional_cases?: number;
    reviewed_comparisons?: number;
    provisional_comparisons?: number;
    verified_accuracy?: number | null;
    provisional_accuracy?: number | null;
    accuracy?: number | null;
    is_provisional?: boolean;
    has_insufficient_reviewed?: boolean;
    min_reviewed_required?: number;
    status?: string;
    status_notice?: string;
  };
  by_metric: Record<string, MetricValidationResult>;
}

export interface ValidationRun {
  id: string;
  dataset_id: string;
  project_id: string;
  status: 'running' | 'completed' | 'failed';
  total_cases: number;
  reviewed_cases: number;
  include_unreviewed: boolean;
  results_summary: ValidationRunSummary | Record<string, never>;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface ValidationRunDetail extends ValidationRun {
  case_results: ValidationCaseResult[];
  metric_results: MetricValidationResult[];
}

