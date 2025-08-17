import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface EnhancedStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: {
    value: string;
    trend: 'up' | 'down' | 'neutral';
  };
  icon: React.ReactElement<LucideIcon>;
  color?: 'slate' | 'gray' | 'zinc' | 'stone' | 'neutral';
  className?: string;
}

const colorVariants = {
  slate: {
    bg: 'bg-gradient-to-br from-slate-50 to-slate-100',
    iconBg: 'bg-slate-700',
    iconColor: 'text-white',
    border: 'border-slate-200',
    accent: 'text-slate-700',
  },
  gray: {
    bg: 'bg-gradient-to-br from-gray-50 to-gray-100',
    iconBg: 'bg-gray-700',
    iconColor: 'text-white',
    border: 'border-gray-200',
    accent: 'text-gray-700',
  },
  zinc: {
    bg: 'bg-gradient-to-br from-zinc-50 to-zinc-100',
    iconBg: 'bg-zinc-700',
    iconColor: 'text-white',
    border: 'border-zinc-200',
    accent: 'text-zinc-700',
  },
  stone: {
    bg: 'bg-gradient-to-br from-stone-50 to-stone-100',
    iconBg: 'bg-stone-700',
    iconColor: 'text-white',
    border: 'border-stone-200',
    accent: 'text-stone-700',
  },
  neutral: {
    bg: 'bg-gradient-to-br from-neutral-50 to-neutral-100',
    iconBg: 'bg-neutral-700',
    iconColor: 'text-white',
    border: 'border-neutral-200',
    accent: 'text-neutral-700',
  },
};

const trendVariants = {
  up: 'text-emerald-600',
  down: 'text-red-600',
  neutral: 'text-slate-500',
};

export const EnhancedStatCard: React.FC<EnhancedStatCardProps> = ({
  title,
  value,
  subtitle,
  change,
  icon,
  color = 'slate',
  className = '',
}) => {
  const colors = colorVariants[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.3 }}
      className={`relative bg-white border ${colors.border} rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden ${className}`}
    >
      {/* Background gradient overlay */}
      <div className={`absolute top-0 right-0 w-32 h-32 ${colors.bg} rounded-full -mr-16 -mt-16 opacity-20`} />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <p className="text-3xl font-bold text-slate-900 mb-1">{value}</p>
            </motion.div>
            {subtitle && (
              <p className={`text-sm font-medium ${colors.accent}`}>{subtitle}</p>
            )}
          </div>
          
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={`w-14 h-14 ${colors.iconBg} rounded-xl flex items-center justify-center shadow-lg`}
          >
            <div className={`w-7 h-7 ${colors.iconColor}`}>
              {icon}
            </div>
          </motion.div>
        </div>
        
        {change && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              change.trend === 'up' ? 'bg-emerald-100 text-emerald-700' :
              change.trend === 'down' ? 'bg-red-100 text-red-700' :
              'bg-slate-100 text-slate-700'
            }`}
          >
            {change.trend === 'up' && (
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {change.trend === 'down' && (
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {change.trend === 'neutral' && (
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            )}
            {change.value}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
