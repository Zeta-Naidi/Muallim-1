import React, { useState } from 'react';
import { Search, X, Users, MoreVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/Button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/DropdownMenu';

interface ChatHeaderProps {
  title: string;
  participantCount?: number;
  onSearchChange?: (query: string) => void;
  onToggleExpand?: () => void;
  onClose?: () => void;
  isExpanded?: boolean;
  className?: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  title,
  participantCount,
  onSearchChange,
  onToggleExpand,
  onClose,
  isExpanded = false,
  className = '',
}) => {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    onSearchChange?.(value);
  };

  const clearSearch = () => {
    setSearchQuery('');
    onSearchChange?.('');
    setShowSearch(false);
  };

  return (
    <div className={`border-b border-gray-200 bg-white ${className}`}>
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {participantCount !== undefined && (
            <div className="flex items-center text-sm text-gray-500">
              <Users className="h-4 w-4 mr-1" />
              <span>{participantCount}</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-1 text-gray-500 hover:text-gray-700 focus:outline-none"
            aria-label="Search messages"
          >
            <Search className="h-5 w-5" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="p-1 text-gray-500 hover:text-gray-700 focus:outline-none"
                aria-label="More options"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>
                <span>View profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <span>Mute notifications</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <span>Clear chat</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="p-1 text-gray-500 hover:text-gray-700 focus:outline-none"
              aria-label={isExpanded ? 'Minimize chat' : 'Expand chat'}
            >
              {isExpanded ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronUp className="h-5 w-5" />
              )}
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-700 focus:outline-none"
              aria-label="Close chat"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {showSearch && (
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search messages..."
              className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
