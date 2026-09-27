import type {
  Project,
  Dataset,
  DatasetDetail,
  DatasetImportPreview,
  TestCase,
  ModelConfig,
  ModelConnectionTestResponse,
  PromptVersion,
  RunSummary,
  RunListItem,
  CaseResult,
  HumanReview,
  RunComparisonResponse,
  SystemStatus,
} from '../types';

const API_BASE = '/api/v1';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = 'API request failed';
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorJson.message || JSON.stringify(errorJson);
    } catch {
      errorDetail = (await res.text()) || res.statusText;
    }
    throw new Error(errorDetail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // System Status
  async getSystemStatus(): Promise<SystemStatus> {
    const res = await fetch(`${API_BASE}/system-status`);
    return handleResponse<SystemStatus>(res);
  },

  // Projects
  async getProjects(): Promise<Project[]> {
    const res = await fetch(`${API_BASE}/projects`);
    return handleResponse<Project[]>(res);
  },

  async createProject(name: string, description?: string): Promise<Project> {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    return handleResponse<Project>(res);
  },

  // Datasets
  async getDatasets(projectId: string): Promise<Dataset[]> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/datasets`);
    return handleResponse<Dataset[]>(res);
  },

  async getDatasetDetail(datasetId: string): Promise<DatasetDetail> {
    const res = await fetch(`${API_BASE}/datasets/${datasetId}`);
    return handleResponse<DatasetDetail>(res);
  },

  async previewDataset(file?: File, rawContent?: string, fileType = 'json'): Promise<DatasetImportPreview> {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    }
    if (rawContent) {
      formData.append('raw_content', rawContent);
    }
    formData.append('file_type', fileType);

    const res = await fetch(`${API_BASE}/datasets/preview`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<DatasetImportPreview>(res);
  },

  async uploadDatasetFile(projectId: string, name: string, file: File): Promise<Dataset> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/projects/${projectId}/datasets/upload`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<Dataset>(res);
  },

  async createDataset(projectId: string, name: string, testCases: TestCase[], sourceFilename?: string): Promise<Dataset> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/datasets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        source_filename: sourceFilename,
        test_cases: testCases,
      }),
    });
    return handleResponse<Dataset>(res);
  },

  async seedDemoDataset(projectId: string): Promise<Dataset> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/datasets/seed-demo`, {
      method: 'POST',
    });
    return handleResponse<Dataset>(res);
  },

  // Model Configurations
  async getModelConfigs(projectId: string): Promise<ModelConfig[]> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/models`);
    return handleResponse<ModelConfig[]>(res);
  },

  async createModelConfig(
    projectId: string,
    config: {
      name: string;
      provider: string;
      model_name: string;
      parameters?: Record<string, any>;
      secret_reference?: string;
    }
  ): Promise<ModelConfig> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return handleResponse<ModelConfig>(res);
  },

  async testModelConnection(provider: string, modelName: string, apiKey?: string): Promise<ModelConnectionTestResponse> {
    const res = await fetch(`${API_BASE}/models/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        model_name: modelName,
        api_key: apiKey || null,
      }),
    });
    return handleResponse<ModelConnectionTestResponse>(res);
  },

  async deleteModelConfig(projectId: string, modelId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/models/${modelId}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Prompts
  async getPromptVersions(projectId: string): Promise<PromptVersion[]> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/prompts`);
    return handleResponse<PromptVersion[]>(res);
  },

  async createPromptVersion(
    projectId: string,
    prompt: {
      name: string;
      system_prompt: string;
      user_template: string;
    }
  ): Promise<PromptVersion> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompt),
    });
    return handleResponse<PromptVersion>(res);
  },

  // Evaluation Runs
  async startEvaluationRun(params: {
    project_id: string;
    dataset_id: string;
    model_config_id: string;
    prompt_version_id?: string;
    metrics: string[];
    max_concurrency?: number;
  }): Promise<{ run_id: string; status: string }> {
    const res = await fetch(`${API_BASE}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return handleResponse<{ run_id: string; status: string }>(res);
  },

  async getRuns(projectId?: string): Promise<RunListItem[]> {
    const url = projectId ? `${API_BASE}/runs?project_id=${projectId}` : `${API_BASE}/runs`;
    const res = await fetch(url);
    return handleResponse<RunListItem[]>(res);
  },

  async getRunDetails(runId: string): Promise<RunSummary> {
    const res = await fetch(`${API_BASE}/runs/${runId}`);
    return handleResponse<RunSummary>(res);
  },

  async cancelRun(runId: string): Promise<{ run_id: string; status: string }> {
    const res = await fetch(`${API_BASE}/runs/${runId}/cancel`, {
      method: 'POST',
    });
    return handleResponse<{ run_id: string; status: string }>(res);
  },

  async deleteRun(runId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/runs/${runId}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Results & Case Details
  async getRunResults(
    runId: string,
    filters?: {
      status?: string;
      category?: string;
      search?: string;
      skip?: number;
      limit?: number;
    }
  ): Promise<CaseResult[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.skip !== undefined) params.append('skip', filters.skip.toString());
    if (filters?.limit !== undefined) params.append('limit', filters.limit.toString());

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/runs/${runId}/results${qs}`);
    return handleResponse<CaseResult[]>(res);
  },

  async getCaseResultDetail(runId: string, caseResultId: string): Promise<CaseResult> {
    const res = await fetch(`${API_BASE}/runs/${runId}/results/${caseResultId}`);
    return handleResponse<CaseResult>(res);
  },

  async submitHumanReview(
    runId: string,
    caseResultId: string,
    review: {
      reviewer_id?: string;
      metric_name?: string;
      human_score: number;
      comment?: string;
    }
  ): Promise<HumanReview> {
    const res = await fetch(`${API_BASE}/runs/${runId}/results/${caseResultId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(review),
    });
    return handleResponse<HumanReview>(res);
  },

  // Comparisons
  async compareRuns(runAId: string, runBId: string): Promise<RunComparisonResponse> {
    const res = await fetch(`${API_BASE}/comparisons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_ids: [runAId, runBId] }),
    });
    return handleResponse<RunComparisonResponse>(res);
  },

  // Exports
  getExportUrl(runId: string, format: 'csv' | 'json'): string {
    return `${API_BASE}/runs/${runId}/export?format=${format}`;
  },

  // --- Ground Truth Validation ---

  async getValidationDatasets(projectId: string): Promise<import('../types').ValidationDataset[]> {
    const res = await fetch(`${API_BASE}/validation/projects/${projectId}/datasets`);
    return handleResponse<import('../types').ValidationDataset[]>(res);
  },

  async createValidationDataset(projectId: string, payload: {
    name: string;
    description?: string;
    cases?: any[];
  }): Promise<import('../types').ValidationDataset> {
    const res = await fetch(`${API_BASE}/validation/projects/${projectId}/datasets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<import('../types').ValidationDataset>(res);
  },

  async seedSampleValidationDataset(projectId: string): Promise<import('../types').ValidationDataset> {
    const res = await fetch(`${API_BASE}/validation/projects/${projectId}/datasets/seed-sample`, {
      method: 'POST',
    });
    return handleResponse<import('../types').ValidationDataset>(res);
  },

  async getValidationDatasetDetail(datasetId: string): Promise<import('../types').ValidationDatasetDetail> {
    const res = await fetch(`${API_BASE}/validation/datasets/${datasetId}`);
    return handleResponse<import('../types').ValidationDatasetDetail>(res);
  },

  async deleteValidationDataset(datasetId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/validation/datasets/${datasetId}`, { method: 'DELETE' });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  async updateValidationCase(caseId: string, payload: {
    expected_labels?: Record<string, { passed: boolean | null; score: number | null }>;
    review_status?: string;
    reviewer_notes?: string;
    reviewed_by?: string;
  }): Promise<import('../types').ValidationCase> {
    const res = await fetch(`${API_BASE}/validation/cases/${caseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<import('../types').ValidationCase>(res);
  },

  async startValidationRun(projectId: string, payload: {
    dataset_id: string;
    include_unreviewed?: boolean;
    force_mock?: boolean;
  }): Promise<import('../types').ValidationRun> {
    const res = await fetch(`${API_BASE}/validation/projects/${projectId}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<import('../types').ValidationRun>(res);
  },

  async getValidationRuns(projectId: string): Promise<import('../types').ValidationRun[]> {
    const res = await fetch(`${API_BASE}/validation/projects/${projectId}/runs`);
    return handleResponse<import('../types').ValidationRun[]>(res);
  },

  async getValidationRunDetail(runId: string): Promise<import('../types').ValidationRunDetail> {
    const res = await fetch(`${API_BASE}/validation/runs/${runId}`);
    return handleResponse<import('../types').ValidationRunDetail>(res);
  },
};

