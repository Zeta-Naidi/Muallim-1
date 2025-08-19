import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isYesterday, isThisWeek, isThisYear } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChatMessage as ChatMessageType } from '../../types';
import { ChatMessage } from './ChatMessage';
import { TypingIndicator } from './TypingIndicator';

interface MessageListProps {
  messages: ChatMessageType[];
  currentUserId?: string;
  onDeleteMessage: (messageId: string) => void;
  onEditMessage: (messageId: string, newText: string) => void;
  onReactToMessage: (messageId: string, emoji: string) => void;
  onReplyToMessage: (messageId: string) => void;
  onFileDownload: (url: string, name: string) => void;
  typingUsers: { [key: string]: string };
  className?: string;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  onDeleteMessage,
  onEditMessage,
  onReactToMessage,
  onReplyToMessage,
  onFileDownload,
  typingUsers,
  className = '',
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const prevMessagesLength = useRef(messages.length);

  // Scroll to bottom when new messages arrive and user is already at bottom
  useEffect(() => {
    if (isAtBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isAtBottom]);

  // Handle scroll events to detect if user is at bottom
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isBottom = scrollHeight - scrollTop - clientHeight < 100; // 100px threshold
    
    if (isBottom !== isAtBottom) {
      setIsAtBottom(isBottom);
    }
  }, [isAtBottom]);

  // Add scroll event listener
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Format date for message groups
  const formatMessageDate = (date: Date) => {
    if (isToday(date)) {
      return 'Oggi';
    } else if (isYesterday(date)) {
      return 'Ieri';
    } else if (isThisWeek(date, { weekStartsOn: 1 })) {
      return format(date, 'EEEE', { locale: it });
    } else if (isThisYear(date)) {
      return format(date, 'd MMMM', { locale: it });
    } else {
      return format(date, 'd MMMM yyyy', { locale: it });
    }
  };

  // Group messages by date
  const groupedMessages = React.useMemo(() => {
    const groups: { date: string; messages: ChatMessageType[] }[] = [];
    let currentDate = '';
    let currentGroup: ChatMessageType[] = [];

    messages.forEach((message) => {
      const messageDate = formatMessageDate(message.createdAt);
      
      if (messageDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({
            date: currentDate,
            messages: [...currentGroup],
          });
          currentGroup = [];
        }
        currentDate = messageDate;
      }
      
      currentGroup.push(message);
    });

    // Add the last group
    if (currentGroup.length > 0) {
      groups.push({
        date: currentDate,
        messages: currentGroup,
      });
    }

    return groups;
  }, [messages]);

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    if (messagesEndRef.current && prevMessagesLength.current === 0 && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length]);

  return (
    <div 
      ref={containerRef}
      className={`flex-1 overflow-y-auto p-4 space-y-6 ${className}`}
    >
      {groupedMessages.map((group) => (
        <div key={group.date} className="space-y-2">
          <div className="flex items-center justify-center my-4">
            <div className="px-3 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-full">
              {group.date}
            </div>
          </div>
          
          <div className="space-y-4">
            {group.messages.map((message, index, array) => {
              const isFirstInGroup = index === 0 || array[index - 1].senderId !== message.senderId;
              const isLastInGroup = index === array.length - 1 || array[index + 1].senderId !== message.senderId;
              
              return (
                <AnimatePresence key={message.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChatMessage
                      message={message}
                      isCurrentUser={message.senderId === currentUserId}
                      showAvatar={isLastInGroup}
                      showHeader={isFirstInGroup}
                      onDelete={onDeleteMessage}
                      onEdit={onEditMessage}
                      onReply={onReplyToMessage}
                      onReact={onReactToMessage}
                      onFileDownload={onFileDownload}
                      className={!isLastInGroup ? 'mb-1' : ''}
                    />
                  </motion.div>
                </AnimatePresence>
              );
            })}
          </div>
        </div>
      ))}
      
      {Object.keys(typingUsers).length > 0 && (
        <div className="pt-2">
          <TypingIndicator users={typingUsers} />
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
};
