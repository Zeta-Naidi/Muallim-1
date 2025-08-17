import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, addDoc, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { Send, AlertCircle, MessageCircle, X, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { ChatMessage } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export const TeacherChat: React.FC = () => {
  const { userProfile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadTimestamp, setLastReadTimestamp] = useState<Date>(new Date());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastMessageRef = useRef<string | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
    audioRef.current.volume = 1;
  }, []);

  useEffect(() => {
    if (!userProfile || (userProfile.role !== 'teacher' && userProfile.role !== 'admin')) return;

    const q = query(
      collection(db, 'teacherChat'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate() || new Date()
          } as ChatMessage;
        })
        .reverse();

      setMessages(newMessages);
      
      if (!isOpen && newMessages.length > 0) {
        const latestMessage = newMessages[newMessages.length - 1];
        
        if (
          latestMessage.senderId !== userProfile.id && 
          latestMessage.id !== lastMessageRef.current &&
          latestMessage.createdAt > lastReadTimestamp
        ) {
          audioRef.current?.play().catch(console.error);
          lastMessageRef.current = latestMessage.id;
        }

        const unreadMessages = newMessages.filter(msg => 
          msg.senderId !== userProfile.id && 
          msg.createdAt > lastReadTimestamp
        );
        setUnreadCount(unreadMessages.length);
      }
      
      scrollToBottom();
    }, (err) => {
      console.error('Error fetching messages:', err);
      setError('Error loading messages. Please try again later.');
    });

    return () => unsubscribe();
  }, [userProfile, isOpen, lastReadTimestamp]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !newMessage.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await addDoc(collection(db, 'teacherChat'), {
        text: newMessage.trim(),
        senderId: userProfile.id,
        senderName: userProfile.displayName,
        createdAt: new Date(),
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setUnreadCount(0);
      setLastReadTimestamp(new Date());
      setTimeout(scrollToBottom, 100);
    }
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    setTimeout(scrollToBottom, 100);
  };

  if (!userProfile || (userProfile.role !== 'teacher' && userProfile.role !== 'admin')) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isExpanded ? '90vh' : '400px',
              width: isExpanded ? '90vw' : '350px'
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-lg shadow-xl flex flex-col overflow-hidden"
            style={{
              maxWidth: isExpanded ? '1200px' : '350px',
              maxHeight: isExpanded ? '90vh' : '400px'
            }}
          >
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-primary-50">
              <div className="flex items-center">
                <MessageCircle className="h-5 w-5 text-primary-600 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">Chat Insegnanti</h2>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleExpand}
                  className="text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                  {isExpanded ? (
                    <Minimize2 className="h-5 w-5" />
                  ) : (
                    <Maximize2 className="h-5 w-5" />
                  )}
                </button>
                <button
                  onClick={toggleChat}
                  className="text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {error && (
                <div className="flex items-center p-4 text-sm text-error-700 bg-error-50 rounded-md">
                  <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                  {error}
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.senderId === userProfile.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      message.senderId === userProfile.id
                        ? 'bg-primary-100 text-primary-900'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="flex items-baseline mb-1">
                      <span className="text-sm font-medium">
                        {message.senderId === userProfile.id ? 'Tu' : message.senderName}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">
                        {format(message.createdAt, 'HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Scrivi un messaggio..."
                  disabled={isLoading}
                  fullWidth
                />
                <Button
                  type="submit"
                  disabled={isLoading || !newMessage.trim()}
                  isLoading={isLoading}
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {!isOpen && (
        <motion.button
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="fixed bottom-4 right-4 bg-primary-600 text-white p-4 rounded-full shadow-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          onClick={toggleChat}
        >
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 bg-error-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse"
            >
              {unreadCount}
            </motion.span>
          )}
        </motion.button>
      )}
    </div>
  );
};