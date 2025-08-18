import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface PopoverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

interface PopoverTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

interface PopoverContentProps {
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  children: React.ReactNode;
}

const PopoverContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({
  isOpen: false,
  setIsOpen: () => {},
});

export const Popover: React.FC<PopoverProps> = ({ 
  open, 
  onOpenChange, 
  children 
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  
  const setIsOpen = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };

  return (
    <PopoverContext.Provider value={{ isOpen, setIsOpen }}>
      <div className="relative inline-block">
        {children}
      </div>
    </PopoverContext.Provider>
  );
};

export const PopoverTrigger: React.FC<PopoverTriggerProps> = ({ 
  asChild = false, 
  children 
}) => {
  const { isOpen, setIsOpen } = React.useContext(PopoverContext);

  const handleClick = () => {
    setIsOpen(!isOpen);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: handleClick,
      'aria-expanded': isOpen,
      'aria-haspopup': true,
    });
  }

  return (
    <button
      onClick={handleClick}
      aria-expanded={isOpen}
      aria-haspopup={true}
      className="inline-flex items-center justify-center"
    >
      {children}
    </button>
  );
};

export const PopoverContent: React.FC<PopoverContentProps> = ({ 
  align = 'center',
  side = 'bottom',
  className,
  children 
}) => {
  const { isOpen, setIsOpen } = React.useContext(PopoverContext);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  const sideClasses = {
    top: 'bottom-full mb-2',
    right: 'left-full ml-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
  };

  const alignmentClasses = {
    start: side === 'top' || side === 'bottom' ? 'left-0' : 'top-0',
    center: side === 'top' || side === 'bottom' ? 'left-1/2 transform -translate-x-1/2' : 'top-1/2 transform -translate-y-1/2',
    end: side === 'top' || side === 'bottom' ? 'right-0' : 'bottom-0',
  };

  return (
    <div
      ref={contentRef}
      className={cn(
        'absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-white p-1 shadow-md animate-in fade-in-0 zoom-in-95',
        sideClasses[side],
        alignmentClasses[align],
        className
      )}
    >
      {children}
    </div>
  );
};
