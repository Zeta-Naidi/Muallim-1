import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ProfessionalStatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: string;
    trend: 'up' | 'down' | 'neutral';
  };
  icon: React.ReactElement<LucideIcon>;
  className?: string;
}

export const ProfessionalStatCard: React.FC<ProfessionalStatCardProps> = ({
  title,
  value,
  change,
  icon,
  className = '',
}) => {
  const getTrendColor = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return 'text-emerald-600';
      case 'down':
        return 'text-red-600';
      case 'neutral':
        return 'text-slate-500';
      default:
        return 'text-slate-500';
    }
  };

  return (
    <div className={`bg-white border border-slate-200 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
          <p className="text-2xl font-semibold text-slate-900">{value}</p>
          {change && (
            <p className={`text-sm font-medium mt-1 ${getTrendColor(change.trend)}`}>
              {change.value}
            </p>
          )}
        </div>
        <div className="ml-4">
          <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center">
            <div className="w-6 h-6 text-slate-600">
              {icon}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
