import React, { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { STRIPE_PRODUCTS } from '../../stripe-config';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

export const PaymentButton: React.FC = () => {
  const { userProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = getAuth();
  const functions = getFunctions();

  const handlePayment = async () => {
    if (!userProfile) {
      setError('Devi effettuare l\'accesso per procedere al pagamento.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get current Firebase user
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Utente non trovato o non autenticato.');
      }

      // Call Firebase function to create checkout session
      const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');
      const checkoutData = {
        priceId: STRIPE_PRODUCTS.ENROLLMENT_2025.priceId,
        successUrl: `${window.location.origin}/payment/success`,
        cancelUrl: `${window.location.origin}/payment/cancel`,
      };

      const result = await createCheckoutSession(checkoutData);
      const data = result.data as { url: string };

      if (!data.url) {
        throw new Error('URL di pagamento non valido');
      }

      window.location.href = data.url;
    } catch (error: any) {
      console.error('Payment error:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });
      
      // Handle specific Firebase error cases
      if (error.code === 'functions/unauthenticated') {
        setError('Sessione scaduta. Effettua nuovamente l\'accesso.');
      } else if (error.code === 'functions/invalid-argument') {
        setError('Dati di pagamento non validi. Riprova.');
      } else {
        setError(
          error.message || 
          'Si è verificato un errore durante il pagamento. Riprova più tardi.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handlePayment}
        isLoading={isLoading}
        leftIcon={<CreditCard className="h-5 w-5" />}
        fullWidth
      >
        Paga Iscrizione
      </Button>
      {error && (
        <p className="text-sm text-error-600 text-center">{error}</p>
      )}
    </div>
  );
};