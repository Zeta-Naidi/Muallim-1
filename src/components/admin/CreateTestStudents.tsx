import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Users, MapPin, Plus } from 'lucide-react';

const testStudents = [
  {
    firstName: 'Marco',
    lastName: 'Rossi',
    email: 'marco.rossi@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'roma',
    parentName: 'Giuseppe Rossi',
    parentContact: '+39 333 1234567',
    classId: 'class1',
    paymentExempted: false
  },
  {
    firstName: 'Giulia',
    lastName: 'Bianchi',
    email: 'giulia.bianchi@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'milano',
    parentName: 'Maria Bianchi',
    parentContact: '+39 333 2345678',
    classId: 'class1',
    paymentExempted: false
  },
  {
    firstName: 'Alessandro',
    lastName: 'Ferrari',
    email: 'alessandro.ferrari@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'napoli',
    parentName: 'Antonio Ferrari',
    parentContact: '+39 333 3456789',
    classId: 'class2',
    paymentExempted: false
  },
  {
    firstName: 'Sofia',
    lastName: 'Romano',
    email: 'sofia.romano@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'torino',
    parentName: 'Francesca Romano',
    parentContact: '+39 333 4567890',
    classId: 'class1',
    paymentExempted: true
  },
  {
    firstName: 'Lorenzo',
    lastName: 'Conti',
    email: 'lorenzo.conti@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'firenze',
    parentName: 'Paolo Conti',
    parentContact: '+39 333 5678901',
    classId: 'class2',
    paymentExempted: false
  },
  {
    firstName: 'Chiara',
    lastName: 'Marino',
    email: 'chiara.marino@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'bologna',
    parentName: 'Lucia Marino',
    parentContact: '+39 333 6789012',
    classId: 'class1',
    paymentExempted: false
  },
  {
    firstName: 'Matteo',
    lastName: 'Greco',
    email: 'matteo.greco@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'palermo',
    parentName: 'Salvatore Greco',
    parentContact: '+39 333 7890123',
    classId: 'class2',
    paymentExempted: false
  },
  {
    firstName: 'Francesca',
    lastName: 'Ricci',
    email: 'francesca.ricci@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'genova',
    parentName: 'Roberto Ricci',
    parentContact: '+39 333 8901234',
    classId: 'class1',
    paymentExempted: false
  },
  {
    firstName: 'Davide',
    lastName: 'Costa',
    email: 'davide.costa@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'venezia',
    parentName: 'Elena Costa',
    parentContact: '+39 333 9012345',
    classId: 'class2',
    paymentExempted: false
  },
  {
    firstName: 'Martina',
    lastName: 'Lombardi',
    email: 'martina.lombardi@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'bari',
    parentName: 'Michele Lombardi',
    parentContact: '+39 333 0123456',
    classId: 'class1',
    paymentExempted: false
  },
  {
    firstName: 'Simone',
    lastName: 'Galli',
    email: 'simone.galli@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'catania',
    parentName: 'Carla Galli',
    parentContact: '+39 333 1357924',
    classId: 'class2',
    paymentExempted: false
  },
  {
    firstName: 'Elisa',
    lastName: 'Barbieri',
    email: 'elisa.barbieri@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'verona',
    parentName: 'Stefano Barbieri',
    parentContact: '+39 333 2468135',
    classId: 'class1',
    paymentExempted: false
  },
  {
    firstName: 'Andrea',
    lastName: 'Fontana',
    email: 'andrea.fontana@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'padova',
    parentName: 'Giuliana Fontana',
    parentContact: '+39 333 3691470',
    classId: 'class2',
    paymentExempted: false
  },
  {
    firstName: 'Valentina',
    lastName: 'Serra',
    email: 'valentina.serra@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'trieste',
    parentName: 'Marco Serra',
    parentContact: '+39 333 4815926',
    classId: 'class1',
    paymentExempted: false
  },
  {
    firstName: 'Luca',
    lastName: 'Vitale',
    email: 'luca.vitale@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'messina',
    parentName: 'Anna Vitale',
    parentContact: '+39 333 5927384',
    classId: 'class2',
    paymentExempted: true
  }
];

export const CreateTestStudents: React.FC = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [progress, setProgress] = useState(0);

  const createTestStudents = async () => {
    setIsCreating(true);
    setProgress(0);
    
    try {
      for (let i = 0; i < testStudents.length; i++) {
        const student = testStudents[i];
        const studentData = {
          ...student,
          createdAt: serverTimestamp(),
          displayName: `${student.firstName} ${student.lastName}`
        };
        
        await addDoc(collection(db, 'users'), studentData);
        setProgress(((i + 1) / testStudents.length) * 100);
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      setCreated(true);
      setTimeout(() => {
        window.location.reload(); // Refresh to see the students on the map
      }, 2000);
      
    } catch (error) {
      console.error('Error creating test students:', error);
      alert('Errore nella creazione degli studenti di test');
    } finally {
      setIsCreating(false);
    }
  };

  if (created) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <div className="text-green-600 mb-4">
          <Users className="w-12 h-12 mx-auto" />
        </div>
        <h3 className="text-lg font-semibold text-green-800 mb-2">
          ✅ Studenti Creati con Successo!
        </h3>
        <p className="text-green-700 mb-4">
          {testStudents.length} studenti sono stati aggiunti al database
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-green-600">
          <MapPin className="w-4 h-4" />
          <span>Distribuiti in {new Set(testStudents.map(s => s.city)).size} città italiane</span>
        </div>
        <p className="text-sm text-green-600 mt-2">
          La pagina si ricaricherà automaticamente per mostrare i punti sulla mappa...
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
      <div className="text-center">
        <div className="text-blue-600 mb-4">
          <Users className="w-12 h-12 mx-auto" />
        </div>
        <h3 className="text-lg font-semibold text-blue-800 mb-2">
          Crea Studenti di Test
        </h3>
        <p className="text-blue-700 mb-4">
          Aggiungi {testStudents.length} studenti di esempio con indirizzi italiani per testare la mappa
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-blue-600 mb-6">
          {Array.from(new Set(testStudents.map(s => s.city))).map(city => (
            <div key={city} className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span className="capitalize">{city}</span>
            </div>
          ))}
        </div>

        {isCreating && (
          <div className="mb-4">
            <div className="bg-blue-200 rounded-full h-2 mb-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-blue-600">
              Creazione in corso... {Math.round(progress)}%
            </p>
          </div>
        )}

        <button
          onClick={createTestStudents}
          disabled={isCreating}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
          {isCreating ? 'Creazione...' : 'Crea Studenti di Test'}
        </button>
        
        <p className="text-xs text-blue-500 mt-3">
          Questo aggiungerà studenti fittizi al database per testare la funzionalità della mappa
        </p>
      </div>
    </div>
  );
};
