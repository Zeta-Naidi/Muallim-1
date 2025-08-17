import React from 'react';
import { LucideIcon } from 'lucide-react';

interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
}

interface TableRow {
  [key: string]: string | number | React.ReactNode;
}

interface ProfessionalDataTableProps {
  title: string;
  columns: TableColumn[];
  data: TableRow[];
  emptyMessage?: string;
  className?: string;
}

export const ProfessionalDataTable: React.FC<ProfessionalDataTableProps> = ({
  title,
  columns,
  data,
  emptyMessage = 'Nessun dato disponibile',
  className = '',
}) => {
  return (
    <div className={`bg-white border border-slate-200 rounded-lg ${className}`}>
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="overflow-hidden">
        {data.length > 0 ? (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider ${
                      column.align === 'center' ? 'text-center' :
                      column.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((row, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-6 py-4 text-sm text-slate-900 ${
                        column.align === 'center' ? 'text-center' :
                        column.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-slate-500">{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
};
