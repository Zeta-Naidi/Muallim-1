import React, { useState, useEffect } from 'react';
import { AlertTriangle, Home, RotateCcw, BookOpen, Star, Lightbulb } from 'lucide-react';

// Mock Button component since we don't have the original
const Button = ({ children, onClick, variant = 'primary', leftIcon, className = '' }) => {
  const baseClasses = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5",
    outline: "border-2 border-emerald-300 hover:border-emerald-500 text-emerald-700 hover:text-emerald-600 hover:bg-emerald-50"
  };
  
  return (
    <button 
      className={`${baseClasses} ${variants[variant]} ${className}`}
      onClick={onClick}
    >
      {leftIcon}
      {children}
    </button>
  );
};

export const ErrorFallback = ({ error, resetErrorBoundary }) => {
  const [currentMessage, setCurrentMessage] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  
  const islamicWisdom = [
    "\"E chi si affida ad Allah, Egli gli basta\" - Corano 65:3 📖",
    "\"In verità, dopo ogni difficoltà viene la facilità\" - Corano 94:6 ✨",
    "\"E Allah ama coloro che perseverano\" - Corano 3:146 💪",
    "\"Cerca la conoscenza dalla culla alla tomba\" - Hadith 📚",
    "\"Chi viaggia per cercare la conoscenza, Allah gli faciliterà la strada verso il Paradiso\" - Hadith 🌟"
  ];

  const funnyTechMessages = [
    "Il nostro server sta facendo le abluzioni digitali 🕌",
    "I bit si sono fermati per la preghiera ☪️",
    "Anche i computer hanno bisogno di sabr (pazienza) 😊",
    "I nostri dati stanno studiando l'arabo classico 📜",
    "Il database si è perso tra le pagine del Corano 📖"
  ];

  const encouragingMessages = [
    "SubhanAllah! Anche gli errori ci insegnano qualcosa",
    "Inshallah, tutto si risolverà presto",
    "Bismillah, riproviamo insieme!",
    "Alhamdulillah, un'opportunità per imparare la pazienza"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % islamicWisdom.length);
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const handleRetry = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
    resetErrorBoundary();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100">
      <div className={`max-w-lg w-full bg-white rounded-3xl shadow-2xl p-8 text-center transform transition-all duration-500 ${isShaking ? 'animate-bounce' : 'hover:scale-105'} border-t-4 border-emerald-500`}>
        
        {/* Islamic-themed Icon */}
        <div className="relative mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mx-auto">
            <BookOpen className="h-10 w-10 text-white animate-pulse" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
            <Star className="h-4 w-4 text-yellow-800 animate-spin" />
          </div>
        </div>

        {/* Friendly Title */}
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Oops! Qualcosa è andato storto 🤲
        </h1>

        {/* Rotating Islamic Wisdom */}
        <div className="h-20 flex items-center justify-center mb-6">
          <p className="text-lg text-emerald-700 font-medium transition-all duration-500 transform text-center leading-relaxed">
            {islamicWisdom[currentMessage]}
          </p>
        </div>

        {/* Fun Error Details with Islamic Theme */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl p-6 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-100 rounded-full transform translate-x-10 -translate-y-10 opacity-50"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-center mb-3">
              <Lightbulb className="h-6 w-6 text-emerald-600 mr-2 animate-bounce" />
              <p className="text-emerald-800 font-bold text-lg">Dettagli Tecnici (con un sorriso):</p>
            </div>
            <p className="text-emerald-700 text-sm font-mono bg-white/70 p-3 rounded-lg mb-3">
              {funnyTechMessages[currentMessage % funnyTechMessages.length]}
            </p>
            <p className="text-emerald-600 italic text-sm">
              {encouragingMessages[currentMessage % encouragingMessages.length]}
            </p>
          </div>
        </div>

        <p className="text-gray-600 mb-8 text-lg leading-relaxed">
          Non preoccuparti! Anche i migliori sistemi a volte hanno bisogno di una pausa per riflettere. 
          <br />La pazienza è una virtù che ci avvicina alla saggezza.
        </p>

        {/* Action Buttons with Islamic Phrases */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={handleRetry}
            leftIcon={<RotateCcw className="h-5 w-5" />}
            variant="primary"
            className="transform hover:rotate-3 transition-transform duration-200"
          >
            Bismillah, riprova!
          </Button>
          
          <Button
            onClick={() => window.location.href = '/dashboard'}
            variant="outline"
            leftIcon={<Home className="h-5 w-5" />}
            className="hover:bg-gradient-to-r hover:from-emerald-400 hover:to-teal-500 hover:text-white border-none"
          >
            Torna alla Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};