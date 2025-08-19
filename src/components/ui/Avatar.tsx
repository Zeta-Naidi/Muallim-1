import React from 'react';
import { cn } from '../../lib/utils';

interface AvatarProps {
  className?: string;
  children?: React.ReactNode;
}

interface AvatarImageProps {
  src?: string;
  alt?: string;
  className?: string;
}

interface AvatarFallbackProps {
  className?: string;
  children?: React.ReactNode;
}

export const Avatar: React.FC<AvatarProps> = ({ className, children }) => {
  return (
    <div className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}>
      {children}
    </div>
  );
};

export const AvatarImage: React.FC<AvatarImageProps> = ({ src, alt, className }) => {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);

  if (!src || imageError) {
    return null;
  }

  return (
    <img
      className={cn("aspect-square h-full w-full", className)}
      src={src}
      alt={alt}
      onLoad={() => setImageLoaded(true)}
      onError={() => setImageError(true)}
      style={{ display: imageLoaded ? 'block' : 'none' }}
    />
  );
};

export const AvatarFallback: React.FC<AvatarFallbackProps> = ({ className, children }) => {
  return (
    <div className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}>
      {children}
    </div>
  );
};
