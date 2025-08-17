import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';

interface TrendData {
  value: string;
  type: 'positive' | 'negative' | 'neutral';
}

interface StatCardProps {
  icon: React.ReactElement<LucideIcon>;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: TrendData;
  color?: 'blue' | 'green' | 'purple' | 'amber' | 'rose';
  loading?: boolean;
  className?: string;
}

const colorVariants = {
  blue: {
    bg: 'bg-blue-50',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    border: 'border-blue-200',
  },
  green: {
    bg: 'bg-green-50',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    border: 'border-green-200',
  },
  purple: {
    bg: 'bg-purple-50',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    border: 'border-purple-200',
  },
  amber: {
    bg: 'bg-amber-50',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    border: 'border-amber-200',
  },
  rose: {
    bg: 'bg-rose-50',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
    border: 'border-rose-200',
  },
};

const trendVariants = {
  positive: 'text-green-600',
  negative: 'text-red-600',
  neutral: 'text-gray-500',
};

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  title,
  value,
  subtitle,
  trend,
  color = 'blue',
  loading = false,
  className = '',
}) => {
  const colors = colorVariants[color];

  if (loading) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
            <div className="w-16 h-4 bg-gray-200 rounded"></div>
          </div>
          <div className="space-y-2">
            <div className="w-20 h-8 bg-gray-200 rounded"></div>
            <div className="w-24 h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className={`bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-200 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-full ${colors.iconBg} flex items-center justify-center`}>
          <div className={`h-6 w-6 ${colors.iconColor}`}>
            {icon}
          </div>
        </div>
        
        {trend && (
          <div className={`flex items-center text-sm font-medium ${trendVariants[trend.type]}`}>
            {trend.type === 'positive' && <TrendingUp className="h-4 w-4 mr-1" />}
            {trend.type === 'negative' && <TrendingDown className="h-4 w-4 mr-1" />}
            {trend.value}
          </div>
        )}
      </div>
      
      <div className="space-y-1">
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="text-3xl font-light text-gray-900"
        >
          {value}
        </motion.div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-500">{title}</span>
          {subtitle && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
              {subtitle}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};
