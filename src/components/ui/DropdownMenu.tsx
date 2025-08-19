import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface DropdownMenuProps {
  children: React.ReactNode;
}

interface DropdownMenuTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

interface DropdownMenuContentProps {
  align?: 'start' | 'center' | 'end';
  className?: string;
  children: React.ReactNode;
}

interface DropdownMenuItemProps {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const DropdownMenuContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({
  isOpen: false,
  setIsOpen: () => {},
});

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenuContext.Provider value={{ isOpen, setIsOpen }}>
      <div className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
};

export const DropdownMenuTrigger: React.FC<DropdownMenuTriggerProps> = ({ 
  asChild = false, 
  children 
}) => {
  const { isOpen, setIsOpen } = React.useContext(DropdownMenuContext);

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

export const DropdownMenuContent: React.FC<DropdownMenuContentProps> = ({ 
  align = 'center',
  className,
  children 
}) => {
  const { isOpen, setIsOpen } = React.useContext(DropdownMenuContext);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  const alignmentClasses = {
    start: 'left-0',
    center: 'left-1/2 transform -translate-x-1/2',
    end: 'right-0',
  };

  return (
    <div
      ref={contentRef}
      className={cn(
        'absolute z-50 mt-2 min-w-[8rem] overflow-hidden rounded-md border bg-white p-1 shadow-md',
        alignmentClasses[align],
        className
      )}
    >
      {children}
    </div>
  );
};

export const DropdownMenuItem: React.FC<DropdownMenuItemProps> = ({ 
  className,
  children,
  onClick 
}) => {
  const { setIsOpen } = React.useContext(DropdownMenuContext);

  const handleClick = () => {
    onClick?.();
    setIsOpen(false);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
    >
      {children}
    </button>
  );
};
