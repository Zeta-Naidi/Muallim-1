import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  addDoc, 
  onSnapshot, 
  doc, 
  updateDoc, 
  arrayUnion, 
  serverTimestamp, 
  getDoc,
  deleteField,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { ChatMessage, MessageStatus } from '../types';

export const useChat = (chatId: string, currentUserId?: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<{[key: string]: string}>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages
  useEffect(() => {
    if (!chatId || !currentUserId) return;

    setIsLoading(true);
    setError(null);

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const loadedMessages = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text,
            senderId: data.senderId,
            senderName: data.senderName,
            senderAvatar: data.senderAvatar,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate(),
            status: data.status || 'sent',
            readBy: data.readBy || {},
            reactions: data.reactions || {},
            replyTo: data.replyTo,
            attachments: data.attachments,
            isEdited: data.isEdited || false,
            deleted: data.deleted || false,
          } as ChatMessage;
        }).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        setMessages(loadedMessages);
        setIsLoading(false);
        
        // Mark messages as read
        markMessagesAsRead(loadedMessages);
      },
      (error) => {
        console.error('Error loading messages:', error);
        setError('Failed to load messages. Please try again.');
        setIsLoading(false);
      }
    );

    // Set up typing indicator listener
    const typingRef = doc(db, 'chats', chatId, 'typing', currentUserId);
    const typingUnsubscribe = onSnapshot(typingRef, (doc) => {
      const data = doc.data();
      if (data && data.isTyping) {
        setTypingUsers(prev => ({
          ...prev,
          [currentUserId]: data.userName
        }));
        
        // Clear typing indicator after 3 seconds
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUsers(prev => {
            const updated = {...prev};
            delete updated[currentUserId];
            return updated;
          });
        }, 3000);
      }
    });

    return () => {
      unsubscribe();
      typingUnsubscribe();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [chatId, currentUserId]);

  // Mark messages as read
  const markMessagesAsRead = useCallback(async (messagesToMark: ChatMessage[]) => {
    if (!currentUserId) return;
    
    const unreadMessages = messagesToMark.filter(
      msg => !msg.readBy?.[currentUserId] && msg.senderId !== currentUserId
    );
    
    if (unreadMessages.length === 0) return;
    
    const batch = unreadMessages.map(msg => 
      updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), {
        [`readBy.${currentUserId}`]: serverTimestamp(),
        status: 'read' as MessageStatus
      })
    );
    
    try {
      await Promise.all(batch);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [chatId, currentUserId]);

  // Send a new message
  const sendMessage = useCallback(async (text: string) => {
    if (!currentUserId || !chatId) return;
    
    const messageData: Omit<ChatMessage, 'id'> = {
      text,
      senderId: currentUserId,
      senderName: 'You', // This should come from user profile
      senderAvatar: '', // This should come from user profile
      createdAt: new Date(),
      status: 'sending',
      readBy: { [currentUserId]: new Date() },
      reactions: {},
    };
    
    try {
      // Add message to Firestore
      const docRef = await addDoc(
        collection(db, 'chats', chatId, 'messages'),
        {
          ...messageData,
          createdAt: serverTimestamp(),
          status: 'sent',
        }
      );
      
      // Update the message with the ID and status
      await updateDoc(doc(db, 'chats', chatId, 'messages', docRef.id), {
        id: docRef.id,
        status: 'delivered',
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error sending message:', error);
      throw new Error('Failed to send message');
    }
  }, [chatId, currentUserId]);

  // Update a message
  const updateMessage = useCallback(async (messageId: string, updates: Partial<ChatMessage>) => {
    if (!chatId) return;
    
    try {
      await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating message:', error);
      throw new Error('Failed to update message');
    }
  }, [chatId]);

  // Delete a message (soft delete)
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!chatId) return;
    
    try {
      await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
        deleted: true,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      throw new Error('Failed to delete message');
    }
  }, [chatId]);

  // Add/remove reaction to a message
  const toggleReaction = useCallback(async (messageId: string, emoji: string, userName: string) => {
    if (!chatId || !currentUserId) return;
    
    try {
      const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (!messageDoc.exists()) return;
      
      const messageData = messageDoc.data() as ChatMessage;
      const currentReactions = messageData.reactions || {};
      
      // Check if user already reacted with this emoji
      if (currentReactions[emoji]?.includes(currentUserId)) {
        // Remove reaction
        await updateDoc(messageRef, {
          [`reactions.${emoji}`]: arrayRemove(currentUserId),
          updatedAt: serverTimestamp(),
        });
        
        // Remove emoji key if no more reactions
        if (currentReactions[emoji].length === 1) {
          await updateDoc(messageRef, {
            [`reactions.${emoji}`]: deleteField(),
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        // Add reaction
        await updateDoc(messageRef, {
          [`reactions.${emoji}`]: arrayUnion(currentUserId),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
      throw new Error('Failed to update reaction');
    }
  }, [chatId, currentUserId]);

  // Set user typing status
  const setTyping = useCallback(async (isTyping: boolean, userName: string) => {
    if (!chatId || !currentUserId) return;
    
    try {
      const typingRef = doc(db, 'chats', chatId, 'typing', currentUserId);
      
      if (isTyping) {
        await updateDoc(typingRef, {
          isTyping: true,
          userId: currentUserId,
          userName,
          lastTyped: serverTimestamp(),
        }, { merge: true });
      } else {
        await updateDoc(typingRef, {
          isTyping: false,
          lastTyped: serverTimestamp(),
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  }, [chatId, currentUserId]);

  // Upload file and return download URL
  const uploadFile = useCallback(async (file: File): Promise<{url: string, name: string, type: string, size: number}> => {
    // This is a placeholder. In a real app, you would upload the file to Firebase Storage
    // and return the download URL along with file metadata.
    return new Promise((resolve) => {
      // Simulate file upload
      setTimeout(() => {
        resolve({
          url: URL.createObjectURL(file),
          name: file.name,
          type: file.type,
          size: file.size,
        });
      }, 500);
    });
  }, []);

  return {
    messages,
    isLoading,
    error,
    typingUsers,
    messagesEndRef,
    sendMessage,
    updateMessage,
    deleteMessage,
    toggleReaction,
    setTyping,
    uploadFile,
  };
};
