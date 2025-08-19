import React, { useState, useRef, useEffect } from 'react';
import { Smile } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { Button } from './Button';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  children?: React.ReactNode;
}

const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
  'Gestures': ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
  'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  'Objects': ['💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤', '👋', '🤚', '🖐️', '✋', '🖖', '👌'],
};

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Smileys');
  const popoverRef = useRef<HTMLDivElement>(null);

  const handleEmojiSelect = (emoji: string) => {
    onSelect(emoji);
    setIsOpen(false);
  };

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {children || (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0 hover:bg-gray-100"
          >
            <Smile className="h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 border shadow-lg" align="end">
        <div ref={popoverRef} className="bg-white rounded-md">
          {/* Category tabs */}
          <div className="flex border-b border-gray-200 p-2">
            {Object.keys(EMOJI_CATEGORIES).map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-3 py-1 text-xs font-medium rounded-md mr-1 ${
                  activeCategory === category
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          
          {/* Emoji grid */}
          <div className="p-3 max-h-64 overflow-y-auto">
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES].map((emoji, index) => (
                <button
                  key={index}
                  onClick={() => handleEmojiSelect(emoji)}
                  className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded transition-colors"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
