import React, { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  MoreVertical, 
  Trash2, 
  Edit2, 
  Reply, 
  SmilePlus,
  Check, 
  CheckCheck,
  X,
  Image as ImageIcon,
  Paperclip,
  Video,
  FileText,
  Mic,
  FileIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { ChatMessage as ChatMessageType, MessageStatus } from '../../types';
import { Button } from '../ui/Button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/DropdownMenu';
import { EmojiPicker } from '../ui/EmojiPicker';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/Avatar';

interface ChatMessageProps {
  message: ChatMessageType;
  isCurrentUser: boolean;
  onDelete: (messageId: string) => void;
  onEdit: (messageId: string, newText: string) => void;
  onReply: (messageId: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onFileDownload: (url: string, name: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isCurrentUser,
  onDelete,
  onEdit,
  onReply,
  onReact,
  onFileDownload,
}) => {
  const { userProfile } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editText.trim() && editText !== message.text) {
      onEdit(message.id, editText);
    }
    setIsEditing(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    onReact(message.id, emoji);
    setShowEmojiPicker(false);
  };

  const getStatusIcon = () => {
    if (message.status === 'sending') return <span className="text-gray-400 text-xs">⌛</span>;
    if (message.status === 'error') return <span className="text-red-500 text-xs">✕</span>;
    if (message.status === 'read' && message.readBy?.[userProfile?.id || '']) {
      return <CheckCheck className="h-3 w-3 text-blue-500" />;
    }
    if (message.status === 'delivered' || message.status === 'read') {
      return <Check className="h-3 w-3 text-gray-400" />;
    }
    return null;
  };

  const renderAttachment = (attachment: any) => {
    const getFileIcon = () => {
      if (attachment.type.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
      if (attachment.type.startsWith('video/')) return <Video className="h-4 w-4" />;
      if (attachment.type.startsWith('audio/')) return <Mic className="h-4 w-4" />;
      if (attachment.type === 'application/pdf') return <FileText className="h-4 w-4" />;
      return <FileIcon className="h-4 w-4" />;
    };

    return (
      <div 
        key={attachment.url}
        className="flex items-center p-2 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer transition-colors"
        onClick={() => onFileDownload(attachment.url, attachment.name)}
      >
        <div className="mr-2">{getFileIcon()}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{attachment.name}</p>
          <p className="text-xs text-gray-500">{(attachment.size / 1024).toFixed(1)} KB</p>
        </div>
      </div>
    );
  };

  if (message.deleted) {
    return (
      <div className="flex items-center text-gray-400 text-sm italic">
        <span>Message deleted</span>
      </div>
    );
  }

  return (
    <div 
      className={`group flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-2`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex max-w-[85%] md:max-w-[70%]">
        {!isCurrentUser && (
          <div className="flex-shrink-0 mr-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={message.senderAvatar} alt={message.senderName} />
              <AvatarFallback>{message.senderName.charAt(0)}</AvatarFallback>
            </Avatar>
          </div>
        )}

        <div className={`relative ${isCurrentUser ? 'ml-2' : 'mr-2'}`}>
          {message.replyTo && (
            <div className="text-xs text-gray-500 mb-1">
              Replying to {message.senderName}'s message
            </div>
          )}
          
          {isEditing ? (
            <form onSubmit={handleEditSubmit} className="relative">
              <textarea
                ref={editInputRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={3}
                autoFocus
              />
              <div className="flex justify-end mt-1 space-x-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button type="submit" size="sm">
                  Save
                </Button>
              </div>
            </form>
          ) : (
            <div
              className={`rounded-lg p-3 ${
                isCurrentUser
                  ? 'bg-primary-100 text-primary-900 rounded-br-none'
                  : 'bg-gray-100 text-gray-900 rounded-bl-none'
              }`}
            >
              {!isCurrentUser && (
                <div className="font-medium text-sm mb-1">{message.senderName}</div>
              )}
              
              <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
              
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.attachments.map((attachment, index) => (
                    <div key={index}>{renderAttachment(attachment)}</div>
                  ))}
                </div>
              )}
              
              <div className="flex items-center justify-end mt-1 space-x-2">
                <span className="text-xs text-gray-500">
                  {format(message.createdAt, 'HH:mm', { locale: it })}
                </span>
                {isCurrentUser && getStatusIcon()}
              </div>
              
              {Object.keys(message.reactions || {}).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(message.reactions || {}).map(([emoji, userIds]) => (
                    <button
                      key={emoji}
                      onClick={() => onReact(message.id, emoji)}
                      className={`text-xs px-1.5 py-0.5 rounded-full border ${
                        userIds.includes(userProfile?.id || '') 
                          ? 'bg-blue-50 border-blue-200 text-blue-600' 
                          : 'bg-white border-gray-200 text-gray-600'
                      }`}
                    >
                      {emoji} {userIds.length > 1 ? userIds.length : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {(isHovered || showEmojiPicker) && (
            <div className={`absolute flex space-x-1 ${isCurrentUser ? '-left-2' : '-right-2'} -bottom-3 bg-white rounded-full shadow-md p-0.5`}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full p-0 hover:bg-gray-100"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <SmilePlus className="h-3.5 w-3.5" />
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full p-0 hover:bg-gray-100"
                onClick={() => onReply(message.id)}
              >
                <Reply className="h-3.5 w-3.5" />
              </Button>
              
              {isCurrentUser && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-full p-0 hover:bg-gray-100"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => {
                      setIsEditing(true);
                      setEditText(message.text);
                    }}>
                      <Edit2 className="mr-2 h-4 w-4" />
                      <span>Edit</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-red-600"
                      onClick={() => onDelete(message.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
          
          {showEmojiPicker && (
            <div className="absolute -left-4 -top-24 z-10">
              <EmojiPicker onSelect={handleEmojiSelect} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
