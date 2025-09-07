import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Mail, Phone } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';

export const ApprovalPending: React.FC = () => {


  const handleNavigateToFacebook = async () => {
    try {
      await signOut(auth);
      window.open('https://www.facebook.com/istitutoaverroe', '_blank');
    } catch (error) {
      console.error('Logout error:', error);
      window.open('https://www.facebook.com/istitutoaverroe', '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <Clock className="w-10 h-10 text-green-600" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-2xl font-bold text-gray-900 mb-4"
        >
          Registrazione completata con successo 
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="bg-blue-50 rounded-lg p-4 mb-6"
        >
          <h3 className="font-semibold text-blue-900 mb-2">Cosa succede ora?</h3>
          <ul className="text-sm text-blue-800 space-y-1 text-left">
            <li>• L’amministrazione controllerà i dati inseriti e verrai ricontattato al più presto </li>
            <br></br>
            <li>• Per rimane aggiornato su news e aggiornamenti segui la nostra pagina Facebook</li>
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="border-t pt-6"
        >
          <h4 className="font-semibold text-gray-900 mb-3">Hai domande?</h4>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center justify-center space-x-2">
              <Phone className="w-4 h-4" />
              <span>+39 329 6736454</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <Mail className="w-4 h-4" />
              <span>istitutoaverroepc@gmail.com</span>
            </div>
          </div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          onClick={handleNavigateToFacebook}
          className="mt-6 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg transition-all duration-300"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Vai alla pagina Facebook
        </motion.button>
      </motion.div>
    </div>
  );
};
