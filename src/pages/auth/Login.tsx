import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { sendPasswordResetEmail } from 'firebase/auth';
import { 
  Mail, 
  Lock, 
  AlertCircle, 
  GraduationCap, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../services/firebase';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

interface LoginFormValues {
  email: string;
  password: string;
}

export const Login: React.FC = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>();
  const { loginWithEmail } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const onSubmit = async (data: LoginFormValues) => {
    setError(null);
    setIsLoading(true);
    
    try {
      await loginWithEmail(data.email, data.password);
      navigate('/dashboard');
    } catch (error) {
      console.error('Errore di login:', error);
      // Extract specific error message from the error object
      const errorMessage = error instanceof Error ? error.message : 'Errore durante il login. Riprova più tardi.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail.trim()) {
      setResetMessage({ type: 'error', text: 'Inserisci il tuo indirizzo email' });
      return;
    }

    setIsResetting(true);
    setResetMessage(null);

    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetMessage({ 
        type: 'success', 
        text: 'Email di reset inviata! Controlla la tua casella di posta elettronica.' 
      });
      
      // Close the reset form after 3 seconds
      setTimeout(() => {
        setShowResetForm(false);
        setResetEmail('');
        setResetMessage(null);
      }, 3000);
    } catch (error: any) {
      console.error('Error sending password reset email:', error);
      
      let errorMessage = 'Errore nell\'invio dell\'email di reset';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Nessun account trovato con questo indirizzo email';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Indirizzo email non valido';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Troppi tentativi. Riprova più tardi.';
      }
      
      setResetMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div 
          className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-3xl"
          animate={shouldReduceMotion ? { opacity: 0.15 } : { scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
          transition={shouldReduceMotion ? undefined : { duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-pink-400/20 to-orange-600/20 rounded-full blur-3xl"
          animate={shouldReduceMotion ? { opacity: 0.15 } : { scale: [1.2, 1, 1.2], rotate: [360, 180, 0] }}
          transition={shouldReduceMotion ? undefined : { duration: 25, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-cyan-400/10 to-blue-600/10 rounded-full blur-3xl"
          animate={shouldReduceMotion ? { opacity: 0.2 } : { scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={shouldReduceMotion ? undefined : { duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24 relative">
        <motion.div
          initial={shouldReduceMotion ? false : { x: 50, opacity: 0 }}
          animate={shouldReduceMotion ? undefined : { x: 0, opacity: 1 }}
          transition={shouldReduceMotion ? undefined : { duration: 0.8, delay: 0.2 }}
          className="mx-auto w-full max-w-sm lg:max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center justify-center group">
              <motion.div 
                className="w-14 h-14 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center mr-3 shadow-xl"
                whileHover={shouldReduceMotion ? undefined : { scale: 1.05, rotate: 5 }}
                transition={shouldReduceMotion ? undefined : { type: "spring", stiffness: 300 }}
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
              initial={shouldReduceMotion ? false : { y: 20, opacity: 0 }}
              animate={shouldReduceMotion ? undefined : { y: 0, opacity: 1 }}
              transition={shouldReduceMotion ? undefined : { duration: 0.6, delay: 0.3 }}
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Bentornato! 
                <motion.span 
                  className="inline-block ml-2"
                  animate={shouldReduceMotion ? undefined : { rotate: [0, 14, -8, 14, -4, 10, 0] }}
                  transition={shouldReduceMotion ? undefined : { duration: 1.5, delay: 1, repeat: Infinity, repeatDelay: 3 }}
                >
                  👋
                </motion.span>
              </h2>
              <p className="text-gray-600">
                Accedi per continuare il tuo percorso educativo
              </p>
            </motion.div>
          </div>

          {/* Login Form Card */}
          <motion.div
            initial={shouldReduceMotion ? false : { y: 30, opacity: 0 }}
            animate={shouldReduceMotion ? undefined : { y: 0, opacity: 1 }}
            transition={shouldReduceMotion ? undefined : { duration: 0.6, delay: 0.4 }}
            className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 relative overflow-hidden"
          >
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/10 to-purple-600/10 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-pink-400/10 to-orange-600/10 rounded-full blur-2xl" />
            
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
              
              <AnimatePresence mode="wait">
                {!showResetForm ? (
                  <motion.form
                    key="login-form"
                    initial={shouldReduceMotion ? false : { opacity: 0, x: -20 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, x: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, x: 20 }}
                    transition={shouldReduceMotion ? undefined : { duration: 0.3 }}
                    onSubmit={handleSubmit(onSubmit)} 
                    className="space-y-6"
                  >
                    <div className="space-y-5">
                      <motion.div
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                        animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                        transition={shouldReduceMotion ? undefined : { duration: 0.4, delay: 0.1 }}
                      >
                        <Input
                          label="Email"
                          type="email"
                          leftIcon={<Mail className="h-5 w-5 text-gray-400" />}
                          error={errors.email?.message}
                          fullWidth
                          className="h-14 text-base rounded-2xl border-gray-200/50 bg-gray-50/50 focus:bg-white focus:border-blue-300 transition-all duration-300"
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
                        transition={shouldReduceMotion ? undefined : { duration: 0.4, delay: 0.2 }}
                      >
                        <Input
                          label="Password"
                          type={showPassword ? "text" : "password"}
                          leftIcon={<Lock className="h-5 w-5 text-gray-400" />}
                          rightIcon={
                            <motion.button
                              type="button"
                              whileHover={shouldReduceMotion ? undefined : { scale: 1.1 }}
                              whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
                              onClick={() => setShowPassword(!showPassword)}
                              className="text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded-lg hover:bg-gray-100 transition-all duration-200"
                            >
                              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </motion.button>
                          }
                          error={errors.password?.message}
                          fullWidth
                          className="h-14 text-base rounded-2xl border-gray-200/50 bg-gray-50/50 focus:bg-white focus:border-blue-300 transition-all duration-300"
                          {...register('password', { 
                            required: 'Password è obbligatoria',
                            minLength: { value: 6, message: 'La password deve avere almeno 6 caratteri' }
                          })}
                        />
                      </motion.div>
                    </div>

                    <motion.div 
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                      transition={shouldReduceMotion ? undefined : { duration: 0.4, delay: 0.3 }}
                      className="flex items-center justify-between pt-2"
                    >
                      <label className="flex items-center cursor-pointer group">
                        <input
                          id="remember-me"
                          name="remember-me"
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all duration-200"
                        />
                        <span className="ml-3 text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                          Ricordami
                        </span>
                      </label>

                      <motion.button
                        type="button"
                        whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                        whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                        onClick={() => setShowResetForm(true)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors relative"
                      >
                        Password dimenticata?
                        <motion.div
                          className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600"
                          whileHover={{ width: "100%" }}
                          transition={{ duration: 0.2 }}
                        />
                      </motion.button>
                    </motion.div>
                    
                    <motion.div
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                      transition={shouldReduceMotion ? undefined : { duration: 0.4, delay: 0.4 }}
                      className="pt-4"
                    >
                      <Button 
                        type="submit" 
                        fullWidth 
                        isLoading={isLoading}
                        className="h-14 text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group"
                        rightIcon={
                          <motion.div
                            animate={shouldReduceMotion ? undefined : { x: isLoading ? 0 : [0, 4, 0] }}
                            transition={shouldReduceMotion ? undefined : { duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <ArrowRight className="h-5 w-5" />
                          </motion.div>
                        }
                      >
                        <span className="relative z-10">Accedi</span>
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-blue-700 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          initial={false}
                        />
                      </Button>
                    </motion.div>
                  </motion.form>
                ) : (
                  <motion.form
                    key="reset-form"
                    initial={shouldReduceMotion ? false : { opacity: 0, x: 20 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, x: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, x: -20 }}
                    transition={shouldReduceMotion ? undefined : { duration: 0.3 }}
                    onSubmit={handlePasswordReset} 
                    className="space-y-6"
                  >
                    <div className="text-center mb-6">
                      <motion.div
                        initial={shouldReduceMotion ? false : { scale: 0 }}
                        animate={shouldReduceMotion ? undefined : { scale: 1 }}
                        transition={shouldReduceMotion ? undefined : { type: "spring", stiffness: 200, delay: 0.1 }}
                        className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      >
                        <Sparkles className="h-8 w-8 text-white" />
                      </motion.div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">Reimposta Password</h3>
                      <p className="text-gray-600">
                        Inserisci il tuo indirizzo email e ti invieremo un link magico per reimpostare la password.
                      </p>
                    </div>

                    <AnimatePresence>
                      {resetMessage && (
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          className={`p-4 rounded-2xl flex items-start backdrop-blur-sm ${
                            resetMessage.type === 'success' 
                              ? 'bg-green-50/80 border border-green-200/50 text-green-700' 
                              : 'bg-red-50/80 border border-red-200/50 text-red-700'
                          }`}
                        >
                          <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
                          <span className="text-sm font-medium">{resetMessage.text}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div>
                      <Input
                        label="Email"
                        type="email"
                        leftIcon={<Mail className="h-5 w-5 text-gray-400" />}
                        value={resetEmail}
                        onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.target.select()}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="Inserisci il tuo indirizzo email"
                        fullWidth
                        className="h-14 text-base rounded-2xl border-gray-200/50 bg-gray-50/50 focus:bg-white focus:border-blue-300 transition-all duration-300"
                        required
                      />
                    </div>
                    
                    <div className="flex space-x-4">
                      <Button 
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowResetForm(false);
                          setResetEmail('');
                          setResetMessage(null);
                        }}
                        fullWidth
                        disabled={isResetting}
                        className="h-14 text-base font-semibold rounded-2xl border-2 hover:bg-gray-50 transition-all duration-300"
                      >
                        Annulla
                      </Button>
                      <Button 
                        type="submit" 
                        fullWidth 
                        isLoading={isResetting}
                        disabled={isResetting}
                        className="h-14 text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300"
                      >
                        Invia Email
                      </Button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              <motion.div 
                initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={shouldReduceMotion ? undefined : { duration: 0.6, delay: 0.5 }}
                className="mt-8 text-center"
              >
                <p className="text-gray-600">
                  Non hai un account? Iscriviti tramite link inviato dall'istituto
                </p>
              </motion.div>
            </div>
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1 }}
            transition={shouldReduceMotion ? undefined : { duration: 0.6, delay: 0.6 }}
            className="mt-8 text-center"
          >
            <p className="text-xs text-gray-500">
              Accedendo accetti i nostri{' '}
              <a href="#" className="text-blue-600 hover:text-blue-700 transition-colors">
                Termini di Servizio
              </a>
              {' '}e la{' '}
              <a href="#" className="text-blue-600 hover:text-blue-700 transition-colors">
                Privacy Policy
              </a>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};