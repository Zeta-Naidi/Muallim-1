import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Mail, Phone, MapPin, Instagram, Facebook, Heart, Coffee } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-white border-t border-gray-100 relative overflow-hidden" aria-labelledby="footer-heading">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -right-20 -bottom-20 w-64 h-64 rounded-full bg-blue-50 opacity-50"></div>
        <div className="absolute -left-20 -top-20 w-96 h-96 rounded-full bg-purple-50 opacity-50"></div>
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 id="footer-heading" className="sr-only">Footer</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          <section aria-label="About Muallim">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-light bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent select-none">
                Muallim
              </span>
            </Link>
            <p className="mt-3 text-gray-600 text-sm leading-snug max-w-xs">
              Un sistema di gestione scolastica moderno e intuitivo per migliorare l'esperienza di apprendimento.
            </p>
            <div className="mt-4 flex space-x-3">
              <a
                href="https://www.facebook.com/istitutoaverroe"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="text-gray-600 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-full transition-all duration-200"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="https://www.instagram.com/istituto_averroe"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-gray-600 hover:text-pink-600 hover:bg-pink-50 p-2 rounded-full transition-all duration-200"
              >
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </section>

          <section aria-label="Contact information">
            <h3 className="text-lg font-semibold text-gray-900 mb-5 relative inline-block">
              <span className="relative z-10">Contatti</span>
              <span className="absolute bottom-0 left-0 w-full h-1.5 bg-blue-100 -z-0 rounded-full"></span>
            </h3>
            <ul className="space-y-4 text-gray-600">
              <li className="flex items-start">
                <div className="bg-blue-50 p-2 rounded-lg mr-3 flex-shrink-0">
                  <Mail className="h-4 w-4 text-blue-600" />
                </div>
                <a href="mailto:istitutoaverroepc@gmail.com" className="hover:text-blue-600 transition-colors">
                  istitutoaverroepc@gmail.com
                </a>
              </li>
              <li className="flex items-start">
                <div className="bg-blue-50 p-2 rounded-lg mr-3 flex-shrink-0">
                  <Phone className="h-4 w-4 text-blue-600" />
                </div>
                <a href="tel:+393883536135" className="hover:text-blue-600 transition-colors">
                  +39 388 353 6135
                </a>
              </li>
              <li className="flex items-start">
                <div className="bg-blue-50 p-2 rounded-lg mr-3 flex-shrink-0">
                  <MapPin className="h-4 w-4 text-blue-600" />
                </div>
                <address className="not-italic hover:text-blue-600 transition-colors">
                  Via Caorsana, 43<br />29122 Piacenza (PC)
                </address>
              </li>
            </ul>
          </section>

          <section aria-label="Opening hours">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 relative inline-block">
              <span className="relative z-10">Orari di Apertura</span>
              <span className="absolute bottom-0 left-0 w-full h-1.5 bg-purple-100 -z-0 rounded-full"></span>
            </h3>
            <ul className="space-y-3">
              {[
                { label: 'Sabato', hours: '14:00 - 20:00' },
                { label: 'Domenica', hours: '9:00 - 17:00' },
              ].map(({ label, hours }) => (
                <li key={label} className="flex items-center text-sm">
                  <span className="font-medium w-20">{label}:</span>
                  <span className="text-gray-600">{hours}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-3 md:space-y-0 max-w-7xl mx-auto px-4">
            <p className="text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} <span className="font-medium text-gray-700">Muallim</span>. Tutti i diritti riservati.
            </p>
            <nav
              aria-label="Footer legal links"
              className="flex flex-wrap justify-center gap-6"
            >
              <Link
                to="#"
                className="text-gray-500 hover:text-blue-600 hover:underline transition-colors text-sm"
              >
                Privacy Policy
              </Link>
              <Link
                to="#"
                className="text-gray-500 hover:text-blue-600 hover:underline transition-colors text-sm"
              >
                Termini di Servizio
              </Link>
              <Link
                to="#"
                className="text-gray-500 hover:text-blue-600 hover:underline transition-colors text-sm"
              >
                Cookie Policy
              </Link>
            </nav>
          </div>
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
              Powered by Sabr e tanto Duaa <Coffee className="inline-block h-3 w-3 text-black-900 fill-current" />
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
