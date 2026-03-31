import React from 'react';

interface LogoProps {
  className?: string;       // Additional classes for the container
  iconClassName?: string;   // Classes for the SVG width/height
  textClassName?: string;   // Classes for the text
  showText?: boolean;       // Whether to render "Staffly" text
}

export const Logo: React.FC<LogoProps> = ({
  className = "flex items-center gap-2",
  iconClassName = "h-8 w-8",
  textClassName = "text-xl font-bold tracking-tight",
  showText = true,
}) => {
  return (
    <div className={className}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={iconClassName}
      >
        <defs>
          <linearGradient id="logo-orange" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F37021" />
            <stop offset="100%" stopColor="#C45A1B" />
          </linearGradient>
          <linearGradient id="logo-green-mid" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4A7C36" />
            <stop offset="100%" stopColor="#3A612A" />
          </linearGradient>
          <linearGradient id="logo-green-light" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#76B82D" />
            <stop offset="100%" stopColor="#5E9324" />
          </linearGradient>
        </defs>

        {/* Top Orange Wing - Rounded tips */}
        <path d="M12,48 Q10,50 14,51 L78,14 Q82,12 80,16 L38,54 Z" fill="url(#logo-orange)" />
        
        {/* Middle Green Wing */}
        <path d="M42,58 L88,18 L28,82 Z" fill="url(#logo-green-mid)" />
        
        {/* Large Base Green Wing */}
        <path d="M48,86 L96,24 L68,98 Z" fill="url(#logo-green-light)" />
        
        {/* Tail - Left Orange */}
        <path d="M14,88 L28,82 L26,96 Z" fill="#F37021" />

        {/* Tail - Right Green */}
        <path d="M30,84 L46,96 L30,96 Z" fill="#4A7C36" />
      </svg>
      {showText && (
        <span className={textClassName}>
          <span style={{ color: '#4A7C36' }}>Staff</span>
          <span style={{ color: '#F37021' }}>ly</span>
        </span>
      )}
    </div>
  );
};
