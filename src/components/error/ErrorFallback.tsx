import React from 'react';
import { FallbackProps } from 'react-error-boundary';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';

export const ErrorFallback: React.FC<FallbackProps> = ({ 
  error, 
  resetErrorBoundary 
}) => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-error-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="h-8 w-8 text-error-600" />
        </div>
        
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Si è verificato un errore
        </h2>
        
        <div className="bg-error-50 border border-error-200 rounded-lg p-4 mb-6 text-left">
          <p className="text-error-800 font-medium mb-1">Dettagli errore:</p>
          <p className="text-error-700 text-sm font-mono break-words">
            Ci scusiamo per l'inconveniente. Puoi provare a ricaricare la pagina o tornare alla Dashboard.
          </p>
        </div>
        
        <p className="text-gray-600 mb-6">
          Ci scusiamo per l'inconveniente. Puoi provare a ricaricare la pagina o tornare alla dashboard.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={resetErrorBoundary}
            leftIcon={<RotateCcw className="h-4 w-4" />}
            variant="primary"
          >
            <AlertTriangle className="h-8 w-8 text-error-600" />
          </Button>
          
          <Link to="/dashboard">
            <Button
              variant="outline"
              leftIcon={<Home className="h-4 w-4" />}
              className="w-full"
            >
              Torna alla Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};