# LLM Eval Studio

## Complete Step-by-Step Architecture and Implementation Guide

**Product:** LLM Eval Studio\
**Purpose:** A web application for running repeatable evaluations of
LLMs, scoring their responses, measuring latency and token usage,
inspecting failures, and comparing models or prompt versions.

**Target:** A locally runnable, production-minded POC that can later be
hardened for deployment. The guide is designed so you can follow the
steps, run the system, and understand what each part does.

------------------------------------------------------------------------

# 1. Product definition

LLM Eval Studio is an evaluation workbench, not an LLM chat application.
It tests models against a controlled dataset and records evidence about
response quality and operational performance.

### Primary user journey

1.  Create a project.
2.  Create or upload a dataset of test cases.
3.  Configure a model and prompt.
4.  Start an evaluation run.
5.  The system executes each test case and records the model response.
6.  Evaluators score the response.
7.  Results are persisted and aggregated.
8.  The user inspects individual cases, filters failures, and compares
    runs.
9.  The user exports a report.

### Core evaluation dimensions

  -----------------------------------------------------------------------
  Metric                  Meaning                 Direction
  ----------------------- ----------------------- -----------------------
  Correctness             Whether the response    Higher is better
                          answers accurately      
                          against the expected    
                          answer or an approved   
                          rubric                  

  Relevance               Whether the response    Higher is better
                          addresses the question  
                          and avoids irrelevant   
                          material                

  Faithfulness            Whether claims are      Higher is better
                          supported by the        
                          supplied reference      
                          context                 

  Hallucination           Whether the response    Lower is better
                          contains unsupported or 
                          fabricated claims       

  Latency                 Time taken to obtain a  Lower is generally
                          response from the       better
                          target model            

  Token usage             Prompt and completion   Depends on budget and
                          tokens consumed         task
  -----------------------------------------------------------------------

Do not treat an LLM judge's score as ground truth. Use human-reviewed
examples to calibrate the evaluator, retain the judge's rationale, and
clearly label scores as estimates.

### Scope

**MVP / first working release** - One user role (local developer /
evaluator). - One provider integration (OpenAI). - Dataset creation and
JSON/CSV upload. - Synchronous or background evaluation runs. - Four
evaluation metrics. - Per-case result inspection. - SQLite for local
development. - Dashboard, run history, CSV/JSON export.

**Production-ready direction** - PostgreSQL, authentication and
authorization. - Background job queue and worker pool. - Provider
abstraction and multiple model providers. - Rate limiting, retries,
timeouts and concurrency controls. - Dataset and prompt versioning. -
Human review and evaluator calibration. - Audit trail, observability,
secrets management, deployment and backups.

"Production-ready" requires operational testing and security review;
completing the code steps alone does not certify production readiness.

------------------------------------------------------------------------

# 2. High-level architecture

``` mermaid
flowchart TD
    U[Evaluator / User] --> FE[React Web App]
    FE --> API[FastAPI API]
    API --> AUTH[Authentication and Authorization]
    API --> DB[(PostgreSQL / SQLite)]
    API --> OBJ[(Object Storage: optional)]
    API --> Q[Job Queue]
    Q --> W[Evaluation Worker]
    W --> DS[Dataset Loader and Validator]
    DS --> ORCH[Evaluation Orchestrator]
    ORCH --> LLM[LLM Provider Adapter]
    LLM --> M[Target LLM]
    ORCH --> EV[Evaluation Engine]
    EV --> J[Judge Model / Deterministic Metrics]
    J --> EV
    ORCH --> DB
    EV --> DB
    API --> FE
    FE --> DASH[Dashboard / Run Detail / Compare]
```

### Component responsibilities

  -----------------------------------------------------------------------
  Component                           Responsibility
  ----------------------------------- -----------------------------------
  React frontend                      Dataset management, run
                                      configuration, progress, charts,
                                      case details

  FastAPI API                         Validates requests, enforces
                                      access, creates runs, serves
                                      results

  Database                            Stores projects, datasets, test
                                      cases, model configs, runs, results
                                      and reviews

  Object storage                      Optional storage for larger
                                      uploaded files and exported
                                      artifacts

  Job queue                           Decouples long-running evaluations
                                      from HTTP requests

  Evaluation worker                   Executes test cases, handles
                                      retries and persists results

  Dataset loader                      Parses and validates test datasets

  Provider adapter                    Standard interface for calling an
                                      LLM provider

  Evaluator                           Runs deterministic checks and
                                      judge-based metrics

  Aggregator                          Computes run-level statistics and
                                      failure summaries

  Dashboard                           Visualizes scores, latency, token
                                      usage and errors
  -----------------------------------------------------------------------

### Recommended execution flow

1.  Frontend sends `POST /api/v1/runs`.
2.  API validates the dataset, model configuration and evaluation
    settings.
3.  API creates a run with status `queued` and returns its ID.
4.  Worker picks up the job and marks it `running`.
5.  For each test case, the worker calls the target model and stores the
    response and usage.
6.  The evaluation engine computes configured metrics.
7.  The worker stores each metric result and updates progress.
8.  Once all cases are complete, aggregation runs and the run becomes
    `completed`, `completed_with_errors`, or `failed`.
9.  Frontend polls the run endpoint or receives updates through
    Server-Sent Events (SSE).
10. The user opens the run detail page and can compare it with other
    runs.

For a small local POC, a FastAPI background task can be used
temporarily. For the final architecture, use a durable queue and
independent workers so a server restart does not silently lose a run.

------------------------------------------------------------------------

# 3. Technology choices

  -----------------------------------------------------------------------
  Layer                   Recommended technology  Why
  ----------------------- ----------------------- -----------------------
  Frontend                React + TypeScript +    Familiar
                          Vite                    component-based UI

  Styling                 Tailwind CSS            Fast, consistent UI
                                                  implementation

  Charts                  Recharts                Dashboard
                                                  visualizations

  API                     Python + FastAPI        Typed request/response
                                                  APIs and OpenAPI docs

  Validation              Pydantic                Request and dataset
                                                  validation

  ORM                     SQLAlchemy 2.x          Database access and
                                                  migrations

  Migrations              Alembic                 Repeatable schema
                                                  changes

  Local database          SQLite                  Simple local setup

  Production database     PostgreSQL              Concurrent access and
                                                  durable shared storage

  Queue                   Redis + Celery or RQ    Durable asynchronous
                                                  work

  LLM integration         Provider adapter using  Keeps provider details
                          official SDK            out of core logic

  Evaluation              Custom rubric +         Transparent and
                          optional evaluation     configurable scoring
                          library                 

  Testing                 pytest + Vitest/React   Backend and frontend
                          Testing Library         tests

  Packaging               Docker Compose          Reproducible local
                                                  stack

  Observability           Structured logs; later  Diagnose latency and
                          OpenTelemetry           failures

  CI                      GitHub Actions or       Automated quality
                          equivalent              checks
  -----------------------------------------------------------------------

Use pinned, tested dependency versions in the project lockfiles. Do not
blindly copy old version pins from tutorials.

------------------------------------------------------------------------

# 4. Repository structure

``` text
llm-eval-studio/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── logging.py
│   │   │   └── security.py
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── router.py
│   │   │       ├── projects.py
│   │   │       ├── datasets.py
│   │   │       ├── models.py
│   │   │       ├── runs.py
│   │   │       ├── results.py
│   │   │       └── exports.py
│   │   ├── db/
│   │   │   ├── base.py
│   │   │   ├── session.py
│   │   │   └── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   │   ├── dataset_service.py
│   │   │   ├── run_service.py
│   │   │   └── aggregation_service.py
│   │   ├── evaluation/
│   │   │   ├── runner.py
│   │   │   ├── metrics.py
│   │   │   ├── judge.py
│   │   │   ├── rubric.py
│   │   │   └── calibration.py
│   │   ├── providers/
│   │   │   ├── base.py
│   │   │   └── openai_provider.py
│   │   ├── workers/
│   │   │   ├── celery_app.py
│   │   │   └── tasks.py
│   │   └── utils/
│   ├── tests/
│   ├── alembic/
│   ├── requirements.txt
│   ├── alembic.ini
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── dashboard/
│   │   │   ├── datasets/
│   │   │   ├── models/
│   │   │   ├── runs/
│   │   │   └── comparisons/
│   │   ├── lib/
│   │   │   └── api.ts
│   │   ├── types/
│   │   └── main.tsx
│   ├── package.json
│   └── .env.example
├── sample-data/
│   └── demo_dataset.json
├── docker-compose.yml
├── .gitignore
└── README.md
```

Keep API routes thin. Business logic belongs in services and evaluation
modules, not in route handlers or React components.

------------------------------------------------------------------------

# 5. Data model

Use stable IDs (UUIDs are suitable) and timestamps in UTC.

## 5.1 Main entities

### Project

-   `id`
-   `name`
-   `description`
-   `created_at`
-   `updated_at`

### Dataset

-   `id`
-   `project_id`
-   `name`
-   `version`
-   `source_filename` (optional)
-   `created_at`

A dataset version is immutable after it has been used in a run. Editing
test cases should create a new version.

### TestCase

-   `id`
-   `dataset_id`
-   `external_id`
-   `question`
-   `expected_answer` (optional)
-   `context` (optional)
-   `category` (optional)
-   `metadata` (JSON)
-   `enabled`
-   `created_at`

Do not require an expected answer for every metric. For example,
faithfulness needs reference context; relevance can be judged without a
gold answer.

### ModelConfig

-   `id`
-   `project_id`
-   `provider`
-   `model_name`
-   `parameters` (JSON: temperature, max output tokens, etc.)
-   `secret_reference` (never store raw API keys here)
-   `created_at`

### PromptVersion

-   `id`
-   `project_id`
-   `name`
-   `version`
-   `system_prompt`
-   `user_template`
-   `created_at`

### EvaluationRun

-   `id`
-   `project_id`
-   `dataset_id`
-   `model_config_id`
-   `prompt_version_id`
-   `status` (`queued`, `running`, `completed`, `completed_with_errors`,
    `failed`, `cancelled`)
-   `total_cases`
-   `completed_cases`
-   `failed_cases`
-   `started_at`
-   `finished_at`
-   `configuration_snapshot` (JSON)
-   `error_summary` (optional)

The configuration snapshot is important: a run must retain the exact
model and prompt settings used, even if the project changes later.

### CaseResult

-   `id`
-   `run_id`
-   `test_case_id`
-   `status`
-   `input_snapshot` (JSON)
-   `output_text`
-   `provider_request_id` (optional)
-   `prompt_tokens`
-   `completion_tokens`
-   `total_tokens`
-   `latency_ms`
-   `started_at`
-   `finished_at`
-   `error_code` (optional)
-   `error_message` (sanitized, optional)

### MetricResult

-   `id`
-   `case_result_id`
-   `metric_name`
-   `score`
-   `score_scale_min`
-   `score_scale_max`
-   `passed` (optional)
-   `reason`
-   `evaluator_type` (`deterministic`, `llm_judge`, `human`)
-   `evaluator_model` (optional)
-   `rubric_version`
-   `raw_output` (optional, access-controlled)

Store each metric as a separate record. This makes adding new metrics
easier than adding a new database column every time.

### HumanReview

-   `id`
-   `case_result_id`
-   `reviewer_id`
-   `metric_name` (optional)
-   `human_score`
-   `comment`
-   `created_at`

## 5.2 Relationships

``` mermaid
erDiagram
    PROJECT ||--o{ DATASET : owns
    DATASET ||--o{ TEST_CASE : contains
    PROJECT ||--o{ MODEL_CONFIG : configures
    PROJECT ||--o{ PROMPT_VERSION : versions
    PROJECT ||--o{ EVALUATION_RUN : has
    DATASET ||--o{ EVALUATION_RUN : evaluates
    MODEL_CONFIG ||--o{ EVALUATION_RUN : uses
    PROMPT_VERSION ||--o{ EVALUATION_RUN : uses
    EVALUATION_RUN ||--o{ CASE_RESULT : produces
    TEST_CASE ||--o{ CASE_RESULT : tested_as
    CASE_RESULT ||--o{ METRIC_RESULT : scored_by
    CASE_RESULT ||--o{ HUMAN_REVIEW : reviewed_by
```

------------------------------------------------------------------------

# 6. Dataset format and validation

Support JSON first. Add CSV after the core flow works.

Example `sample-data/demo_dataset.json`:

``` json
[
  {
    "external_id": "python-001",
    "question": "What is Python?",
    "expected_answer": "Python is a high-level, general-purpose programming language.",
    "context": "Python is a high-level, interpreted, general-purpose programming language.",
    "category": "programming",
    "metadata": {
      "difficulty": "easy"
    }
  },
  {
    "external_id": "api-001",
    "question": "What is an API?",
    "expected_answer": "An API is an interface that allows software systems to communicate.",
    "context": "An application programming interface defines how software components communicate.",
    "category": "backend",
    "metadata": {
      "difficulty": "easy"
    }
  },
  {
    "external_id": "context-001",
    "question": "According to the context, what year was the company founded?",
    "expected_answer": "The context does not specify a founding year.",
    "context": "The company provides analytics software to businesses.",
    "category": "faithfulness",
    "metadata": {
      "difficulty": "medium",
      "expected_abstention": true
    }
  }
]
```

Validation rules: - File size and row count have configurable limits. -
Each case has a unique `external_id` within the dataset. - `question`
must be non-empty. - Enforce maximum lengths for all text fields. -
Reject malformed JSON and invalid field types. - Do not execute or
interpret uploaded content. - Show a preview and validation errors
before saving. - Record the dataset version and checksum.

For production, treat uploaded text as untrusted input. It may contain
prompt injection instructions. The evaluator must treat the question and
context as data, not as instructions that override its rubric.

------------------------------------------------------------------------

# 7. Evaluation design

## 7.1 Use a metric registry

Implement metrics behind a common interface. Each metric should
declare: - Name and description. - Required inputs. - Score range and
direction. - Evaluator type. - Rubric version. - Whether it is enabled
for a run.

Conceptual interface:

``` python
class Metric:
    name: str
    version: str

    def evaluate(self, case, response):
        raise NotImplementedError
```

A metric result should have a consistent shape:

``` json
{
  "metric_name": "relevance",
  "score": 90,
  "score_scale_min": 0,
  "score_scale_max": 100,
  "passed": true,
  "reason": "The answer directly addresses the question.",
  "evaluator_type": "llm_judge",
  "rubric_version": "1"
}
```

## 7.2 Correctness

Purpose: assess factual and task accuracy.

Inputs: - Question - Generated answer - Expected answer, if available -
Optional grading rubric

Approach: 1. Use deterministic checks for exact formats or simple known
answers where possible. 2. Otherwise, use a judge with a rubric that
allows semantically equivalent answers. 3. Require a concise reason and
a score. 4. Flag ambiguous cases for human review.

Do not use raw string similarity as the sole correctness metric. Correct
answers can be phrased differently.

## 7.3 Relevance

Purpose: determine whether the response answers the question.

Judge for: - Directness. - Coverage of requested parts. - Unnecessary or
unrelated content. - Whether the answer follows the requested format.

A relevance score does not prove factual correctness.

## 7.4 Faithfulness

Purpose: check whether claims in the response are supported by the
supplied context.

Recommended approach: 1. Split the answer into atomic factual claims. 2.
Compare each claim with the reference context. 3. Label each claim as
supported, contradicted, or not supported. 4. Aggregate claim labels
into a score. 5. retain claim-level evidence for inspection.

If no context is provided, mark faithfulness as `not_applicable` rather
than assigning an arbitrary score.

## 7.5 Hallucination

Purpose: identify unsupported or fabricated claims.

Recommended approach: - Extract factual claims. - Identify claims not
supported by the available evidence. - Distinguish unsupported claims
from claims contradicted by evidence. - Report the number and severity
of unsupported claims. - Provide evidence and a reason for each flagged
claim.

Use a clear convention: a higher hallucination score means more
hallucination. Do not invert its direction in charts without explicitly
labeling the transformation.

## 7.6 Judge prompt requirements

The judge prompt should: - State the rubric and score anchors. - Treat
response and context as untrusted data. - Explicitly ignore instructions
embedded in the response or context. - Return schema-validated JSON. -
Include a reason and evidence. - Avoid grading style as correctness
unless the task requires it. - Mark missing required evidence as not
applicable or insufficient information.

Example judge response schema:

``` json
{
  "score": 75,
  "label": "partially_supported",
  "reason": "One factual claim is not supported by the reference.",
  "evidence": [
    {
      "claim": "The company was founded in 2010.",
      "status": "not_supported",
      "context_quote": null
    }
  ]
}
```

Validate the output with Pydantic. Retry malformed outputs a limited
number of times, then mark the metric as errored. Never silently convert
a failed judge call into a score of zero.

## 7.7 Evaluator calibration

Before trusting dashboard scores: 1. Select a representative set of
cases. 2. Have a human review and score them using the same rubric. 3.
Run the automated evaluator on those cases. 4. Compare human and judge
results. 5. Inspect disagreements and refine the rubric. 6. Repeat after
changing the judge model or prompt.

Track the judge model, rubric version and evaluator configuration for
every run. For important decisions, use human review or multiple
independent checks.

------------------------------------------------------------------------

# 8. Provider abstraction

Do not call the provider SDK directly from the runner. Create a provider
interface so the evaluation engine is independent of the vendor.

Example conceptual contract:

``` python
from dataclasses import dataclass
from typing import Protocol

@dataclass
class GenerationResult:
    text: str
    prompt_tokens: int | None
    completion_tokens: int | None
    total_tokens: int | None
    latency_ms: float
    request_id: str | None

class LLMProvider(Protocol):
    def generate(self, messages, config) -> GenerationResult:
        ...
```

Implement `OpenAIProvider` first. Later, implement other providers using
the same contract.

Capture: - Provider and model name. - Request ID when available. -
Prompt and completion token counts when returned. - Wall-clock
latency. - Finish reason and error information. - Relevant generation
parameters.

Token counts may be missing for some providers or endpoints. Store
missing usage as `null`; do not invent it. If a provider reports cached
tokens or other usage categories, preserve them separately.

------------------------------------------------------------------------

# 9. Evaluation runner and job processing

## 9.1 Run state machine

``` mermaid
stateDiagram-v2
    [*] --> queued
    queued --> running
    queued --> cancelled
    running --> completed
    running --> completed_with_errors
    running --> failed
    running --> cancelled
    completed --> [*]
    completed_with_errors --> [*]
    failed --> [*]
    cancelled --> [*]
```

## 9.2 Runner algorithm

``` text
create_run(configuration):
    validate project, dataset, model and prompt versions
    snapshot configuration
    create run(status=queued)
    enqueue run_id
    return run_id

execute_run(run_id):
    acquire run safely
    mark run running

    for each enabled test case:
        if cancellation requested:
            mark run cancelled
            stop

        create case result(status=running)

        try:
            build messages from prompt and test case
            call target model with timeout
            persist response, latency and usage

            for each enabled metric:
                validate required inputs
                evaluate metric
                persist score, reason and evidence

            mark case result completed
        except retryable error:
            retry within configured limits
        except permanent error:
            persist sanitized error
            mark case result failed

        update run progress

    aggregate results
    mark run completed or completed_with_errors
```

## 9.3 Reliability requirements

-   Use bounded concurrency to avoid provider rate limits.
-   Configure connect and response timeouts.
-   Retry only retryable failures, with exponential backoff and jitter.
-   Avoid duplicate execution when a worker retries a job.
-   Use idempotency keys for run creation where appropriate.
-   Persist case results as they complete.
-   Support cancellation.
-   Separate target-model errors from judge-model errors.
-   Apply per-run limits on cases, tokens, duration and cost.
-   Do not log API keys or full sensitive prompts by default.

For the POC, a simple sequential runner is easiest to debug. Add workers
and concurrency after correctness is established.

------------------------------------------------------------------------

# 10. API design

Use a versioned prefix: `/api/v1`.

  ----------------------------------------------------------------------------------------------
  Method                  Endpoint                                       Purpose
  ----------------------- ---------------------------------------------- -----------------------
  `GET`                   `/health`                                      Health check

  `POST`                  `/api/v1/projects`                             Create a project

  `GET`                   `/api/v1/projects`                             List projects

  `POST`                  `/api/v1/projects/{id}/datasets`               Create/upload dataset

  `GET`                   `/api/v1/datasets/{id}`                        Dataset details

  `GET`                   `/api/v1/datasets/{id}/cases`                  List test cases

  `POST`                  `/api/v1/runs`                                 Create an evaluation
                                                                         run

  `GET`                   `/api/v1/runs`                                 List runs

  `GET`                   `/api/v1/runs/{id}`                            Run status and summary

  `POST`                  `/api/v1/runs/{id}/cancel`                     Request cancellation

  `GET`                   `/api/v1/runs/{id}/results`                    Paginated case results

  `GET`                   `/api/v1/runs/{id}/results/{case_result_id}`   Detailed case result

  `GET`                   `/api/v1/runs/{id}/export`                     Export results

  `POST`                  `/api/v1/comparisons`                          Compare selected runs
  ----------------------------------------------------------------------------------------------

### Create run request

``` json
{
  "project_id": "project-uuid",
  "dataset_id": "dataset-uuid",
  "model_config_id": "model-uuid",
  "prompt_version_id": "prompt-uuid",
  "metrics": [
    "correctness",
    "relevance",
    "faithfulness",
    "hallucination"
  ],
  "max_concurrency": 2
}
```

### Create run response

``` json
{
  "run_id": "run-uuid",
  "status": "queued",
  "total_cases": 20,
  "created_at": "2026-09-27T10:00:00Z"
}
```

### Run status response

``` json
{
  "run_id": "run-uuid",
  "status": "running",
  "total_cases": 20,
  "completed_cases": 8,
  "failed_cases": 0,
  "progress": 40
}
```

Use pagination for result lists. Return consistent error responses with
a machine-readable code and a safe human-readable message. The exact
schemas should be defined as Pydantic models and documented in OpenAPI.

------------------------------------------------------------------------

# 11. Frontend information architecture

## Page 1: Dashboard

Show: - Total evaluation runs. - Latest run status. - Average quality
metrics. - Average and percentile latency. - Total and average token
usage. - Failure rate. - Trend over time. - Recent runs.

Make metric direction clear. Hallucination is a lower-is-better measure;
quality scores are higher-is-better.

## Page 2: Datasets

Features: - Create dataset. - Upload JSON/CSV. - Validate and preview. -
Show row-level errors. - View dataset versions. - Inspect individual
test cases. - Duplicate a dataset to create a new version.

## Page 3: Model configurations

Features: - Provider selection. - Model name. - Temperature and
output-token settings. - Secure credential reference. - Test
connection. - Display supported capabilities.

Do not return stored API secrets to the browser. Prefer environment
variables or a server-side secret manager.

## Page 4: Run evaluation

Form fields: - Project. - Dataset version. - Model configuration. -
Prompt version. - Metrics to run. - Concurrency and limits. - Optional
tags.

Show a confirmation summary before starting a run.

## Page 5: Run details

Show: - Run status and progress. - Configuration snapshot. - Metric
summary. - Latency and token summaries. - Table of test cases. - Search
and filters. - Failed cases and error messages. - Individual response
and evaluator explanations.

## Page 6: Case detail

Display: - Original question. - Expected answer. - Reference context. -
Generated response. - Per-metric score and explanation. - Claim-level
evidence where available. - Token usage and latency. - Human review
controls.

## Page 7: Compare runs

Compare runs only when the selected datasets and evaluation definitions
are compatible. Show: - Model and prompt versions. - Metric score
differences. - Latency and token differences. - Per-case regressions and
improvements. - Cases present in one run but not the other.

Do not combine incomparable scores into an unexplained overall ranking.

------------------------------------------------------------------------

# 12. Dashboard calculations

For a metric with valid scores (s_1, s_2, `\ldots`{=tex}, s_n), the
arithmetic mean is:

\[ `\bar`{=tex}{s}=`\frac{1}{n}`{=tex}`\sum`{=tex}\_{i=1}\^{n}s_i \]

Only include valid scores in that metric's denominator. Report the
number of evaluated, skipped and failed metric instances.

### Performance metrics

-   Mean latency.
-   Median latency (p50).
-   p95 latency when there are enough observations.
-   Total prompt tokens.
-   Total completion tokens.
-   Total tokens.
-   Average tokens per successful case.
-   Failure and timeout rates.

Do not report a latency percentile from a tiny sample as a stable
performance guarantee. Separate target-model latency from
evaluator/judge latency. If reporting end-to-end duration, label it
clearly.

### Cost estimation

If the provider publishes applicable token prices, estimate cost using
the matching model and token categories. Prices vary by model, endpoint,
region and date. Label estimates with the pricing source and timestamp.
Do not confuse estimated cost with the provider's billed amount.

### Aggregation rules

-   Keep raw per-case scores.
-   Keep metric-level valid counts.
-   Do not treat `not_applicable` as zero.
-   Do not treat evaluator failures as bad model answers.
-   Show missing data explicitly.
-   Preserve the metric direction in all charts and comparisons.

------------------------------------------------------------------------

# 13. Build it step by step

The following order minimizes debugging complexity. Finish and verify
each milestone before moving to the next.

## Step 1 --- Prepare the repository

``` bash
mkdir llm-eval-studio
cd llm-eval-studio
mkdir backend frontend sample-data
git init
```

Create a `.gitignore` containing at least:

``` gitignore
.env
.venv/
__pycache__/
.pytest_cache/
.coverage
*.db
node_modules/
dist/
.DS_Store
```

**Verify:** Git status does not show secrets, local databases or
dependency folders.

## Step 2 --- Create the backend environment

``` bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn pydantic sqlalchemy alembic \
    python-dotenv openai pytest httpx
```

Save the dependencies to a requirements file after verifying the
environment. Use a lockfile or pinned versions for repeatable
installation.

Create `app/main.py`:

``` python
from fastapi import FastAPI

app = FastAPI(title="LLM Eval Studio", version="0.1.0")

@app.get("/health")
def health():
    return {"status": "ok"}
```

Run:

``` bash
uvicorn app.main:app --reload --port 8000
```

Verify: - `http://localhost:8000/health` - `http://localhost:8000/docs`

Expected health response:

``` json
{"status": "ok"}
```

## Step 3 --- Add configuration

Create `.env.example`:

``` env
APP_ENV=local
DATABASE_URL=sqlite:///./llm_eval.db
OPENAI_API_KEY=
OPENAI_MODEL=
JUDGE_MODEL=
```

Load settings through a typed settings class. Validate required settings
at startup or before a run. Keep `.env.example` safe to commit and
`.env` private.

**Verify:** The application starts without a provider key, but a run
that requires the provider reports a clear configuration error.

## Step 4 --- Add database and migrations

1.  Define SQLAlchemy models for projects, datasets, cases, model
    configs, prompt versions, runs, results and metric results.
2.  Configure a database session dependency.
3.  Initialize Alembic.
4.  Generate and review the first migration.
5.  Apply it.
6.  Add repository/service functions for create, read and update
    operations.

Commands typically look like:

``` bash
alembic init alembic
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

Review generated migrations before applying them, especially when using
production data.

**Verify:** Create and retrieve a project and dataset using a test
database.

## Step 5 --- Implement dataset import

1.  Define a Pydantic test-case schema.
2.  Implement JSON parsing.
3.  Validate required fields, row limits and unique IDs.
4.  Return a preview and row-level validation errors.
5.  Save a new immutable dataset version and its test cases.
6.  Add CSV support only after JSON works.

**Verify:** Test valid input, missing questions, duplicate IDs, invalid
JSON and oversized files.

## Step 6 --- Implement the provider adapter

1.  Define the provider protocol.
2.  Implement the OpenAI adapter.
3.  Convert internal message objects to provider requests.
4.  Record wall-clock latency and provider usage.
5.  Normalize provider errors.
6.  Add timeouts and safe retries.

**Verify:** Run one manual question and inspect the normalized response
object. Test missing usage and provider errors using mocks.

## Step 7 --- Implement the evaluation metrics

Implement in this order: 1. Deterministic checks for exact or structured
answers. 2. Correctness judge. 3. Relevance judge. 4. Faithfulness judge
with reference context. 5. Hallucination/unsupported-claim analysis.

Create versioned rubrics and Pydantic output schemas. Add unit tests for
valid judge output, malformed output, missing context and judge
failures.

**Verify:** Evaluate a small, manually understood set of answers,
including a correct answer, a partially correct answer and an
unsupported claim.

## Step 8 --- Implement the runner

1.  Create a run record before execution.
2.  Snapshot the selected dataset, model and prompt versions.
3.  Iterate through enabled test cases.
4.  Call the target model.
5.  Save response and usage.
6.  Run the configured metrics.
7.  Save each metric result.
8.  Update progress and final status.

Start sequentially. Add a durable queue and controlled concurrency after
the sequential path works.

**Verify:** A 3-case dataset creates one run and three case results. A
failure in one case should not erase successful results for the other
cases.

## Step 9 --- Implement API endpoints

Add routes for: - Projects. - Datasets and cases. - Model
configurations. - Prompt versions. - Run creation, status and
cancellation. - Paginated results. - Export and comparison.

Use Pydantic response schemas. Keep database operations and business
logic out of the route layer.

**Verify:** Exercise the complete workflow with Swagger UI before
building the frontend.

## Step 10 --- Build the React application

Create the frontend:

``` bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install recharts lucide-react
npm run dev
```

Build in this order: 1. App shell and navigation. 2. Dashboard cards and
charts. 3. Dataset list, import and preview. 4. Model configuration
form. 5. Run configuration and start button. 6. Run progress and
history. 7. Result table and case detail. 8. Run comparison and export.

Create one typed API client and reusable TypeScript interfaces. Keep API
errors, loading states and empty states visible to the user.

**Verify:** The user can create/select a dataset, configure a model,
start a run and inspect persisted results through the UI.

## Step 11 --- Add durable background execution

For the final architecture: 1. Add Redis and a task queue such as Celery
or RQ. 2. Enqueue only a run ID and required identifiers, not large
secrets or entire datasets. 3. Make task execution idempotent. 4.
Persist progress after each case. 5. Implement cancellation checks. 6.
Configure worker concurrency and provider rate limits. 7. Recover or
mark runs that were interrupted by worker failure.

Use SSE or polling to refresh progress. Polling is simpler for the
initial UI; SSE can be added later.

**Verify:** Restart the API while a run is queued or running. The run
should remain discoverable and recover according to the documented
worker policy.

## Step 12 --- Add comparison and exports

1.  Compare compatible runs using the same dataset version.
2.  Display model, prompt, rubric and evaluator versions.
3.  Highlight per-case score changes.
4.  Export a CSV of case results and metrics.
5.  Export a JSON file containing the run configuration and results.

**Verify:** Exported files match the values shown in the UI and do not
expose secrets.

## Step 13 --- Add security and operational controls

Before a shared deployment: - Add authentication and project-level
authorization. - Restrict upload size and type. - Validate all user
input. - Store secrets in environment variables or a secret manager. -
Redact secrets and sensitive prompt data from logs. - Set request,
generation and judge timeouts. - Limit run size, duration, concurrency
and estimated spend. - Add audit events for important actions. -
Configure database backups and restore testing. - Add health and
readiness endpoints. - Use HTTPS and secure cookie/token practices. -
Define data retention and deletion policies.

If test data can contain personal or confidential information, define
access, retention and redaction policies before sending it to external
model providers.

## Step 14 --- Test and release

Backend:

``` bash
pytest
```

Frontend:

``` bash
npm run build
```

Add integration tests with mocked model providers. Avoid requiring paid
LLM calls for every CI run. Maintain a small, manually reviewed
evaluation set for periodic live checks.

Release checklist: - Clean installation succeeds. - Migrations apply
from an empty database. - Sample dataset imports. - A run completes and
results persist. - A failed case is visible and does not corrupt the
run. - Dashboard and detail views agree with stored results. - Exports
work. - Secrets are not committed or exposed. - Logs are useful and do
not leak sensitive data. - Backup and recovery procedures are
documented.

------------------------------------------------------------------------

# 14. Local development and Docker

For the first iteration, run backend and frontend directly in separate
terminals. This is easier to debug.

**Terminal 1 --- Backend**

``` bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 --- Frontend**

``` bash
cd frontend
npm run dev
```

Configure the frontend API base URL using a Vite environment variable
such as:

``` env
VITE_API_BASE_URL=http://localhost:8000
```

Configure FastAPI CORS to allow only the local frontend origin during
development.

For the final local stack, use Docker Compose for: - API. - Worker. -
Redis. - PostgreSQL. - Frontend (optional in development).

Do not expose Redis or PostgreSQL publicly. Use persistent volumes for
local data and non-default credentials for shared environments.

------------------------------------------------------------------------

# 15. Testing strategy

  -----------------------------------------------------------------------
  Test layer              What to test            Example
  ----------------------- ----------------------- -----------------------
  Unit                    Metric and aggregation  Mean excludes
                          logic                   not-applicable scores

  Unit                    Dataset validation      Duplicate external IDs
                                                  rejected

  Unit                    Provider normalization  Missing token usage
                                                  remains null

  Integration             API and database        Create dataset and
                                                  start run

  Integration             Runner                  Mock model response and
                                                  judge result

  Failure                 Provider errors         Timeout produces a
                                                  failed case

  Failure                 Judge errors            Metric error is not
                                                  scored as zero

  Frontend                Components              Run button loading and
                                                  error states

  End-to-end              User journey            Import → run → inspect
                                                  result

  Calibration             Evaluator quality       Compare judge against
                                                  human ratings
  -----------------------------------------------------------------------

Create fixtures for: - Fully correct response. - Incorrect response. -
Partially correct response. - Irrelevant response. - Context-supported
response. - Unsupported claim. - No reference context. - Provider
timeout. - Malformed judge output.

Track evaluator consistency across repeated runs. Temperature zero can
reduce variation but does not guarantee deterministic judge outputs.

------------------------------------------------------------------------

# 16. Demonstration plan

A short demo should use a small dataset with deliberately varied cases.

1.  Open the dashboard and show that no run has been executed yet.
2.  Import the demo dataset and preview its questions.
3.  Select a configured model and the four metrics.
4.  Start an evaluation.
5.  Show the run status and progress.
6.  Open the summary and explain each metric.
7.  Open a case with an unsupported claim and inspect the judge's
    evidence.
8.  Show latency and token usage.
9.  Run the same dataset with a second model or prompt version.
10. Compare results and explain differences without treating one
    aggregate score as definitive.

Use real run outputs during the demo. If using sample screenshots or
seeded data, label them as illustrative.

------------------------------------------------------------------------

# 17. Suggested delivery milestones

  -----------------------------------------------------------------------
  Milestone               Deliverable             Acceptance condition
  ----------------------- ----------------------- -----------------------
  M1                      Backend skeleton        Health endpoint and API
                                                  docs work

  M2                      Dataset management      Validated test cases
                                                  can be stored

  M3                      Model integration       One real model call
                                                  returns normalized
                                                  output

  M4                      Evaluation engine       Four metrics return
                                                  validated results

  M5                      Runner and persistence  A complete run survives
                                                  API restart

  M6                      Dashboard               Run summaries and case
                                                  details display

  M7                      Comparison and export   Two compatible runs can
                                                  be compared and
                                                  exported

  M8                      Hardening               Auth, limits, logging,
                                                  tests and deployment
                                                  configuration are in
                                                  place
  -----------------------------------------------------------------------

For a Monday demonstration, prioritize M1--M6 with a small dataset and
controlled execution. Treat multi-provider support, distributed scaling
and full production hardening as subsequent work unless they are
explicitly required.

------------------------------------------------------------------------

# 18. Common mistakes to avoid

1.  **Using only one LLM to generate and judge answers.** This can
    create correlated errors. Keep the target and judge roles distinct
    where possible, and calibrate with human review.
2.  **Treating judge scores as objective truth.** They are estimates
    based on a rubric and can be biased or inconsistent.
3.  **Scoring faithfulness without context.** Mark it not applicable
    when evidence is absent.
4.  **Treating every unsupported claim as a proven falsehood.**
    Distinguish unsupported from contradicted.
5.  **Using a single average as the whole result.** Show distributions,
    failure counts and case-level evidence.
6.  **Ignoring failed cases.** Preserve them and distinguish model
    failures from evaluator failures.
7.  **Losing configuration details.** Snapshot model, prompt, dataset
    and rubric versions for every run.
8.  **Running long evaluations in an HTTP request.** Use a queue and
    worker for the final architecture.
9.  **Retrying every error.** Retry transient errors only and bound
    retries.
10. **Exposing API keys in the frontend.** All provider calls and
    secrets belong on the backend.
11. **Comparing incompatible runs.** Check dataset, prompt, rubric and
    evaluator versions first.
12. **Ignoring cost and rate limits.** Estimate before large runs and
    provide limits and cancellation.

------------------------------------------------------------------------

# 19. Final acceptance criteria

The product is ready for a meaningful internal evaluation when a user
can:

-   Create a project and import a validated dataset.
-   Configure a target model without exposing credentials.
-   Select evaluation metrics and start a run.
-   See run progress and recover results after a restart.
-   Inspect generated answers, scores, explanations and evidence.
-   Distinguish model failures from evaluator failures.
-   View latency and token usage with missing data handled honestly.
-   Compare compatible runs and inspect per-case differences.
-   Export results.
-   Reproduce a run from its stored configuration and version
    references.

A production deployment additionally needs security, load, recovery,
privacy and cost-control validation.

------------------------------------------------------------------------

# 20. Glossary

  -----------------------------------------------------------------------
  Term                                Meaning
  ----------------------------------- -----------------------------------
  LLM                                 Large Language Model

  LLM evaluation                      Systematic measurement of model
                                      response quality and performance

  Test case                           A question plus optional expected
                                      answer, context and metadata

  Target model                        The LLM being tested

  Judge model                         An LLM used to evaluate a target
                                      model's response

  Rubric                              Explicit scoring criteria and score
                                      anchors

  Faithfulness                        Whether output is supported by
                                      supplied evidence

  Hallucination                       Unsupported or fabricated content
                                      in a response

  Latency                             Time taken for a model request to
                                      complete

  Tokens                              Units used to represent model input
                                      and output

  Evaluation run                      A recorded execution of a dataset
                                      against a specific configuration

  Calibration                         Checking automated scores against
                                      human-reviewed judgments

  Idempotency                         Ensuring retries do not create
                                      unintended duplicate effects
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## Recommended first implementation

Build the system in this order:

**Dataset → one target LLM → four evaluators → sequential runner →
database → FastAPI → React dashboard → comparison → queue and production
hardening.**

This gives you a working application early, makes each stage
independently testable, and preserves a path to a robust final product.
