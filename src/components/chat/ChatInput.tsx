import React, { useRef, useState } from 'react';
import { Paperclip, Smile, Mic, Send, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { EmojiPicker } from '../ui/EmojiPicker';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSubmit,
  onFileSelect,
  placeholder = 'Type a message...',
  disabled = false,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <div className="flex items-end space-x-2">
        <div className="flex-shrink-0 flex space-x-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-gray-500 hover:text-primary-600 focus:outline-none disabled:opacity-50"
            disabled={disabled}
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileSelect}
            className="hidden"
            multiple
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => setIsEmojiPicker(!isEmojiPickerOpen)}
            className="text-gray-500 hover:text-primary-600 focus:outline-none disabled:opacity-50"
            disabled={disabled}
          >
            <Smile className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="text-gray-500 hover:text-primary-600 focus:outline-none disabled:opacity-50"
            disabled={disabled}
          >
            <Mic className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 relative">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100"
          />
          <div className="absolute right-2 bottom-1.5">
            <Button
              type="submit"
              size="sm"
              disabled={!value.trim() || disabled}
              className="h-8 w-8 p-0 rounded-full"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {isEmojiPicker && (
        <div className="absolute right-0 bottom-12 z-10">
          <EmojiPicker 
            onSelect={(emoji) => {
              onChange(value + emoji);
              setIsEmojiPicker(false);
            }} 
          />
          <button
            type="button"
            onClick={() => setIsEmojiPicker(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </form>
  );
};
