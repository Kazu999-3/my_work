import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon = '📭',
  title,
  description,
  actionText,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-stone-200/80 bg-stone-100/50 ${className}`}>
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-sm font-bold text-stone-900 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-stone-500 max-w-sm leading-relaxed mb-4">
          {description}
        </p>
      )}
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 bg-primary hover:bg-accent text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
