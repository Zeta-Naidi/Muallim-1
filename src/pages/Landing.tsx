import React from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  Users,
  BookOpen,
  ArrowRight,
  CheckCircle,
  Star,
  Shield,
  Zap,
  Globe
} from 'lucide-react';
import { motion } from 'framer-motion';

const SectionHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.8 }}
    viewport={{ once: true }}
    className="text-center mb-16"
  >
    <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
      {title}
    </h2>
    <p className="text-lg text-gray-500 max-w-3xl mx-auto font-light">
      {subtitle}
    </p>
  </motion.div>
);

export const Landing: React.FC = () => {
  const features = [
    {
      icon: GraduationCap,
      title: 'Apprendimento Personalizzato',
      description:
        'Percorsi di studio su misura per ogni studente con feedback personalizzati e contenuti adattivi.'
    },
    {
      icon: Users,
      title: 'Collaborazione Efficace',
      description:
        'Strumenti in tempo reale per facilitare la comunicazione tra studenti e insegnanti.'
    },
    {
      icon: BookOpen,
      title: 'Risorse Digitali',
      description:
        'Accesso continuo a materiali interattivi, aggiornati e disponibili ovunque.'
    },
    {
      icon: Shield,
      title: 'Sicurezza Garantita',
      description:
        'Crittografia avanzata e rispetto delle normative privacy europee.'
    },
    {
      icon: Zap,
      title: 'Performance Ottimali',
      description:
        'Esperienza rapida e fluida su qualsiasi dispositivo.'
    },
    {
      icon: Globe,
      title: 'Accessibilità Universale',
      description:
        'Progettato per essere inclusivo e semplice per ogni utente.'
    }
  ];

  const stats = [
    { number: '10,000+', label: 'Studenti Attivi' },
    { number: '500+', label: 'Insegnanti' },
    { number: '50+', label: 'Scuole Partner' },
    { number: '99.9%', label: 'Uptime' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-white text-gray-900">
      {/* Hero */}
      <section className="relative overflow-hidden py-28 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9 }}
          className="max-w-5xl mx-auto"
        >
          <div className="inline-flex items-center px-5 py-2 bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 rounded-full text-sm font-medium mb-6 shadow">
            <Star className="w-4 h-4 mr-2" />
            L'educazione del futuro è qui
          </div>

          <h1 className="text-6xl font-extrabold tracking-tight leading-tight mb-6">
            <span className="block text-gray-800">Scopri</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-fuchsia-600">
              Muallim, la piattaforma educativa intelligente
            </span>
          </h1>

          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-10">
            Trasforma l'apprendimento con un ecosistema digitale progettato per coinvolgere, ispirare e connettere.
          </p>

          <div className="flex justify-center flex-wrap gap-4">
            <Link
              to="/register"
              className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white rounded-xl text-lg shadow-lg hover:scale-105 transition-transform"
            >
              Inizia Gratis
              <ArrowRight className="inline ml-2 w-5 h-5" />
            </Link>
            <Link
              to="/login"
              className="px-8 py-4 border border-gray-300 rounded-xl text-lg hover:bg-gray-100"
            >
              Accedi
            </Link>
          </div>

          <div className="flex justify-center items-center gap-6 mt-10 text-sm text-gray-500">
            <span className="flex items-center">
              <CheckCircle className="w-4 h-4 text-green-500 mr-1" /> Nessuna carta richiesta
            </span>
            <span className="flex items-center">
              <CheckCircle className="w-4 h-4 text-green-500 mr-1" /> Setup veloce in 2 minuti
            </span>
            <span className="flex items-center">
              <CheckCircle className="w-4 h-4 text-green-500 mr-1" /> Supporto 24/7
            </span>
          </div>
        </motion.div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              viewport={{ once: true }}
              className="text-xl font-medium"
            >
              <div className="text-3xl font-extrabold text-indigo-600">{s.number}</div>
              <div className="text-gray-600 mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <SectionHeader
            title="Caratteristiche Potenti"
            subtitle="Pensate per migliorare la didattica e semplificare la gestione."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-shadow border border-gray-100"
              >
                <div className="w-14 h-14 rounded-xl bg-indigo-50 flex items-center justify-center mb-6">
                  <f.icon className="w-7 h-7 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">{f.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
