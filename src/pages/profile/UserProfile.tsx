import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { 
  User as UserIcon, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Save, 
  AlertCircle, 
  CheckCircle,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { actionLogger } from '../../services/actionLogger';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { motion, AnimatePresence } from 'framer-motion';

interface ProfileFormValues {
  displayName: string;
  phoneNumber?: string;
  address?: string;
  birthDate?: string;
  gender?: string;
  emergencyContact?: string;
  parentName?: string;
  parentContact?: string;
}

export const UserProfile: React.FC = () => {
  const { userProfile } = useAuth();
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<ProfileFormValues>();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (userProfile) {
      // Format date for the input field
      let birthDateFormatted = '';
      if (userProfile.birthDate) {
        const birthDate = userProfile.birthDate instanceof Date 
          ? userProfile.birthDate 
          : new Date(userProfile.birthDate);
        
        // Check if the date is valid
        if (!isNaN(birthDate.getTime())) {
          birthDateFormatted = format(birthDate, 'yyyy-MM-dd');
        }
      }

      reset({
        displayName: userProfile.displayName,
        phoneNumber: userProfile.phoneNumber || '',
        address: userProfile.address || '',
        birthDate: birthDateFormatted,
        gender: userProfile.gender || '',
        emergencyContact: userProfile.emergencyContact || '',
        parentName: userProfile.parentName || '',
        parentContact: userProfile.parentContact || '',
      });
    }
  }, [userProfile, reset]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (!userProfile) return;
    
    setIsLoading(true);
    setMessage(null);
    
    try {
      const userRef = doc(db, 'users', userProfile.id);
      
      const updates: Record<string, any> = {
        displayName: data.displayName,
        phoneNumber: data.phoneNumber || null,
        address: data.address || null,
        gender: data.gender || null,
        emergencyContact: data.emergencyContact || null,
        updatedAt: new Date()
      };
      
      // Only include these fields for students
      if (userProfile.role === 'student') {
        updates.parentName = data.parentName || null;
        updates.parentContact = data.parentContact || null;
      }
      
      // Handle birth date conversion
      if (data.birthDate) {
        updates.birthDate = new Date(data.birthDate);
      } else {
        updates.birthDate = null;
      }
      
      await updateDoc(userRef, updates);
      
      // Log profile update
      await actionLogger.logAction(
        userProfile.id,
        userProfile.email,
        userProfile.role,
        'user_updated',
        {
          targetType: 'user',
          targetId: userProfile.id,
          targetName: userProfile.displayName,
          details: { updatedFields: Object.keys(updates).filter(key => key !== 'updatedAt') }
        }
      );
      
      setMessage({ type: 'success', text: 'Profilo aggiornato con successo' });
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Errore nell\'aggiornamento del profilo' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!userProfile) return null;

  return (
    <PageContainer
      title="Il Mio Profilo"
      description="Visualizza e modifica le tue informazioni personali"
    >
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mb-6 p-4 rounded-xl flex items-center ${
              message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 mr-3 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <Card variant="elevated" className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
          <CardTitle className="flex items-center text-gray-900">
            <UserIcon className="h-5 w-5 mr-2 text-blue-600" />
            Informazioni Personali
          </CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mr-4">
                <span className="text-blue-700 font-medium text-xl">
                  {userProfile.displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">{userProfile.displayName}</h3>
                <p className="text-sm text-gray-600">{userProfile.email}</p>
                <div className="mt-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <Shield className="h-3 w-3 mr-1" />
                    {userProfile.role === 'admin' ? 'Amministratore' : 
                     userProfile.role === 'teacher' ? 'Insegnante' : 'Studente'}
                  </span>
                  {userProfile.role === 'student' && userProfile.classId && (
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Classe assegnata
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Nome completo"
                leftIcon={<UserIcon className="h-5 w-5 text-gray-400" />}
                error={errors.displayName?.message}
                fullWidth
                className="anime-input"
                {...register('displayName', { 
                  required: 'Il nome è obbligatorio',
                  minLength: { value: 2, message: 'Il nome deve avere almeno 2 caratteri' }
                })}
              />

              <Input
                label="Email"
                leftIcon={<Mail className="h-5 w-5 text-gray-400" />}
                value={userProfile.email}
                disabled
                fullWidth
                className="anime-input bg-gray-50"
              />

              <Input
                label="Telefono"
                leftIcon={<Phone className="h-5 w-5 text-gray-400" />}
                error={errors.phoneNumber?.message}
                fullWidth
                className="anime-input"
                {...register('phoneNumber')}
              />

              <Input
                label="Indirizzo"
                leftIcon={<MapPin className="h-5 w-5 text-gray-400" />}
                error={errors.address?.message}
                fullWidth
                className="anime-input"
                {...register('address')}
              />

              <Input
                label="Data di nascita"
                type="date"
                leftIcon={<Calendar className="h-5 w-5 text-gray-400" />}
                error={errors.birthDate?.message}
                fullWidth
                className="anime-input"
                {...register('birthDate')}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Genere
                </label>
                <select
                  className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white py-3 px-4 transition-colors"
                  {...register('gender')}
                >
                  <option value="">Seleziona genere</option>
                  <option value="male">Maschio</option>
                  <option value="female">Femmina</option>
                </select>
              </div>

              <Input
                label="Contatto di emergenza"
                error={errors.emergencyContact?.message}
                fullWidth
                className="anime-input"
                {...register('emergencyContact')}
              />

              {userProfile.role === 'student' && (
                <>
                  <Input
                    label="Nome del genitore"
                    error={errors.parentName?.message}
                    fullWidth
                    className="anime-input"
                    {...register('parentName')}
                  />

                  <Input
                    label="Contatto del genitore"
                    error={errors.parentContact?.message}
                    fullWidth
                    className="anime-input"
                    {...register('parentContact')}
                  />
                </>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end space-x-4 bg-gray-50 border-t border-gray-200 p-6">
            <Button
              type="submit"
              isLoading={isLoading}
              disabled={isLoading || !isDirty}
              leftIcon={<Save className="h-4 w-4" />}
              className="anime-button"
            >
              Salva Modifiche
            </Button>
          </CardFooter>
        </form>
      </Card>
    </PageContainer>
  );
};