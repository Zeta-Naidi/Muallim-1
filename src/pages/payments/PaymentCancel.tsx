import React from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export const PaymentCancel: React.FC = () => {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card variant="elevated" className="max-w-lg w-full">
          <CardContent className="p-8 text-center">
            <div className="flex justify-center mb-6">
              <XCircle className="h-16 w-16 text-error-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Pagamento Annullato
            </h1>
            <p className="text-gray-600 mb-8">
              Il processo di pagamento è stato annullato. Se hai bisogno di assistenza, non esitare a contattarci.
            </p>
            <div className="space-y-4">
              <Button
                onClick={() => window.history.back()}
                fullWidth
              >
                Riprova
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                fullWidth
              >
                Torna alla Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
};