import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Home, ArrowLeft, HelpCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

export const NotFound: React.FC = () => {
  const { userProfile } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <HelpCircle className="h-10 w-10 text-blue-500 animate-bounce" />
        </div>

        <h1 className="text-5xl font-bold text-blue-700 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Pagina non trovata</h2>

        <p className="text-gray-600 mb-6">
          Sembra che tu sia finito in una classe che non esiste...<br />
          Ma ogni errore è un passo verso la conoscenza!
        </p>

        <div className="bg-blue-50 border border-blue-100 rounded-md px-4 py-3 text-sm text-blue-800 italic mb-6">
          Questa pagina non esiste.<br /> O forse è solo invisibile come il <strong>Jinn della 6 Domenica Mattina</strong>.
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to={userProfile ? '/dashboard' : '/'}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition"
          >
            <Home className="h-4 w-4" />
            {userProfile ? 'Torna alla Dashboard' : 'Torna alla Home'}
          </Link>

          <Button
            onClick={() => window.history.back()}
            variant="outline"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
            className="w-full"
          >
            Torna indietro
          </Button>
        </div>

        <div className="mt-8 text-xs text-gray-400">
          Muallim © {new Date().getFullYear()} — Powered By Sabr ☕ E Tanto Duaa 💻
        </div>
      </div>
    </div>
  );
};
