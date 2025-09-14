import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  setPersistence,
  browserSessionPersistence,
  User as FirebaseUser,
  AuthError
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { User, UserRole } from '../types';
import { actionLogger } from '../services/actionLogger';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: User | null;
  session: { access_token: string } | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (
    email: string, 
    password: string, 
    displayName: string, 
    role: UserRole,
    additionalData?: {
      phoneNumber?: string;
      address?: string;
      birthDate?: Date | null;
      gender?: string;
      emergencyContact?: string;
      parentName?: string;
      parentContact?: string;
    }
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve essere usato all\'interno di un AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Inactivity timeout (1 hour = 3600000 ms)
  const INACTIVITY_TIMEOUT = 60 * 60 * 1000;
  const inactivityTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Function to handle inactivity timeout
  const handleInactivityTimeout = React.useCallback(async () => {
    await logout();
  }, []);

  // Function to reset inactivity timer
  const resetInactivityTimer = React.useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    if (currentUser) {
      inactivityTimerRef.current = setTimeout(handleInactivityTimeout, INACTIVITY_TIMEOUT);
    }
  }, [currentUser, handleInactivityTimeout, INACTIVITY_TIMEOUT]);

  // Function to start inactivity timer
  const startInactivityTimer = React.useCallback(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  // Function to stop inactivity timer
  const stopInactivityTimer = React.useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setPersistence(auth, browserSessionPersistence).catch(console.error);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserProfile({ ...userDoc.data(), id: userDoc.id } as User);
            // Get the ID token
            const token = await user.getIdToken();
            setSession({ access_token: token });
            
            // Start inactivity timer when user is authenticated
            startInactivityTimer();
            
            // Check for temporary classes (for substitutions)
            const userData = userDoc.data() as User;
            if (userData.role === 'teacher' && userData.temporaryClasses && userData.temporaryClasses.length > 0) {
            }
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        setUserProfile(null);
        setSession(null);
        // Stop inactivity timer when user is not authenticated
        stopInactivityTimer();
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, [startInactivityTimer, stopInactivityTimer]);

  // Set up activity listeners to reset inactivity timer
  useEffect(() => {
    if (!currentUser) return;

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      resetInactivityTimer();
    };

    // Add event listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Cleanup function
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [currentUser, resetInactivityTimer]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      stopInactivityTimer();
    };
  }, [stopInactivityTimer]);

  const loginWithEmail = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (!userDoc.exists()) {
        throw new Error('Profilo utente non trovato');
      }
      
      const userData = { ...userDoc.data(), id: userDoc.id } as User;
      setUserProfile(userData);
      const token = await userCredential.user.getIdToken();
      setSession({ access_token: token });
      
      // Log successful login
      await actionLogger.logAction(
        userData.id,
        userData.email,
        userData.role,
        'login',
        {
          details: { loginMethod: 'email_password' }
        }
      );
    } catch (error) {
      console.error('Login error:', error);
      const authError = error as AuthError;
      
      // Handle specific Firebase auth errors
      switch(authError.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          throw new Error('Credenziali non valide');
        case 'auth/too-many-requests':
          throw new Error('Troppi tentativi di accesso. Riprova più tardi.');
        case 'auth/network-request-failed':
          throw new Error('Errore di connessione. Verifica la tua connessione internet.');
        default:
          throw new Error('Errore durante il login. Riprova più tardi.');
      }
    }
  };

  const registerWithEmail = async (
    email: string,
    password: string,
    displayName: string,
    role: UserRole,
    additionalData?: {
      phoneNumber?: string;
      address?: string;
      birthDate?: Date | null;
      gender?: string;
      emergencyContact?: string;
      parentName?: string;
      parentContact?: string;
    }
  ) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Create user profile in Firestore
      const userProfile: Partial<User> = {
        id: user.uid,
        email,
        displayName,
        role,
        createdAt: new Date(),
        // All users need approval now
        accountStatus: 'pending_approval',
      };

      // Only add student-specific fields for students
      if (role === 'student') {
        userProfile.isEnrolled = true;
        userProfile.enrollmentDate = new Date();
      }

      // Only add additional fields if they have values
      if (additionalData?.phoneNumber) {
        userProfile.phoneNumber = additionalData.phoneNumber;
      }
      if (additionalData?.address) {
        userProfile.address = additionalData.address;
      }
      if (additionalData?.birthDate) {
        userProfile.birthDate = additionalData.birthDate;
      }
      if (additionalData?.gender) {
        userProfile.gender = additionalData.gender as 'male' | 'female';
      }
      if (additionalData?.emergencyContact) {
        userProfile.emergencyContact = additionalData.emergencyContact;
      }
      if (additionalData?.parentName) {
        userProfile.parentName = additionalData.parentName;
      }
      if (additionalData?.parentContact) {
        userProfile.parentContact = additionalData.parentContact;
      }
      
      await setDoc(doc(db, 'users', user.uid), userProfile);
      
      // Log user registration
      await actionLogger.logAction(
        user.uid,
        email,
        role,
        'user_created',
        {
          targetType: 'user',
          targetId: user.uid,
          targetName: displayName,
          details: { 
            registrationMethod: 'email_password',
            accountStatus: 'pending_approval'
          }
        }
      );
      
      // Keep user logged in temporarily to show approval pending page
      // They will be signed out when they navigate away or close the browser
    } catch (error) {
      console.error('Registration error:', error);
      const authError = error as AuthError;
      
      // Handle specific Firebase auth errors
      switch(authError.code) {
        case 'auth/email-already-in-use':
          throw new Error('Email già in uso');
        case 'auth/invalid-email':
          throw new Error('Email non valida');
        case 'auth/weak-password':
          throw new Error('Password troppo debole');
        case 'auth/network-request-failed':
          throw new Error('Errore di connessione. Verifica la tua connessione internet.');
        default:
          throw new Error('Errore durante la registrazione. Riprova più tardi.');
      }
    }
  };

  const logout = async () => {
    try {
      // Log logout before signing out
      if (userProfile) {
        await actionLogger.logAction(
          userProfile.id,
          userProfile.email,
          userProfile.role,
          'logout'
        );
      }
      
      await signOut(auth);
      setUserProfile(null);
      setSession(null);
    } catch (error: any) {
      console.error('Logout error:', error);
      // Don't throw error for logout, just log it
      // The user should still be logged out even if there's an error
    }
  };

  const value = {
    currentUser,
    userProfile,
    session,
    loading,
    loginWithEmail,
    registerWithEmail,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};