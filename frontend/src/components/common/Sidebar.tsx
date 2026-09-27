import React from 'react';
import {
  LayoutDashboard,
  Database,
  Cpu,
  FileCode,
  Activity,
  GitCompare,
  Sliders,
  ShieldCheck,
} from 'lucide-react';

export type NavTab = 'dashboard' | 'datasets' | 'models' | 'prompts' | 'runs' | 'compare' | 'validation';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  runCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, runCount = 0 }) => {
  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'datasets', label: 'Datasets', icon: Database },
    { id: 'models', label: 'Model Configs', icon: Cpu },
    { id: 'prompts', label: 'Prompt Versions', icon: FileCode },
    { id: 'runs', label: 'Evaluation Runs', icon: Activity, badge: runCount },
    { id: 'compare', label: 'Compare Runs', icon: GitCompare },
    { id: 'validation', label: 'GT Validation', icon: ShieldCheck },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm flex flex-col justify-between p-4 shrink-0 transition-colors">
      <div className="space-y-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3">
            Evaluation Workbench
          </span>
          <nav className="mt-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/40 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Evaluation Dimensions Quick Reference */}
        <div className="p-3.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
          <div className="font-semibold text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Metric Dimensions</span>
          </div>
          <ul className="text-slate-600 dark:text-slate-400 space-y-1 text-[11px]">
            <li className="flex justify-between items-center">
              <span>Correctness</span>
              <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-mono">Higher is better ↑</span>
            </li>
            <li className="flex justify-between items-center">
              <span>Relevance</span>
              <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-mono">Higher is better ↑</span>
            </li>
            <li className="flex justify-between items-center">
              <span>Faithfulness</span>
              <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-mono">Higher is better ↑</span>
            </li>
            <li className="flex justify-between items-center">
              <span>Hallucination</span>
              <span className="text-rose-600 dark:text-rose-400 text-[10px] font-mono">Lower is better ↓</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Footer info */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <span>Offline Mock & Live OpenAI</span>
        <span className="font-mono text-slate-400 dark:text-slate-500">FastAPI + React</span>
      </div>
    </aside>
  );
};
