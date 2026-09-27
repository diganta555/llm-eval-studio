import React from 'react';

interface MetricBadgeProps {
  name: string;
  score?: number | null;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const MetricBadge: React.FC<MetricBadgeProps> = ({
  name,
  score,
  showLabel = true,
  size = 'md',
}) => {
  if (score === null || score === undefined) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        {showLabel && <span className="text-slate-400 capitalize">{name}:</span>}
        <span>N/A</span>
      </span>
    );
  }

  const isHallucination = name.toLowerCase().includes('hallucination');
  const rounded = Math.round(score * 10) / 10;

  // For Hallucination: Lower is better (0-15 is great, 16-35 warning, >35 bad)
  // For others: Higher is better (80-100 is great, 50-79 warning, <50 bad)
  let colorStyle = '';
  if (isHallucination) {
    if (score <= 15) {
      colorStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-400 dark:border-emerald-800/60';
    } else if (score <= 35) {
      colorStyle = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/70 dark:text-amber-400 dark:border-amber-800/60';
    } else {
      colorStyle = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-400 dark:border-rose-800/60';
    }
  } else {
    if (score >= 80) {
      colorStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-400 dark:border-emerald-800/60';
    } else if (score >= 50) {
      colorStyle = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/70 dark:text-amber-400 dark:border-amber-800/60';
    } else {
      colorStyle = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-400 dark:border-rose-800/60';
    }
  }

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5 font-semibold',
  }[size];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded border font-mono font-medium ${colorStyle} ${sizeClasses}`}>
      {showLabel && <span className="font-sans capitalize text-slate-600 dark:text-slate-300">{name}:</span>}
      <span>{rounded}{score <= 1.0 && score > 0 ? '' : '%'}</span>
    </span>
  );
};
