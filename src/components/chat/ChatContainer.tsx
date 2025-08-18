import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { ChatMessage as ChatMessageType } from '../../types';

interface ChatContainerProps {
  title: string;
  participantCount?: number;
  messages: ChatMessageType[];
  currentUserId?: string;
  onSendMessage: (text: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => void;
  onEditMessage: (messageId: string, newText: string) => void;
  onReactToMessage: (messageId: string, emoji: string) => void;
  onReplyToMessage: (messageId: string) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileDownload: (url: string, name: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
  isLoading?: boolean;
  error?: string | null;
  typingUsers: { [key: string]: string };
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  title,
  participantCount,
  messages,
  currentUserId,
  onSendMessage,
  onDeleteMessage,
  onEditMessage,
  onReactToMessage,
  onReplyToMessage,
  onFileSelect,
  onFileDownload,
  isOpen,
  onToggle,
  className = '',
  isLoading = false,
  error = null,
  typingUsers = {},
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [replyTo, setReplyTo] = useState<{id: string, text: string, senderName: string} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const filteredMessages = searchQuery
    ? messages.filter(
        (msg) =>
          msg.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
          msg.senderName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    let text = messageText;
    if (replyTo) {
      // Add reply context to message
      text = `@${replyTo.senderName} ${messageText}`;
    }

    try {
      await onSendMessage(text);
      setMessageText('');
      setReplyTo(null);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleReply = (messageId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (message) {
      setReplyTo({
        id: message.id,
        text: message.text.substring(0, 50) + (message.text.length > 50 ? '...' : ''),
        senderName: message.senderName,
      });
      // Focus the input after a short delay to ensure it's rendered
      setTimeout(() => {
        const input = document.querySelector('textarea') as HTMLTextAreaElement;
        input?.focus();
      }, 100);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileSelect(e);
    // After file is selected, we can show a preview or handle the file
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  if (!isOpen) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onToggle}
        className="fixed bottom-6 right-6 bg-primary-600 text-white p-4 rounded-full shadow-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 z-50"
        aria-label="Open chat"
      >
        <MessageCircle className="h-6 w-6" />
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ 
          opacity: 1, 
          y: 0, 
          scale: 1,
          height: isExpanded ? '90vh' : '600px',
          width: isExpanded ? '90vw' : '400px',
        }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className={`fixed bottom-6 right-6 bg-white rounded-lg shadow-xl flex flex-col overflow-hidden ${className}`}
        style={{
          maxWidth: isExpanded ? '1200px' : '400px',
          maxHeight: isExpanded ? '90vh' : '600px',
        }}
      >
        <ChatHeader
          title={title}
          participantCount={participantCount}
          onSearchChange={setSearchQuery}
          onToggleExpand={() => setIsExpanded(!isExpanded)}
          onClose={onToggle}
          isExpanded={isExpanded}
        />

        <MessageList
          messages={filteredMessages}
          currentUserId={currentUserId}
          onDeleteMessage={onDeleteMessage}
          onEditMessage={onEditMessage}
          onReactToMessage={onReactToMessage}
          onReplyToMessage={handleReply}
          onFileDownload={onFileDownload}
          typingUsers={typingUsers}
        />

        {replyTo && (
          <div className="px-4 pt-2 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between bg-white p-2 rounded-md border border-gray-200">
              <div className="flex-1 min-w-0">
                <div className="flex items-center text-xs text-gray-500 mb-1">
                  <span className="truncate">Rispondi a {replyTo.senderName}</span>
                </div>
                <p className="text-sm text-gray-700 truncate">{replyTo.text}</p>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="text-gray-400 hover:text-gray-600 ml-2"
                aria-label="Cancel reply"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-gray-200 bg-white">
          <ChatInput
            value={messageText}
            onChange={setMessageText}
            onSubmit={handleSend}
            onFileSelect={handleFileSelect}
            placeholder="Scrivi un messaggio..."
            disabled={isLoading}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
