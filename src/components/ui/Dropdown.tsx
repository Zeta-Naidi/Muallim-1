import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  description?: string;
}

interface DropdownProps {
  label?: string;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  options: DropdownOption[];
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  searchable?: boolean;
  multiple?: boolean;
  maxHeight?: number;
}

export const Dropdown = forwardRef<HTMLButtonElement, DropdownProps>(
  (
    {
      label,
      error,
      disabled,
      placeholder = 'Seleziona un\'opzione',
      className,
      fullWidth,
      leftIcon,
      options,
      value,
      onChange,
      name,
      required,
      searchable = false,
      multiple = false,
      maxHeight = 300,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedValues, setSelectedValues] = useState<string[]>(
      multiple ? (Array.isArray(value) ? value : value ? [value] : []) : []
    );
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const filteredOptions = options.filter(option =>
      searchable
        ? option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          option.description?.toLowerCase().includes(searchTerm.toLowerCase())
        : true
    );

    const selectedOption = options.find(opt => opt.value === value);
    const selectedLabel = multiple
      ? selectedValues.length > 0
        ? `${selectedValues.length} selezionati`
        : placeholder
      : selectedOption?.label || placeholder;

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          setSearchTerm('');
        }
      };

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setIsOpen(false);
          setSearchTerm('');
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        if (searchable && searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }, [isOpen, searchable]);

    const handleSelect = (optionValue: string) => {
      if (multiple) {
        const newSelectedValues = selectedValues.includes(optionValue)
          ? selectedValues.filter(v => v !== optionValue)
          : [...selectedValues, optionValue];
        setSelectedValues(newSelectedValues);
        onChange?.(newSelectedValues.join(','));
      } else {
        onChange?.(optionValue);
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    const handleToggle = () => {
      if (!disabled) {
        setIsOpen(!isOpen);
      }
    };

    return (
      <div className={cn('relative', fullWidth ? 'w-full' : '', className)} ref={containerRef}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        )}
        
        <motion.button
          ref={ref}
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={cn(
            'relative w-full h-12 px-4 rounded-2xl border-2 bg-gray-50/50 text-left transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
            leftIcon ? 'pl-12' : 'pl-4',
            disabled
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
              : isOpen
              ? 'bg-white border-blue-300 shadow-lg'
              : error
              ? 'border-red-300 bg-red-50/50 focus:border-red-400'
              : 'border-gray-200/50 hover:border-blue-300 hover:bg-white focus:bg-white focus:border-blue-300',
            fullWidth ? 'w-full' : ''
          )}
          whileHover={!disabled ? { scale: 1.01 } : {}}
          whileTap={!disabled ? { scale: 0.99 } : {}}
        >
          {leftIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              {leftIcon}
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <span className={cn(
              'block truncate text-base',
              value || selectedValues.length > 0 ? 'text-gray-900' : 'text-gray-500'
            )}>
              {selectedLabel}
            </span>
            
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="ml-2 flex-shrink-0"
            >
              <ChevronDown className="h-5 w-5 text-gray-400" />
            </motion.div>
          </div>
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-200/50 backdrop-blur-xl overflow-hidden"
              style={{ maxHeight }}
            >
              {searchable && (
                <div className="p-3 border-b border-gray-100">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Cerca..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                  />
                </div>
              )}
              
              <div className="max-h-64 overflow-y-auto">
                {filteredOptions.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    <p className="text-sm">Nessuna opzione trovata</p>
                  </div>
                ) : (
                  filteredOptions.map((option, index) => {
                    const isSelected = multiple
                      ? selectedValues.includes(option.value)
                      : value === option.value;
                    
                    return (
                      <motion.button
                        key={option.value}
                        type="button"
                        onClick={() => !option.disabled && handleSelect(option.value)}
                        disabled={option.disabled}
                        className={cn(
                          'w-full px-4 py-3 text-left transition-all duration-200 flex items-center justify-between group',
                          option.disabled
                            ? 'text-gray-400 cursor-not-allowed'
                            : isSelected
                            ? 'bg-blue-50 text-blue-900 border-l-4 border-blue-500'
                            : 'text-gray-900 hover:bg-gray-50'
                        )}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.1, delay: index * 0.02 }}
                        whileHover={!option.disabled ? { x: 4 } : {}}
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          {option.icon && (
                            <div className={cn(
                              'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200',
                              isSelected
                                ? 'bg-blue-100 text-blue-600'
                                : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                            )}>
                              {option.icon}
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className={cn(
                                'font-medium truncate',
                                option.disabled ? 'text-gray-400' : 'text-gray-900'
                              )}>
                                {option.label}
                              </span>
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="flex-shrink-0"
                                >
                                  <Check className="h-4 w-4 text-blue-600" />
                                </motion.div>
                              )}
                            </div>
                            {option.description && (
                              <p className="text-xs text-gray-500 truncate mt-0.5">
                                {option.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-sm text-red-600 flex items-center"
          >
            <span className="ml-1">{error}</span>
          </motion.p>
        )}

        {/* Hidden input for form submission */}
        <input
          type="hidden"
          name={name}
          value={multiple ? selectedValues.join(',') : value || ''}
        />
      </div>
    );
  }
);

Dropdown.displayName = 'Dropdown';
