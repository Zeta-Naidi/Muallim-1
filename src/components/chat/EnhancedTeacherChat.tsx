import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  addDoc, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { format, isToday, isYesterday } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  Send, 
  AlertCircle, 
  MessageCircle, 
  X, 
  Maximize2, 
  Minimize2,
  Paperclip,
  MoreVertical,
  Trash2,
  Edit2,
  Reply as ReplyIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { ChatMessage as ChatMessageType, MessageStatus } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export const EnhancedTeacherChat: React.FC = () => {
  const { userProfile } = useAuth();
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadTimestamp, setLastReadTimestamp] = useState<Date>(new Date());
  const [replyTo, setReplyTo] = useState<{id: string, text: string, senderName: string} | null>(null);
  const [editingMessage, setEditingMessage] = useState<{id: string, text: string} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastMessageRef = useRef<string | null>(null);

  // Initialize audio for message sounds
  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
    audioRef.current.volume = 0.5;
  }, []);

  // Load messages
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
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate(),
            status: data.status || 'sent',
            readBy: data.readBy || {},
            reactions: data.reactions || {}
          } as ChatMessageType;
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

    let messageText = newMessage.trim();
    if (replyTo) {
      messageText = `@${replyTo.senderName}: ${messageText}`;
    }

    try {
      await addDoc(collection(db, 'teacherChat'), {
        text: messageText,
        senderId: userProfile.id,
        senderName: userProfile.displayName,
        senderAvatar: userProfile.photoURL || '',
        createdAt: serverTimestamp(),
        status: 'sent',
        readBy: { [userProfile.id]: serverTimestamp() },
        reactions: {},
        replyTo: replyTo?.id || null,
      });
      
      setNewMessage('');
      setReplyTo(null);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditMessage = async (messageId: string, newText: string) => {
    if (!newText.trim()) return;
    
    try {
      await updateDoc(doc(db, 'teacherChat', messageId), {
        text: newText.trim(),
        isEdited: true,
        updatedAt: serverTimestamp()
      });
      setEditingMessage(null);
    } catch (error) {
      console.error('Error editing message:', error);
      setError('Failed to edit message. Please try again.');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!userProfile) return;
    
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    const isAdmin = userProfile.role === 'admin';
    const isOwnMessage = message.senderId === userProfile.id;
    
    try {
      await updateDoc(doc(db, 'teacherChat', messageId), {
        deleted: true,
        deletedBy: userProfile.id,
        deletedByAdmin: isAdmin && !isOwnMessage,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      setError('Failed to delete message. Please try again.');
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
              height: isExpanded ? '90vh' : '500px',
              width: isExpanded ? '90vw' : '400px'
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-lg shadow-xl flex flex-col overflow-hidden"
            style={{
              maxWidth: isExpanded ? '1200px' : '400px',
              maxHeight: isExpanded ? '90vh' : '600px'
            }}
          >
            {/* Header */}
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

            {/* Messages */}
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
                  <div className="group relative max-w-[85%]">
                    {message.deleted ? (
                      <div className="text-gray-400 text-sm italic">
                        {message.deletedByAdmin ? 'Message deleted by admin' : 'Message deleted'}
                      </div>
                    ) : (
                      <div
                        className={`rounded-lg p-3 ${
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
                            {isToday(message.createdAt) 
                              ? format(message.createdAt, 'HH:mm', { locale: it })
                              : isYesterday(message.createdAt)
                              ? `Ieri, ${format(message.createdAt, 'HH:mm', { locale: it })}`
                              : format(message.createdAt, 'dd/MM, HH:mm', { locale: it })
                            }
                          </span>
                          {message.isEdited && (
                            <span className="ml-1 text-xs text-gray-400">(modificato)</span>
                          )}
                        </div>
                        
                        {editingMessage?.id === message.id ? (
                          <div className="mt-2">
                            <Input
                              value={editingMessage.text}
                              onChange={(e) => setEditingMessage({...editingMessage, text: e.target.value})}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleEditMessage(message.id, editingMessage.text);
                                } else if (e.key === 'Escape') {
                                  setEditingMessage(null);
                                }
                              }}
                              autoFocus
                            />
                            <div className="flex justify-end mt-1 space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingMessage(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleEditMessage(message.id, editingMessage.text)}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                        )}
                        
                      </div>
                    )}
                    
                    {/* Message actions */}
                    {!message.deleted && (
                      <div className="absolute -right-2 top-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex space-x-1 bg-white rounded-full shadow-md p-1">
                          <button
                            onClick={() => setReplyTo({
                              id: message.id,
                              text: message.text.substring(0, 50) + '...',
                              senderName: message.senderName
                            })}
                            className="p-1 hover:bg-gray-100 rounded-full"
                          >
                            <ReplyIcon className="h-3 w-3" />
                          </button>
                          {(message.senderId === userProfile.id || userProfile.role === 'admin') && (
                            <>
                              {message.senderId === userProfile.id && (
                                <button
                                  onClick={() => setEditingMessage({id: message.id, text: message.text})}
                                  className="p-1 hover:bg-gray-100 rounded-full"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteMessage(message.id)}
                                className="p-1 hover:bg-gray-100 rounded-full text-red-600"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply preview */}
            {replyTo && (
              <div className="px-4 pt-2 border-t border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between bg-white p-2 rounded-md border">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 mb-1">
                      Rispondi a {replyTo.senderName}
                    </div>
                    <p className="text-sm text-gray-700 truncate">{replyTo.text}</p>
                  </div>
                  <button
                    onClick={() => setReplyTo(null)}
                    className="text-gray-400 hover:text-gray-600 ml-2"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Message Input */}
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
