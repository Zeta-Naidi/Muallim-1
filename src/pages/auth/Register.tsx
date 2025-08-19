import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { 
  GraduationCap,
  Users,
  Sparkles,
  CheckCircle,
  ArrowRight,
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
import { Dropdown, type DropdownOption } from '../../components/ui/Dropdown';

interface RegisterFormValues {
  email: string;
  password: string;
  displayName: string;
  phoneNumber?: string;
  address?: string;
  birthDate?: string;
  gender?: string;
  emergencyContact?: string;
  parentName?: string;
  parentContact?: string;
}

const RoleCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  selected: boolean;
}> = ({ icon, title, description, onClick, selected }) => (
  <motion.div
    whileHover={{ scale: 1.02, y: -4 }}
    whileTap={{ scale: 0.98 }}
    className="cursor-pointer group"
    onClick={onClick}
  >
    <div className={`
      relative p-6 rounded-2xl transition-all duration-300 border-2 overflow-hidden
      ${selected 
        ? 'bg-gradient-to-br from-blue-600 to-purple-700 border-blue-500 shadow-2xl shadow-blue-500/25' 
        : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-lg shadow-sm'
      }
    `}>
      {/* Subtle pattern overlay */}
      <div className={`absolute inset-0 opacity-5 transition-opacity duration-300 ${
        selected ? 'opacity-10' : 'opacity-0 group-hover:opacity-5'
      }`}>
        <div className="w-full h-full bg-gradient-to-br from-transparent via-white/30 to-transparent" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-4">
        {/* Icon with modern styling */}
        <motion.div 
          className={`
            w-16 h-16 rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg
            ${selected 
              ? 'bg-white/20 backdrop-blur-sm' 
              : 'bg-gradient-to-br from-blue-50 to-indigo-50 group-hover:from-blue-100 group-hover:to-indigo-100'
            }
          `}
          whileHover={{ scale: 1.04 }}
        >
          {React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
            className: `h-8 w-8 transition-all duration-300 ${
              selected ? 'text-white' : 'text-blue-600 group-hover:text-blue-700'
            }`
          })}
        </motion.div>
        
        {/* Title */}
        <h3 className={`text-xl font-bold transition-colors duration-300 ${
          selected ? 'text-white' : 'text-gray-900 group-hover:text-blue-900'
        }`}>
          {title}
        </h3>
        
        {/* Description */}
        <p className={`text-sm leading-relaxed transition-colors duration-300 ${
          selected ? 'text-blue-100' : 'text-gray-600 group-hover:text-gray-700'
        }`}>
          {description}
        </p>
        
        {/* Selection indicator */}
        <div 
          className={`w-8 h-0.5 rounded-full transition-all duration-300 ${
            selected ? 'bg-white/70' : 'bg-blue-200 group-hover:bg-blue-400 group-hover:w-12'
          }`}
        />
      </div>
      
      {/* Selection badge */}
      {selected && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute top-3 right-3 w-6 h-6 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 }}
            className="w-3 h-3 bg-white rounded-full"
          />
        </motion.div>
      )}
      
      {/* Hover glow effect */}
      <div className={`absolute inset-0 rounded-2xl transition-opacity duration-300 pointer-events-none ${
        selected 
          ? 'bg-gradient-to-br from-blue-400/20 to-purple-600/20 opacity-100' 
          : 'bg-gradient-to-br from-blue-400/10 to-purple-600/10 opacity-0 group-hover:opacity-100'
      }`} />
    </div>
  </motion.div>
);


export const Register: React.FC = () => {
  const [step, setStep] = useState<'role-selection' | 'form'>('role-selection');
  const [selectedRole, setSelectedRole] = useState<'student' | 'teacher' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { registerWithEmail } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  const { register, handleSubmit, control, formState: { errors } } = useForm<RegisterFormValues>();

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      setError(null);
      setIsLoading(true);

      if (!selectedRole) {
        setError('Seleziona un ruolo (Studente o Insegnante)');
        return;
      }

      const role: 'student' | 'teacher' = selectedRole;

      const additionalData = {
        phoneNumber: data.phoneNumber,
        address: data.address,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        gender: data.gender,
        emergencyContact: data.emergencyContact,
        parentName: data.parentName,
        parentContact: data.parentContact,
      };

      await registerWithEmail(
        data.email,
        data.password,
        data.displayName,
        role,
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
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-2xl"
        />
        <div 
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-pink-400/20 to-orange-600/20 rounded-full blur-2xl"
        />
      </div>


      {/* Right Side - Registration Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24 relative">
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mx-auto w-full max-w-lg"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center justify-center group">
              <motion.div 
                className="w-14 h-14 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center mr-3 shadow-xl"
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
                {step === 'role-selection' ? 'Scegli il tuo ruolo' : 'Crea il tuo account'}
                <motion.span 
                  className="inline-block ml-2"
                  animate={shouldReduceMotion ? undefined : { rotate: [0, 14, -8, 14, -4, 10, 0] }}
                  transition={shouldReduceMotion ? undefined : { duration: 1.2, delay: 0.5, repeat: 0 }}
                >
                  ✨
                </motion.span>
              </h2>
              <p className="text-gray-600">
                {step === 'role-selection' 
                  ? 'Seleziona come utilizzerai la piattaforma Muallim'
                  : 'Compila il modulo per completare la registrazione'
                }
              </p>
            </motion.div>
          </div>


          {step === 'role-selection' ? (
            /* Role Selection Step */
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 relative overflow-hidden"
            >
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-3xl" />
              </div>

              <div className="relative">
                <div className="mb-8 text-center">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Che tipo di account vuoi creare?
                  </h3>
                  <p className="text-gray-600">
                    Scegli il ruolo che meglio descrive come utilizzerai la piattaforma
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                  <RoleCard
                    icon={<GraduationCap className="h-8 w-8" />}
                    title="Studente"
                    description="Accedi alle tue lezioni e monitora i progressi"
                    onClick={() => {
                      setSelectedRole('student');
                      setStep('form');
                    }}
                    selected={false}
                  />
                  
                  <RoleCard
                    icon={<Users className="h-8 w-8" />}
                    title="Insegnante"
                    description="Gestisci le tue classi e crea contenuti"
                    onClick={() => {
                      setSelectedRole('teacher');
                      setStep('form');
                    }}
                    selected={false}
                  />
                </div>
                
                <div className="mt-8 text-center">
                  <p className="text-sm text-black-100">
                    Hai già un account?{' '}
                    <Link 
                      to="/login" 
                      className="font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Accedi ora
                    </Link>
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Registration Form Step */
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 relative overflow-hidden"
            >
            {/* Floating Background Elements */}
            <div className="absolute inset-0 overflow-hidden">
              <div 
                className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/15 to-purple-600/15 rounded-full blur-2xl opacity-60" 
              />
              <div 
                className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-pink-400/15 to-orange-600/15 rounded-full blur-2xl opacity-60" 
              />
              <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-indigo-400/10 to-cyan-600/10 rounded-full blur-2xl opacity-50" 
              />
            </div>

            <div className="relative">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Crea il tuo account
                </h3>
                <p className="text-gray-600">
                  Compila il modulo per unirti alla nostra piattaforma educativa
                </p>
              </div>

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
                
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Role Selection as first form field */}
                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                  animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={shouldReduceMotion ? undefined : { duration: 0.2 }}
                  className="mb-6"
                >
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Tipo di account
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <motion.div
                      whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                      className="cursor-pointer"
                      onClick={() => setSelectedRole('student')}
                    >
                      <div className={`
                        p-4 rounded-xl border-2 transition-all duration-300 relative
                        ${selectedRole === 'student' 
                          ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200' 
                          : 'border-gray-200 hover:border-blue-300 hover:shadow-sm bg-white'
                        }
                      `}>
                        <div className="flex items-center space-x-3">
                          <div className={`
                            w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300
                            ${selectedRole === 'student' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}
                          `}>
                            <GraduationCap className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 text-sm">Studente</h4>
                          </div>
                          {selectedRole === 'student' && (
                            <CheckCircle className="h-5 w-5 text-blue-500" />
                          )}
                        </div>
                      </div>
                    </motion.div>
                    
                    <motion.div
                      whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                      className="cursor-pointer"
                      onClick={() => setSelectedRole('teacher')}
                    >
                      <div className={`
                        p-4 rounded-xl border-2 transition-all duration-300 relative
                        ${selectedRole === 'teacher' 
                          ? 'border-purple-500 bg-purple-50 shadow-md ring-2 ring-purple-200' 
                          : 'border-gray-200 hover:border-purple-300 hover:shadow-sm bg-white'
                        }
                      `}>
                        <div className="flex items-center space-x-3">
                          <div className={`
                            w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300
                            ${selectedRole === 'teacher' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'}
                          `}>
                            <Users className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 text-sm">Insegnante</h4>
                          </div>
                          {selectedRole === 'teacher' && (
                            <CheckCircle className="h-5 w-5 text-purple-500" />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={shouldReduceMotion ? undefined : { duration: 0.2 }}
                  >
                    <Input
                      label={
                        <>
                          Nome completo <span className="text-red-500">*</span>
                        </>
                      }
                      leftIcon={<UserIcon className="h-5 w-5 text-gray-400" />}
                      error={errors.displayName?.message}
                      fullWidth
                      required
                      className="h-12 text-base rounded-2xl border-gray-200/50 bg-gray-50/50 focus:bg-white focus:border-blue-300 transition-all duration-300"
                      {...register('displayName', { 
                        required: 'Il nome è obbligatorio',
                        minLength: { value: 2, message: 'Il nome deve avere almeno 2 caratteri' }
                      })}
                    />
                  </motion.div>
                      
                  <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={shouldReduceMotion ? undefined : { duration: 0.2 }}
                  >
                    <Input
                      label={
                        <>
                          Email <span className="text-red-500">*</span>
                        </>
                      }
                      type="email"
                      leftIcon={<Mail className="h-5 w-5 text-gray-400" />}
                      error={errors.email?.message}
                      fullWidth
                      required
                      className="h-12 text-base rounded-2xl border-gray-200/50 bg-gray-50/50 focus:bg-white focus:border-blue-300 transition-all duration-300"
                      {...register('email', { 
                        required: 'Email è obbligatoria',
                        pattern: { 
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Indirizzo email non valido'
                        }
                      })}
                    />
                  </motion.div>

                  <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={shouldReduceMotion ? undefined : { duration: 0.2 }}
                    className="sm:col-span-2"
                  >
                    <Input
                      label={
                        <>
                          Password <span className="text-red-500">*</span>
                        </>
                      }
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
                      className="h-12 text-base rounded-2xl border-gray-200/50 bg-gray-50/50 focus:bg-white focus:border-blue-300 transition-all duration-300"
                      {...register('password', { 
                        required: 'Password è obbligatoria',
                        minLength: { value: 6, message: 'La password deve avere almeno 6 caratteri' }
                      })}
                    />
                  </motion.div>

                  {/* Date of Birth and Gender - Common for both roles */}
                  <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={shouldReduceMotion ? undefined : { duration: 0.2 }}
                  >
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
                          if (selectedRole === 'student' && age < 5) {
                            return 'Gli studenti devono avere almeno 5 anni';
                          }
                          if (selectedRole === 'teacher' && age < 18) {
                            return 'Gli insegnanti devono essere maggiorenni';
                          }
                          return true;
                        }
                      })}
                    />
                  </motion.div>

                  <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={shouldReduceMotion ? undefined : { duration: 0.2 }}
                  >
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
                            {
                              value: 'male',
                              label: 'Maschio',
                            },
                            {
                              value: 'female',
                              label: 'Femmina',
                            }
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
                  </motion.div>

                  {/* Phone Number - Common for both roles */}
                  <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={shouldReduceMotion ? undefined : { duration: 0.2 }}
                  >
                    <Input
                      label={
                        <>
                          Numero di telefono <span className="text-red-500">*</span>
                        </>
                      }
                      type="tel"
                      leftIcon={<Phone className="h-5 w-5 text-gray-400" />}
                      error={errors.phoneNumber?.message}
                      fullWidth
                      placeholder="+39 123 456 7890"
                      required
                      className="h-12 text-base rounded-2xl border-gray-200/50 bg-gray-50/50 focus:bg-white focus:border-blue-300 transition-all duration-300"
                      {...register('phoneNumber', {
                        required: 'Il numero di telefono è obbligatorio',
                        pattern: {
                          value: /^[\+]?[1-9][\d]{0,15}$/,
                          message: 'Inserisci un numero di telefono valido'
                        }
                      })}
                    />
                  </motion.div>

                  {/* Address - Common for both roles */}
                  <motion.div
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={shouldReduceMotion ? undefined : { duration: 0.2 }}
                  >
                    <Input
                      label="Indirizzo"
                      leftIcon={<UserIcon className="h-5 w-5 text-gray-400" />}
                      error={errors.address?.message}
                      fullWidth
                      placeholder="Via, Città, CAP"
                      className="h-12 text-base rounded-2xl border-gray-200/50 bg-gray-50/50 focus:bg-white focus:border-blue-300 transition-all duration-300"
                      {...register('address')}
                    />
                  </motion.div>

                  {selectedRole === 'student' && (
                    <>
                      <motion.div
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                        animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                        transition={shouldReduceMotion ? undefined : { duration: 0.2 }}
                      >
                        <Input
                          label={
                            <>
                              Nome genitore <span className="text-red-500">*</span>
                            </>
                          }
                          leftIcon={<UserIcon className="h-5 w-5 text-gray-400" />}
                          error={errors.parentName?.message}
                          fullWidth
                          className="h-12 text-base rounded-2xl border-gray-200/50 bg-gray-50/50 focus:bg-white focus:border-blue-300 transition-all duration-300"
                          {...register('parentName', {
                            required: 'Il nome del genitore è obbligatorio'
                          })}
                        />
                      </motion.div>
                      
                      <motion.div
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                        animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                        transition={shouldReduceMotion ? undefined : { duration: 0.2 }}
                      >
                        <Input
                          label={
                            <>
                              Contatto emergenza <span className="text-red-500">*</span>
                            </>
                          }
                          leftIcon={<Phone className="h-5 w-5 text-gray-400" />}
                          error={errors.emergencyContact?.message}
                          fullWidth
                          className="h-12 text-base rounded-2xl border-gray-200/50 bg-gray-50/50 focus:bg-white focus:border-blue-300 transition-all duration-300"
                          {...register('emergencyContact')}
                        />
                      </motion.div>
                    </>
                  )}
                </div>
                    
                <motion.div 
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                  animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={shouldReduceMotion ? undefined : { duration: 0.2 }}
                  className="flex items-center pt-2"
                >
                  <input
                    id="terms"
                    name="terms"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all duration-200"
                    required
                  />
                  <label htmlFor="terms" className="ml-3 text-sm text-gray-700">
                    Accetto i <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">Termini di Servizio</a> e la <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">Privacy Policy</a>
                  </label>
                </motion.div>
                    
                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                  animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={shouldReduceMotion ? undefined : { duration: 0.2 }}
                  className="pt-4"
                >
                  <Button 
                    type="submit" 
                    fullWidth 
                    isLoading={isLoading}
                    className="h-14 text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group"
                    rightIcon={
                      <motion.div
                        animate={!shouldReduceMotion && !isLoading ? { x: [0, 4, 0] } : undefined}
                        transition={!shouldReduceMotion && !isLoading ? { duration: 1.2, repeat: 2, ease: "easeInOut" } : undefined}
                      >
                        <ArrowRight className="h-5 w-5" />
                      </motion.div>
                    }
                  >
                    <span className="relative z-10">
                      {selectedRole === 'student' ? 'Crea Account Studente' : 'Richiedi Account Insegnante'}
                    </span>
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-blue-700 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      initial={false}
                    />
                  </Button>
                </motion.div>
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
                    className="font-semibold text-blue-600 hover:text-blue-700 transition-colors relative group"
                  >
                    Accedi ora
                    <motion.div
                      className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600"
                      whileHover={{ width: "100%" }}
                      transition={{ duration: 0.2 }}
                    />
                  </Link>
                </p>
              </motion.div>
            </div>
          </motion.div>
          )}

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="mt-8 text-center"
          >
            <p className="text-xs text-gray-500 mb-2">
              Accedendo accetti i nostri{' '}
              <a href="#" className="text-blue-600 hover:text-blue-700 transition-colors">
                Termini di Servizio
              </a>
              {' '}e la{' '}
              <a href="#" className="text-blue-600 hover:text-blue-700 transition-colors">
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