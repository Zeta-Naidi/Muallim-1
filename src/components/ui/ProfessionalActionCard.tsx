import React from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon, ArrowRight } from 'lucide-react';

interface ActionItem {
  title: string;
  description: string;
  href: string;
  icon: React.ReactElement<LucideIcon>;
}

interface ProfessionalActionCardProps {
  title: string;
  actions: ActionItem[];
  className?: string;
}

export const ProfessionalActionCard: React.FC<ProfessionalActionCardProps> = ({
  title,
  actions,
  className = '',
}) => {
  return (
    <div className={`bg-white border border-slate-200 rounded-lg ${className}`}>
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          {actions.map((action, index) => (
            <Link
              key={index}
              to={action.href}
              className="block p-4 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all duration-200 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                    <div className="w-5 h-5 text-slate-600">
                      {action.icon}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{action.title}</h4>
                    <p className="text-sm text-slate-600">{action.description}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
