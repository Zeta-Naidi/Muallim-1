import { useCallback } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

export function useFirestore<T extends { id: string }>(collectionName: string) {
  const { userProfile } = useAuth();

  const getAll = useCallback(async (filters?: Record<string, any>) => {
    try {
      let q = collection(db, collectionName);
      
      if (filters) {
        Object.entries(filters).forEach(([field, value]) => {
          q = query(q, where(field, '==', value));
        });
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as T));
    } catch (error) {
      console.error(`Error fetching ${collectionName}:`, error);
      throw error;
    }
  }, [collectionName]);

  const create = useCallback(async (data: Omit<T, 'id'>) => {
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdBy: userProfile?.id,
        createdAt: new Date()
      });
      return { ...data, id: docRef.id } as T;
    } catch (error) {
      console.error(`Error creating ${collectionName}:`, error);
      throw error;
    }
  }, [collectionName, userProfile]);

  const update = useCallback(async (id: string, data: Partial<T>) => {
    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, {
        ...data,
        updatedBy: userProfile?.id,
        updatedAt: new Date()
      });
      return { id, ...data } as T;
    } catch (error) {
      console.error(`Error updating ${collectionName}:`, error);
      throw error;
    }
  }, [collectionName, userProfile]);

  const remove = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, collectionName, id));
      return true;
    } catch (error) {
      console.error(`Error deleting ${collectionName}:`, error);
      throw error;
    }
  }, [collectionName]);

  return { getAll, create, update, remove };
}