import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export const PaymentSuccess: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timeout = setTimeout(() => {
      navigate('/dashboard');
    }, 5000);

    return () => clearTimeout(timeout);
  }, [navigate]);

  return (
    <PageContainer>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card variant="elevated" className="max-w-lg w-full">
          <CardContent className="p-8 text-center">
            <div className="flex justify-center mb-6">
              <CheckCircle className="h-16 w-16 text-success-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Pagamento Completato con Successo!
            </h1>
            <p className="text-gray-600 mb-8">
              Grazie per il tuo pagamento. La tua iscrizione è stata confermata.
            </p>
            <Button
              onClick={() => navigate('/dashboard')}
              fullWidth
            >
              Torna alla Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
};