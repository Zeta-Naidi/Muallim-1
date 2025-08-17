import React from 'react';
import { Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface ActivityCardProps {
  type: 'homework' | 'lesson' | 'material' | 'announcement';
  title: string;
  date: Date | null;
  status?: 'pending' | 'completed' | 'overdue' | 'upcoming';
  priority?: 'low' | 'medium' | 'high';
  description?: string;
  className?: string;
}

const typeVariants = {
  homework: {
    icon: Clock,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  lesson: {
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  material: {
    icon: AlertCircle,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  announcement: {
    icon: AlertCircle,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
};

const statusVariants = {
  pending: {
    color: 'text-amber-600',
    bg: 'bg-amber-100',
    label: 'In attesa',
  },
  completed: {
    color: 'text-green-600',
    bg: 'bg-green-100',
    label: 'Completato',
  },
  overdue: {
    color: 'text-red-600',
    bg: 'bg-red-100',
    label: 'Scaduto',
  },
  upcoming: {
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    label: 'Prossimo',
  },
};

const priorityVariants = {
  low: {
    color: 'text-gray-500',
    bg: 'bg-gray-100',
  },
  medium: {
    color: 'text-amber-600',
    bg: 'bg-amber-100',
  },
  high: {
    color: 'text-red-600',
    bg: 'bg-red-100',
  },
};

export const ActivityCard: React.FC<ActivityCardProps> = ({
  type,
  title,
  date,
  status = 'pending',
  priority,
  description,
  className = '',
}) => {
  const typeConfig = typeVariants[type];
  const statusConfig = statusVariants[status];
  const priorityConfig = priority ? priorityVariants[priority] : null;
  const IconComponent = typeConfig.icon;

  const formatDate = (date: Date | null): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return 'Data non valida';
    }
    return format(date, 'd MMMM yyyy', { locale: it });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.01, x: 4 }}
      transition={{ duration: 0.2 }}
      className={`bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200 ${className}`}
    >
      <div className="flex items-start space-x-3">
        <div className={`w-10 h-10 rounded-full ${typeConfig.bg} flex items-center justify-center flex-shrink-0`}>
          <IconComponent className={`h-5 w-5 ${typeConfig.color}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-900 truncate">
                {title}
              </h4>
              {description && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {description}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {formatDate(date)}
              </p>
            </div>
            
            <div className="flex items-center space-x-2 ml-2">
              {priority && (
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${priorityConfig?.bg} ${priorityConfig?.color}`}>
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </span>
              )}
              
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Progress bar for pending items */}
      {status === 'pending' && date && (
        <div className="mt-3 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Tempo rimanente</span>
            <span>
              {Math.max(0, Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} giorni
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '60%' }}
              transition={{ duration: 1, delay: 0.5 }}
              className="bg-blue-500 h-1 rounded-full"
            />
          </div>
        </div>
      )}
    </motion.div>
  );
};
