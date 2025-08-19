import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

export const useChatUnreadCount = () => {
  const { userProfile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadTimestamp, setLastReadTimestamp] = useState<Date | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!userProfile || (userProfile.role !== 'teacher' && userProfile.role !== 'admin')) {
      setUnreadCount(0);
      return;
    }

    const q = query(
      collection(db, 'teacherChat'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          senderId: data.senderId
        };
      });

      if (!isOpen) {
        // Count unread messages (messages from others)
        // If no lastReadTimestamp is set, count all messages from others
        const unreadMessages = messages.filter(msg => {
          if (msg.senderId === userProfile.id) return false;
          if (!lastReadTimestamp) return true;
          return msg.createdAt > lastReadTimestamp;
        });
        
        setUnreadCount(unreadMessages.length);
      }
    }, (error) => {
      console.error('Error fetching chat messages for unread count:', error);
    });

    return () => unsubscribe();
  }, [userProfile, lastReadTimestamp, isOpen]);

  const markAsRead = () => {
    setLastReadTimestamp(new Date());
    setUnreadCount(0);
  };

  const setOpenState = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      markAsRead();
    }
  };

  return {
    unreadCount,
    markAsRead,
    setOpenState
  };
};
