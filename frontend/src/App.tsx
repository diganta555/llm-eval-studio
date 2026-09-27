import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import type { NavTab } from './components/common/Sidebar';
import type { Project, RunListItem, SystemStatus } from './types';
import { api } from './services/api';
import { ThemeProvider } from './context/ThemeContext';

// Route-level code splitting with React.lazy
const DashboardView = lazy(() => import('./components/dashboard/DashboardView').then(m => ({ default: m.DashboardView })));
const DatasetsView = lazy(() => import('./components/datasets/DatasetsView').then(m => ({ default: m.DatasetsView })));
const ModelsView = lazy(() => import('./components/models/ModelsView').then(m => ({ default: m.ModelsView })));
const PromptsView = lazy(() => import('./components/prompts/PromptsView').then(m => ({ default: m.PromptsView })));
const RunsListView = lazy(() => import('./components/runs/RunsListView').then(m => ({ default: m.RunsListView })));
const RunDetailsView = lazy(() => import('./components/runs/RunDetailsView').then(m => ({ default: m.RunDetailsView })));
const CompareRunsView = lazy(() => import('./components/compare/CompareRunsView').then(m => ({ default: m.CompareRunsView })));
const ValidationView = lazy(() => import('./components/validation/ValidationView').then(m => ({ default: m.ValidationView })));
const NewRunModal = lazy(() => import('./components/runs/NewRunModal').then(m => ({ default: m.NewRunModal })));

const ViewLoadingFallback: React.FC = () => (
  <div className="p-16 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-3">
    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    <span className="text-xs font-medium">Loading view...</span>
  </div>
);

const VALID_TABS: NavTab[] = ['dashboard', 'datasets', 'models', 'prompts', 'runs', 'compare', 'validation'];

function AppContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation State with URL hash persistence on refresh
  const [activeTab, setActiveTabState] = useState<NavTab>(() => {
    const hash = window.location.hash.replace('#', '') as NavTab;
    return VALID_TABS.includes(hash) ? hash : 'dashboard';
  });

  const setActiveTab = (tab: NavTab) => {
    window.location.hash = tab;
    setActiveTabState(tab);
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as NavTab;
      if (VALID_TABS.includes(hash)) {
        setActiveTabState(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  // Modals
  const [showNewRunModal, setShowNewRunModal] = useState(false);
  const [preselectedDatasetId, setPreselectedDatasetId] = useState<string | undefined>(undefined);
  const [compareInitialRunAId, setCompareInitialRunAId] = useState<string | undefined>(undefined);

  // Load initial system status and projects
  const initApp = async () => {
    try {
      setLoading(true);
      const [status, projList] = await Promise.all([
        api.getSystemStatus().catch(() => null),
        api.getProjects(),
      ]);

      setSystemStatus(status);
      setProjects(projList);

      if (projList.length > 0 && !selectedProject) {
        setSelectedProject(projList[0]);
      }
    } catch (err: any) {
      console.error('Initialization error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initApp();
  }, []);

  // Fetch runs for the selected project
  const loadRuns = async () => {
    if (!selectedProject) return;
    try {
      const runsData = await api.getRuns(selectedProject.id);
      setRuns(runsData);
    } catch (err: any) {
      console.error('Failed to load runs:', err);
    }
  };

  useEffect(() => {
    loadRuns();
  }, [selectedProject?.id]);

  // Polling: Auto-refresh runs when any run is in progress (RUNNING, QUEUED, PENDING)
  useEffect(() => {
    const hasActiveRun = runs.some((r) =>
      ['running', 'queued', 'pending'].includes(r.status.toLowerCase())
    );

    // If there is an active run, poll every 3 seconds; otherwise light poll every 15s
    const pollInterval = hasActiveRun ? 3000 : 15000;
    const interval = setInterval(() => {
      loadRuns();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [selectedProject?.id, runs]);

  const handleCreateProject = async (name: string, description?: string) => {
    const newProj = await api.createProject(name, description);
    setProjects((prev) => [newProj, ...prev]);
    setSelectedProject(newProj);
  };

  const handleRunStarted = (runId: string) => {
    setShowNewRunModal(false);
    loadRuns();
    setActiveRunId(runId);
  };

  const handleSelectRun = (runId: string) => {
    setActiveRunId(runId);
  };

  const handleCompareWithRun = (runId?: string) => {
    setCompareInitialRunAId(runId);
    setActiveRunId(null);
    setActiveTab('compare');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-200">
      {/* Top Navigation Bar */}
      <Header
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={(proj) => {
          setSelectedProject(proj);
          setActiveRunId(null);
        }}
        onCreateProject={handleCreateProject}
        systemStatus={systemStatus}
        onNewRunClick={() => {
          setPreselectedDatasetId(undefined);
          setShowNewRunModal(true);
        }}
      />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeRunId ? 'runs' : activeTab}
          onTabChange={(tab) => {
            setActiveRunId(null);
            setActiveTab(tab);
          }}
          runCount={runs.length}
        />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">
              Initializing LLM Eval Studio...
            </div>
          ) : (
            <Suspense fallback={<ViewLoadingFallback />}>
              {activeRunId ? (
                <RunDetailsView
                  runId={activeRunId}
                  project={selectedProject}
                  onBack={() => {
                    setActiveRunId(null);
                    loadRuns();
                  }}
                  onCompareWithThis={(runId) => handleCompareWithRun(runId)}
                />
              ) : activeTab === 'dashboard' ? (
                <DashboardView
                  runs={runs}
                  project={selectedProject}
                  onSelectRun={handleSelectRun}
                  onNewRunClick={() => {
                    setPreselectedDatasetId(undefined);
                    setShowNewRunModal(true);
                  }}
                  onGoToDatasets={() => setActiveTab('datasets')}
                  onGoToModels={() => setActiveTab('models')}
                  onGoToCompare={() => setActiveTab('compare')}
                />
              ) : activeTab === 'datasets' ? (
                <DatasetsView
                  project={selectedProject}
                  onNewRunForDataset={(datasetId) => {
                    setPreselectedDatasetId(datasetId);
                    setShowNewRunModal(true);
                  }}
                />
              ) : activeTab === 'models' ? (
                <ModelsView project={selectedProject} />
              ) : activeTab === 'prompts' ? (
                <PromptsView project={selectedProject} />
              ) : activeTab === 'runs' ? (
                <RunsListView
                  runs={runs}
                  project={selectedProject}
                  onSelectRun={handleSelectRun}
                  onNewRunClick={() => {
                    setPreselectedDatasetId(undefined);
                    setShowNewRunModal(true);
                  }}
                  onCompareRuns={(runId) => handleCompareWithRun(runId)}
                  onRefresh={loadRuns}
                />
              ) : activeTab === 'compare' ? (
                <CompareRunsView
                  runs={runs}
                  project={selectedProject}
                  initialRunAId={compareInitialRunAId}
                  onNewRunClick={() => {
                    setPreselectedDatasetId(undefined);
                    setShowNewRunModal(true);
                  }}
                />
              ) : activeTab === 'validation' ? (
                <ValidationView project={selectedProject} />
              ) : null}
            </Suspense>
          )}
        </main>
      </div>

      {/* New Evaluation Run Modal */}
      {showNewRunModal && (
        <Suspense fallback={null}>
          <NewRunModal
            project={selectedProject}
            onClose={() => setShowNewRunModal(false)}
            onRunStarted={handleRunStarted}
            preselectedDatasetId={preselectedDatasetId}
          />
        </Suspense>
      )}
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
