import React from 'react';
import ReactSelect, { Props as ReactSelectProps } from 'react-select';
import { cn } from '../../utils/cn';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<ReactSelectProps<SelectOption>, 'classNames'> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  fullWidth,
  className,
  ...props
}) => {
  return (
    <div className={cn(fullWidth && 'w-full', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <ReactSelect
        {...props}
        styles={{
          control: (base, state) => ({
            ...base,
            borderRadius: '0.5rem',
            borderColor: error ? '#EF4444' : state.isFocused ? '#3B82F6' : '#D1D5DB',
            boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.25)' : 'none',
            '&:hover': {
              borderColor: error ? '#EF4444' : '#9CA3AF'
            }
          }),
          option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#3B82F6' : state.isFocused ? '#EFF6FF' : 'white',
            color: state.isSelected ? 'white' : '#111827',
            cursor: 'pointer',
            '&:active': {
              backgroundColor: '#2563EB'
            }
          }),
          menu: (base) => ({
            ...base,
            borderRadius: '0.5rem',
            overflow: 'hidden',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
          })
        }}
        theme={(theme) => ({
          ...theme,
          colors: {
            ...theme.colors,
            primary: '#3B82F6',
            primary25: '#EFF6FF',
            primary50: '#DBEAFE',
            primary75: '#BFDBFE'
          }
        })}
      />
      {error && (
        <p className="mt-1 text-sm text-error-500">{error}</p>
      )}
    </div>
  );
};