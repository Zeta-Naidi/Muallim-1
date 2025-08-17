import React from 'react';
import { cn } from '../../utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  type = 'button',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] hover:scale-[1.02]';
  
  const variants = {
    primary: 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 active:from-blue-800 active:to-blue-900 focus:ring-blue-500 shadow-md hover:shadow-lg',
    secondary: 'bg-gray-800 text-white hover:bg-gray-900 active:bg-black focus:ring-gray-500 shadow-md hover:shadow-lg',
    outline: 'border-2 border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 focus:ring-gray-500 hover:border-gray-400',
    ghost: 'bg-transparent hover:bg-gray-100 active:bg-gray-200 text-gray-700 hover:text-gray-900',
    link: 'bg-transparent text-blue-600 hover:text-blue-700 hover:underline p-0 h-auto focus:ring-0',
    danger: 'bg-gradient-to-r from-red-500 to-pink-500 text-white hover:from-red-600 hover:to-pink-600 active:from-red-700 active:to-pink-700 focus:ring-red-500 shadow-md hover:shadow-lg',
  };
  
  const sizes = {
    sm: 'text-sm h-9 px-3 py-2',
    md: 'text-base h-11 px-4 py-2',
    lg: 'text-lg h-12 px-6 py-3',
  };
  
  const buttonClasses = cn(
    baseStyles,
    variants[variant],
    sizes[size],
    fullWidth && 'w-full',
    className
  );
  
  return (
    <button
      type={type}
      className={buttonClasses}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <div className="mr-2 animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
      )}
      {leftIcon && !isLoading && <span className="mr-2">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
};