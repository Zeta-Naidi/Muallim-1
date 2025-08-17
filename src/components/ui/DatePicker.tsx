import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';

interface DatePickerProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(({
  label,
  error,
  disabled,
  placeholder,
  className,
  fullWidth = false,
  leftIcon,
  value,
  onChange,
  name,
  required,
  min,
  max,
  ...props
}, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <div className={cn('relative', fullWidth ? 'w-full' : 'w-64', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
            {leftIcon}
          </div>
        )}
        
        <input
          type="date"
          ref={ref}
          name={name}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          min={min}
          max={max}
          className={cn(
            'w-full h-12 px-4 text-base rounded-2xl border transition-all duration-300',
            'bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20',
            error 
              ? 'border-red-300 focus:border-red-500' 
              : 'border-gray-200/50 focus:border-blue-300 hover:border-gray-300',
            disabled && 'bg-gray-100 cursor-not-allowed text-gray-400',
            leftIcon ? 'pl-10' : 'pl-4',
            'pr-4',
            className
          )}
          {...props}
        />
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  );
});

DatePicker.displayName = 'DatePicker';
