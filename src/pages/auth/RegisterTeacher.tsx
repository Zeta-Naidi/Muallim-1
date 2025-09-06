import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { 
  GraduationCap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserIcon,
  Phone,
  AlertCircle,
  Calendar,
  User
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/ui/DatePicker';
import { Dropdown } from '../../components/ui/Dropdown';

interface TeacherFormValues {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  address: string;
  city: string;
  postalCode: string;
  birthDate: string;
  gender: string;
}

export const RegisterTeacher: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { registerWithEmail } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  const { register, handleSubmit, control, formState: { errors } } = useForm<TeacherFormValues>();

  const onSubmit = async (data: TeacherFormValues) => {
    try {
      setError(null);
      setIsLoading(true);

      const additionalData = {
        phoneNumber: data.phoneNumber,
        address: data.address,
        city: data.city,
        postalCode: data.postalCode,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        gender: data.gender,
      };

      const displayName = `${data.firstName.trim()} ${data.lastName.trim()}`.trim();

      await registerWithEmail(
        data.email,
        data.password,
        displayName,
        'teacher',
        additionalData
      );

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Errore di registrazione:', error);
      setError(error.message || 'Errore durante la registrazione');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-600/20 rounded-full blur-2xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-blue-400/20 to-cyan-600/20 rounded-full blur-2xl" />
      </div>

      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24 relative">
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mx-auto w-full max-w-lg"
        >
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center justify-center group">
              <motion.div 
                className="w-14 h-14 bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600 rounded-2xl flex items-center justify-center mr-3 shadow-xl"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <GraduationCap className="h-7 w-7 text-white" />
              </motion.div>
              <span className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Muallim
              </span>
            </Link>
          </div>

          <div className="text-center lg:text-left mb-8">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Registrazione Insegnante
                <motion.span 
                  className="inline-block ml-2"
                  animate={shouldReduceMotion ? undefined : { rotate: [0, 14, -8, 14, -4, 10, 0] }}
                  transition={shouldReduceMotion ? undefined : { duration: 1.2, delay: 0.5, repeat: 0 }}
                >
                  👨‍🏫
                </motion.span>
              </h2>
              <p className="text-gray-600">
                Richiedi l'accesso come insegnante alla piattaforma
              </p>
            </motion.div>
          </div>

          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 relative overflow-hidden"
          >
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-400/15 to-pink-600/15 rounded-full blur-2xl opacity-60" />
              <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-blue-400/15 to-cyan-600/15 rounded-full blur-2xl opacity-60" />
            </div>

            <div className="relative">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="mb-6 p-4 bg-red-50/80 backdrop-blur-sm border border-red-200/50 text-red-700 rounded-2xl flex items-start"
                  >
                    <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-medium">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mb-6 p-4 bg-amber-50/80 backdrop-blur-sm border border-amber-200/50 text-amber-700 rounded-2xl">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium mb-1">Richiesta di Approvazione</p>
                    <p className="text-xs">Il tuo account dovrà essere approvato dall'amministrazione prima di poter accedere alla piattaforma.</p>
                  </div>
                </div>
              </div>
                
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={<>Nome <span className="text-red-500">*</span></>}
                    leftIcon={<UserIcon className="h-5 w-5 text-gray-400" />}
                    error={errors.firstName?.message}
                    fullWidth
                    required
                    className="h-12 text-base rounded-2xl border-gray-200/50 bg-gray-50/50 focus:bg-white focus:border-purple-300 transition-all duration-300"
                    {...register('firstName', { 
                      required: 'Il nome è obbligatorio',
                      minLength: { value: 2, message: 'Il nome deve avere almeno 2 caratteri' }
                    })}
                  />

                  <Input
                    label={<>Cognome <span className="text-red-500">*</span></>}
                    leftIcon={<UserIcon className="h-5 w-5 text-gray-400" />}
                    error={errors.lastName?.message}
                    fullWidth
                    required
                    className="h-12 text-base rounded-2xl border-gray-200/50 bg-gray-50/50 focus:bg-white focus:border-purple-300 transition-all duration-300"
                    {...register('lastName', { 
                      required: 'Il cognome è obbligatorio',
                      minLength: { value: 2, message: 'Il cognome deve avere almeno 2 caratteri' }
                    })}
                  />

                  <div className="sm:col-span-2">
                    <Input
                      label={<>Email <span className="text-red-500">*</span></>}
                      type="email"
                      leftIcon={<Mail className="h-5 w-5 text-gray-400" />}
                      error={errors.email?.message}
                      fullWidth
                      required
                      className="h-12 text-base rounded-2xl border-gray-200/50 bg-gray-50/50 focus:bg-white focus:border-purple-300 transition-all duration-300"
                      {...register('email', { 
                        required: 'Email è obbligatoria',
                        pattern: { 
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Indirizzo email non valido'
                        }
                      })}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Input
                      label={<>Password <span className="text-red-500">*</span></>}
                      type={showPassword ? "text" : "password"}
                      leftIcon={<Lock className="h-5 w-5 text-gray-400" />}
                      rightIcon={
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded-lg hover:bg-gray-100 transition-all duration-200"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </motion.button>
                      }
                      error={errors.password?.message}
                      fullWidth
                      required
                      className="h-12 text-base rounded-2xl border-gray-200/50 bg-gray-50/50 focus:bg-white focus:border-purple-300 transition-all duration-300"
                      {...register('password', { 
                        required: 'Password è obbligatoria',
                        minLength: { value: 6, message: 'La password deve avere almeno 6 caratteri' }
                      })}
                    />
                  </div>

                  <DatePicker
                    label="Data di nascita"
                    leftIcon={<Calendar className="h-5 w-5 text-gray-400" />}
                    error={errors.birthDate?.message}
                    fullWidth
                    required
                    className="rounded-2xl"
                    {...register('birthDate', {
                      required: 'La data di nascita è obbligatoria',
                      validate: (value) => {
                        if (!value) return 'La data di nascita è obbligatoria';
                        const birthDate = new Date(value);
                        const today = new Date();
                        const age = today.getFullYear() - birthDate.getFullYear();
                        if (age < 18) {
                          return 'Gli insegnanti devono essere maggiorenni';
                        }
                        return true;
                      }
                    })}
                  />

                  <Controller
                    name="gender"
                    control={control}
                    rules={{ required: 'Il genere è obbligatorio' }}
                    render={({ field }) => (
                      <Dropdown
                        label="Genere"
                        leftIcon={<User className="h-5 w-5 text-gray-400" />}
                        placeholder="Genere"
                        options={[
                          { value: 'male', label: 'Maschio' },
                          { value: 'female', label: 'Femmina' }
                        ]}
                        value={field.value}
                        onChange={field.onChange}
                        error={errors.gender?.message}
                        fullWidth
                        required
                        className="rounded-2xl"
                      />
                    )}
                  />

                  <Input
                    label={<>Numero di telefono <span className="text-red-500">*</span></>}
                    type="tel"
                    leftIcon={<Phone className="h-5 w-5 text-gray-400" />}
                    error={errors.phoneNumber?.message}
                    fullWidth
                    placeholder="+39 123 456 7890"
                    required
                    className="h-12 text-base rounded-2xl border-gray-200/50 bg-gray-50/50 focus:bg-white focus:border-purple-300 transition-all duration-300"
                    {...register('phoneNumber', {
                      required: 'Il numero di telefono è obbligatorio',
                      pattern: {
                        value: /^[\+]?[1-9][\d]{0,15}$/,
                        message: 'Inserisci un numero di telefono valido'
                      }
                    })}
                  />

                  <Input
                    label={<>Indirizzo <span className="text-red-500">*</span></>}
                    leftIcon={<UserIcon className="h-5 w-5 text-gray-400" />}
                    error={errors.address?.message}
                    fullWidth
                    placeholder="Via e numero civico"
                    required
                    className="h-12 text-base rounded-2xl border-gray-200/50 bg-gray-50/50 focus:bg-white focus:border-purple-300 transition-all duration-300"
                    {...register('address', { required: "L'indirizzo è obbligatorio" })}
                  />

                  <Input
                    label={<>Città <span className="text-red-500">*</span></>}
                    leftIcon={<UserIcon className="h-5 w-5 text-gray-400" />}
                    error={errors.city?.message}
                    fullWidth
                    placeholder="Città di residenza"
                    required
                    className="h-12 text-base rounded-2xl border-gray-200/50 bg-gray-50/50 focus:bg-white focus:border-purple-300 transition-all duration-300"
                    {...register('city', { required: 'La città è obbligatoria' })}
                  />

                  <Input
                    label={<>CAP <span className="text-red-500">*</span></>}
                    leftIcon={<UserIcon className="h-5 w-5 text-gray-400" />}
                    error={errors.postalCode?.message}
                    fullWidth
                    placeholder="Codice Postale"
                    required
                    className="h-12 text-base rounded-2xl border-gray-200/50 bg-gray-50/50 focus:bg-white focus:border-purple-300 transition-all duration-300"
                    {...register('postalCode', {
                      required: 'Il CAP è obbligatorio',
                      pattern: {
                        value: /^[0-9]{5}$/,
                        message: 'Il CAP deve essere di 5 cifre'
                      }
                    })}
                  />
                </div>
                    
                <div className="flex items-center pt-2">
                  <input
                    id="terms"
                    name="terms"
                    type="checkbox"
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded transition-all duration-200"
                    required
                  />
                  <label htmlFor="terms" className="ml-3 text-sm text-gray-700">
                    Accetto i <a href="#" className="text-purple-600 hover:text-purple-700 font-medium">Termini di Servizio</a> e la <a href="#" className="text-purple-600 hover:text-purple-700 font-medium">Privacy Policy</a>
                  </label>
                </div>

                <div className="pt-4">
                  <Button 
                    type="submit" 
                    fullWidth 
                    isLoading={isLoading}
                    className="h-14 text-base font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group"
                  >
                    <span className="relative z-10">Richiedi Account Insegnante</span>
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-purple-700 to-pink-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      initial={false}
                    />
                  </Button>
                </div>
              </form>
                
              <motion.div 
                initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={shouldReduceMotion ? undefined : { duration: 0.2 }}
                className="mt-8 text-center"
              >
                <p className="text-gray-600">
                  Hai già un account?{' '}
                  <Link 
                    to="/login" 
                    className="font-semibold text-purple-600 hover:text-purple-700 transition-colors relative group"
                  >
                    Accedi ora
                    <motion.div
                      className="absolute bottom-0 left-0 w-0 h-0.5 bg-purple-600"
                      whileHover={{ width: "100%" }}
                      transition={{ duration: 0.2 }}
                    />
                  </Link>
                </p>
              </motion.div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="mt-8 text-center"
          >
            <p className="text-xs text-gray-500 mb-2">
              Accedendo accetti i nostri{' '}
              <a href="#" className="text-purple-600 hover:text-purple-700 transition-colors">
                Termini di Servizio
              </a>
              {' '}e la{' '}
              <a href="#" className="text-purple-600 hover:text-purple-700 transition-colors">
                Privacy Policy
              </a>
            </p>
            <p className="text-xs text-gray-400">
              In caso di problemi contattare: istitutoaverroepc@gmail.com
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};
