import React from 'react';
import { cn } from '../../utils/cn';
import { motion } from 'framer-motion';

interface PageContainerProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  animate?: boolean;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  title,
  description,
  actions,
  className,
  contentClassName,
  animate = true,
}) => {
  const Container = animate ? motion.div : 'div';
  
  const animationProps = animate
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.4 },
      }
    : {};
    
  return (
    <Container 
      className={cn('container mx-auto px-4 py-8 sm:px-6 lg:px-8', className)}
      {...animationProps}
    >
      {(title || description || actions) && (
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              {title && (
                <motion.h1 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="text-3xl font-light text-gray-900 mb-2"
                >
                  {title}
                </motion.h1>
              )}
              {description && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="text-gray-600 font-light"
                >
                  {description}
                </motion.p>
              )}
            </div>
            {actions && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="mt-4 sm:mt-0"
              >
                {actions}
              </motion.div>
            )}
          </div>
        </div>
      )}
      <div className={cn('', contentClassName)}>
        {children}
      </div>
    </Container>
  );
};