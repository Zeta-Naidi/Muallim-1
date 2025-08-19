import React from 'react';
import { motion } from 'framer-motion';

interface TypingIndicatorProps {
  users: { [key: string]: string }; // userId -> userName
  className?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  users,
  className = '',
}) => {
  const userList = Object.entries(users);
  
  if (userList.length === 0) {
    return null;
  }

  const userNames = userList.map(([_, name]) => name);
  let text = '';
  
  if (userNames.length === 1) {
    text = `${userNames[0]} sta scrivendo...`;
  } else if (userNames.length === 2) {
    text = `${userNames[0]} e ${userNames[1]} stanno scrivendo...`;
  } else {
    text = `${userNames[0]}, ${userNames[1]} e altri stanno scrivendo...`;
  }

  return (
    <div className={`flex items-center text-sm text-gray-500 ${className}`}>
      <div className="flex items-center mr-2">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-gray-400 rounded-full mx-0.5"
            animate={{
              y: ['0%', '-50%', '0%'],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
      <span>{text}</span>
    </div>
  );
};
