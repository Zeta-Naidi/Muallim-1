import React from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface ActionItem {
  label: string;
  href: string;
  icon: React.ReactElement<LucideIcon>;
  badge?: number;
}

interface ActionCardProps {
  title: string;
  description?: string;
  icon: React.ReactElement<LucideIcon>;
  actions: ActionItem[];
  gradient?: 'blue' | 'amber' | 'green' | 'purple';
  className?: string;
}

const gradientVariants = {
  blue: {
    bg: 'bg-gradient-to-br from-blue-50 to-indigo-50',
    border: 'border-blue-200',
    header: 'bg-gradient-to-r from-blue-600 to-indigo-600',
    titleColor: 'text-blue-900',
  },
  amber: {
    bg: 'bg-gradient-to-br from-amber-50 to-orange-50',
    border: 'border-amber-200',
    header: 'bg-gradient-to-r from-amber-600 to-orange-600',
    titleColor: 'text-amber-900',
  },
  green: {
    bg: 'bg-gradient-to-br from-green-50 to-emerald-50',
    border: 'border-green-200',
    header: 'bg-gradient-to-r from-green-600 to-emerald-600',
    titleColor: 'text-green-900',
  },
  purple: {
    bg: 'bg-gradient-to-br from-purple-50 to-violet-50',
    border: 'border-purple-200',
    header: 'bg-gradient-to-r from-purple-600 to-violet-600',
    titleColor: 'text-purple-900',
  },
};

export const ActionCard: React.FC<ActionCardProps> = ({
  title,
  description,
  icon,
  actions,
  gradient = 'blue',
  className = '',
}) => {
  const colors = gradientVariants[gradient];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`${colors.bg} shadow-md rounded-xl overflow-hidden border ${colors.border} ${className}`}
    >
      <div className={`${colors.header} px-6 py-4 border-b ${colors.border.replace('border-', 'border-').replace('-200', '-100')}`}>
        <div className="flex items-center text-white">
          <div className="h-5 w-5 mr-3">
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            {description && (
              <p className="text-sm text-white/80 mt-1">{description}</p>
            )}
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-2 gap-4">
          {actions.map((action, index) => (
            <Link key={action.href} to={action.href}>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="relative p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center group"
              >
                <div className={`w-10 h-10 rounded-lg ${colors.bg.replace('to-', 'to-').replace('-50', '-100')} flex items-center justify-center mr-3 group-hover:scale-110 transition-transform`}>
                  <div className={`h-5 w-5 ${colors.titleColor.replace('text-', 'text-').replace('-900', '-600')}`}>
                    {action.icon}
                  </div>
                </div>
                <span className="font-medium text-gray-900">{action.label}</span>
                
                {action.badge && action.badge > 0 && (
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    {action.badge > 99 ? '99+' : action.badge}
                  </div>
                )}
              </motion.div>
            </Link>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
