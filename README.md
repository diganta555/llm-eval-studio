# LLM Eval Studio

LLM Eval Studio is a web-based proof of concept (POC) for evaluating and comparing Large Language Model (LLM) outputs. It helps teams run evaluation datasets against configured models, inspect individual cases, compare runs, and review evaluation metrics.

> **POC disclaimer:** Scores depend on the dataset, references, evaluator, and configuration. Treat them as experimental until validated against a sufficiently large, human-reviewed sample.

## Features

- Dataset management for evaluation examples and reference answers
- Prompt versioning
- LLM provider/model configuration
- Evaluation runs and run history
- Quality metrics: correctness, relevance, faithfulness, and hallucination-related results, where configured
- Latency and token-usage tracking, when available
- Run comparison and regression checks
- Ground-truth validation with human-reviewed labels, agreement, confusion matrices, and case inspection
- CSV/JSON exports, where available

## Tech stack

- Frontend: React, TypeScript, Vite
- Backend: Python, FastAPI, SQLAlchemy
- Local database: SQLite
- Backend tests: pytest

## Project structure

```text
LLM EVALS/
├── backend/
│   ├── app/                 # FastAPI application
│   ├── tests/               # Backend tests
│   ├── .env.example         # Environment template; placeholders only
│   └── requirements.txt     # Python dependencies, if present
├── frontend/
│   ├── src/                 # React application
│   └── package.json         # Frontend scripts and dependencies
├── sample-data/             # Sample data, if included
├── .gitignore
└── README.md
```

## Prerequisites

Install Git, Python 3.10+ (or the version required by the project), Node.js, and npm. You will also need API keys for whichever supported model providers you use.

Check versions:

```bash
git --version
python3 --version
node --version
npm --version
```

## Run locally (Linux)

### 1. Get the code

```bash
git clone https://github.com/diganta555/llm-eval-studio.git
cd llm-eval-studio
```

For an existing local checkout, use its project directory instead, for example:

```bash
cd ~/Documents/LLM\ EVALS
```

### 2. Set up and start the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If `requirements.txt` is not present, use the dependency file and instructions actually included in the backend.

Create a local environment file if the template exists:

```bash
cp .env.example .env
nano .env
```

Add your own credentials as needed. Example only:

```dotenv
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

Use only the providers supported by the code. Keep real keys in `.env`; never commit them. The `.env.example` file must contain placeholders only.

Start the API from the `backend` directory:

```bash
uvicorn app.main:app --reload --port 8000
```

The API is expected at `http://localhost:8000`; FastAPI's interactive docs are normally at `http://localhost:8000/docs`.

### 3. Set up and start the frontend

Open a second terminal:

```bash
cd ~/Documents/LLM\ EVALS/frontend
npm install
npm run dev
```

Open the URL printed by Vite (commonly `http://localhost:5173`). If the frontend cannot reach the API, check the API base URL configured in the frontend and the backend's CORS settings.

## How it works

1. **Prepare a dataset:** add test inputs and reference/expected answers where applicable.
2. **Choose a prompt version:** select the prompt configuration you want to evaluate.
3. **Configure a model:** select a supported model and provide its API key through the backend environment.
4. **Run evaluation:** the backend processes the selected cases and records model outputs and evaluator results.
5. **Inspect results:** review aggregate metrics and individual examples; averages can hide important failures.
6. **Compare runs:** compare runs with compatible datasets and settings. Record model, prompt, parameter, and evaluator changes.
7. **Validate the evaluator:** compare automated labels with human-reviewed labels. Inspect disagreements and confusion matrices.
8. **Export or investigate:** use available exports and investigate regressions, outliers, latency, and token usage.

### Metric interpretation

- **Correctness:** whether an answer meets the expected answer or task criteria.
- **Relevance:** whether the response addresses the input.
- **Faithfulness:** whether claims are supported by supplied context, when applicable.
- **Hallucination:** unsupported or fabricated claims, according to the configured evaluator.
- **Latency:** elapsed time recorded for a request.
- **Token usage:** input/output token counts when returned by the provider.

Check the backend implementation for the exact scoring method and thresholds. LLM-as-a-judge scores are estimates, not objective ground truth.

### Ground-truth validation

Human-reviewed labels are the reference for checking evaluator behavior. Always show the reviewed-case count alongside validation metrics. A small sample is preliminary; do not call provisional agreement verified accuracy. If the UI reports `INSUFFICIENT_DATA`, do not treat its score as reliable validation.

## Tests and build

Backend tests:

```bash
cd backend
source .venv/bin/activate
python -m pytest -v tests/
```

Frontend production build:

```bash
cd frontend
npm run build
```

## Secrets and data

- Keep real API keys in `backend/.env` or an appropriate deployment secret store.
- Commit only an example environment file with fake placeholder values.
- If a key was exposed or committed, revoke it and create a replacement.
- Do not commit `.env`, virtual environments, `node_modules`, or local databases.
- Back up local evaluation data before resetting the database.
- For shared/production deployment, configure persistent storage and a suitable database; hosted filesystems may be ephemeral.

Before committing, inspect the files:

```bash
git status
git diff --cached
```

## Troubleshooting

**`uvicorn: command not found`**

```bash
cd backend
source .venv/bin/activate
python -m pip install -r requirements.txt
```

**Frontend cannot reach the API**
- Confirm the backend is running on the configured port.
- Check the frontend API URL and backend CORS settings.
- Review the browser console and backend logs.

**Missing or invalid API key**
- Verify the key in the backend environment.
- Restart the backend after changing environment variables.
- Confirm the selected model/provider is supported. Do not share keys in logs or screenshots.

**GitHub blocks a push for a secret**
Remove the secret from the file and the commits being pushed. Do not bypass protection for a real credential. Revoke and rotate exposed keys.

## Limitations

This is a POC, not automatically a production-ready service. Evaluation quality depends on representative data, suitable references, sound evaluator design, and human validation. LLM judges may be inconsistent or biased. Provider metadata affects token and latency reporting. Review authentication, authorization, rate limits, monitoring, and deployment security before making the app publicly accessible.

## Contributing

1. Create a branch for your change.
2. Add or update tests.
3. Run backend tests and the frontend build.
4. Review the diff for secrets and private data.
5. Commit and open a pull request.

## License

No license is specified. Add a `LICENSE` file and update this section before distributing the project under an open-source license.
