import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Firebase configuration - you'll need to replace this with your actual config
const firebaseConfig = {
  // Add your Firebase config here
  // You can find this in your Firebase project settings
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Test students data with Italian cities
const testStudents = [
  {
    firstName: 'Marco',
    lastName: 'Rossi',
    email: 'marco.rossi@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'Roma',
    parentName: 'Giuseppe Rossi',
    parentContact: '+39 333 1234567',
    classId: 'class1',
    paymentExempted: false,
    createdAt: serverTimestamp()
  },
  {
    firstName: 'Giulia',
    lastName: 'Bianchi',
    email: 'giulia.bianchi@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'Milano',
    parentName: 'Maria Bianchi',
    parentContact: '+39 333 2345678',
    classId: 'class1',
    paymentExempted: false,
    createdAt: serverTimestamp()
  },
  {
    firstName: 'Alessandro',
    lastName: 'Ferrari',
    email: 'alessandro.ferrari@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'Napoli',
    parentName: 'Antonio Ferrari',
    parentContact: '+39 333 3456789',
    classId: 'class2',
    paymentExempted: false,
    createdAt: serverTimestamp()
  },
  {
    firstName: 'Sofia',
    lastName: 'Romano',
    email: 'sofia.romano@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'Torino',
    parentName: 'Francesca Romano',
    parentContact: '+39 333 4567890',
    classId: 'class1',
    paymentExempted: true,
    createdAt: serverTimestamp()
  },
  {
    firstName: 'Lorenzo',
    lastName: 'Conti',
    email: 'lorenzo.conti@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'Firenze',
    parentName: 'Paolo Conti',
    parentContact: '+39 333 5678901',
    classId: 'class2',
    paymentExempted: false,
    createdAt: serverTimestamp()
  },
  {
    firstName: 'Chiara',
    lastName: 'Marino',
    email: 'chiara.marino@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'Bologna',
    parentName: 'Lucia Marino',
    parentContact: '+39 333 6789012',
    classId: 'class1',
    paymentExempted: false,
    createdAt: serverTimestamp()
  },
  {
    firstName: 'Matteo',
    lastName: 'Greco',
    email: 'matteo.greco@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'Palermo',
    parentName: 'Salvatore Greco',
    parentContact: '+39 333 7890123',
    classId: 'class2',
    paymentExempted: false,
    createdAt: serverTimestamp()
  },
  {
    firstName: 'Francesca',
    lastName: 'Ricci',
    email: 'francesca.ricci@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'Genova',
    parentName: 'Roberto Ricci',
    parentContact: '+39 333 8901234',
    classId: 'class1',
    paymentExempted: false,
    createdAt: serverTimestamp()
  },
  {
    firstName: 'Davide',
    lastName: 'Costa',
    email: 'davide.costa@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'Venezia',
    parentName: 'Elena Costa',
    parentContact: '+39 333 9012345',
    classId: 'class2',
    paymentExempted: false,
    createdAt: serverTimestamp()
  },
  {
    firstName: 'Martina',
    lastName: 'Lombardi',
    email: 'martina.lombardi@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'Bari',
    parentName: 'Michele Lombardi',
    parentContact: '+39 333 0123456',
    classId: 'class1',
    paymentExempted: false,
    createdAt: serverTimestamp()
  },
  {
    firstName: 'Simone',
    lastName: 'Galli',
    email: 'simone.galli@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'Catania',
    parentName: 'Carla Galli',
    parentContact: '+39 333 1357924',
    classId: 'class2',
    paymentExempted: false,
    createdAt: serverTimestamp()
  },
  {
    firstName: 'Elisa',
    lastName: 'Barbieri',
    email: 'elisa.barbieri@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'Verona',
    parentName: 'Stefano Barbieri',
    parentContact: '+39 333 2468135',
    classId: 'class1',
    paymentExempted: false,
    createdAt: serverTimestamp()
  },
  {
    firstName: 'Andrea',
    lastName: 'Fontana',
    email: 'andrea.fontana@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'Padova',
    parentName: 'Giuliana Fontana',
    parentContact: '+39 333 3691470',
    classId: 'class2',
    paymentExempted: false,
    createdAt: serverTimestamp()
  },
  {
    firstName: 'Valentina',
    lastName: 'Serra',
    email: 'valentina.serra@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'Trieste',
    parentName: 'Marco Serra',
    parentContact: '+39 333 4815926',
    classId: 'class1',
    paymentExempted: false,
    createdAt: serverTimestamp()
  },
  {
    firstName: 'Luca',
    lastName: 'Vitale',
    email: 'luca.vitale@email.com',
    role: 'student',
    isEnrolled: true,
    city: 'Messina',
    parentName: 'Anna Vitale',
    parentContact: '+39 333 5927384',
    classId: 'class2',
    paymentExempted: true,
    createdAt: serverTimestamp()
  }
];

async function createTestStudents() {
  console.log('Creating test students...');
  
  try {
    for (const student of testStudents) {
      const docRef = await addDoc(collection(db, 'users'), student);
      console.log(`Created student ${student.firstName} ${student.lastName} with ID: ${docRef.id} in ${student.city}`);
    }
    
    console.log('\n✅ All test students created successfully!');
    console.log(`📍 Students distributed across ${new Set(testStudents.map(s => s.city)).size} Italian cities`);
    console.log('🗺️ You should now see dots on the map representing student locations');
    
  } catch (error) {
    console.error('Error creating test students:', error);
  }
}

// Run the script
createTestStudents();
