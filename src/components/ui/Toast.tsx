import React from 'react';
import toast, { Toaster, ToastBar } from 'react-hot-toast';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export const ToastProvider: React.FC = () => {
  return (
    <Toaster
      position="top-right"
      gutter={8}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#fff',
          color: '#363636',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          padding: '16px',
          fontSize: '14px',
          maxWidth: '400px',
        },
        success: {
          iconTheme: {
            primary: '#10b981',
            secondary: '#fff',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fff',
          },
        },
      }}
    >
      {(t) => (
        <ToastBar toast={t}>
          {({ icon, message }) => (
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {t.type === 'success' && <CheckCircle className="h-5 w-5 text-success-500" />}
                {t.type === 'error' && <AlertCircle className="h-5 w-5 text-error-500" />}
                {t.type === 'loading' && <Info className="h-5 w-5 text-primary-500 animate-spin" />}
                {t.type === 'blank' && <Info className="h-5 w-5 text-primary-500" />}
              </div>
              <div className="ml-3 flex-1">
                {message}
              </div>
              {t.type !== 'loading' && (
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </ToastBar>
      )}
    </Toaster>
  );
};

export const showToast = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
  loading: (message: string) => toast.loading(message),
  info: (message: string) => toast(message),
};