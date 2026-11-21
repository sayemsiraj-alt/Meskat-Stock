import React, { useState, useEffect } from 'react';

interface CompanyLogoProps {
  className?: string;
  shortName?: string;
  logoUrl?: string;
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({ 
  className = "w-12 h-12",
  shortName = "Stock",
  logoUrl = ""
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  // Reset failed state whenever logoUrl prop changes
  useEffect(() => {
    setImgFailed(false);
  }, [logoUrl]);

  // If user uploaded a custom logo image via Settings, show it
  if (logoUrl && !imgFailed) {
    return (
      <div className={`relative flex items-center justify-center rounded-full bg-white shrink-0 border-2 border-slate-200/90 shadow-sm overflow-hidden select-none ${className}`}>
        <img 
          src={logoUrl} 
          alt="Custom Logo" 
          className="w-full h-full object-contain rounded-full bg-white p-0.5"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  // Fallback / Default Calligraphy SVG Logo
  return (
    <div className={`relative flex items-center justify-center rounded-full bg-white shrink-0 border-2 border-slate-200/90 shadow-sm overflow-hidden select-none ${className}`}>
      <svg 
        viewBox="0 0 100 100" 
        className="w-full h-full rounded-full bg-white"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <style>{`
            .calligraphy-text {
              font-family: 'Brush Script MT', 'Apple Chancery', 'Lucida Calligraphy', cursive, serif;
            }
          `}</style>

          {/* Premium Gradient for 'Dear' Calligraphy Logo */}
          <linearGradient id="calligraphyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E40AF" />   {/* Royal Blue */}
            <stop offset="50%" stopColor="#0284C7" />  {/* Vibrant Cyan */}
            <stop offset="100%" stopColor="#059669" /> {/* Emerald Green */}
          </linearGradient>

          {/* Soft Shadow Filter for Typography */}
          <filter id="calligraphyShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1" floodColor="#0284C7" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Outer Subtle Circular Ring */}
        <circle cx="50" cy="50" r="47" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
        <circle cx="50" cy="50" r="44" fill="none" stroke="url(#calligraphyGrad)" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />

        {/* Elegant Calligraphic Under-Swoosh Ribbon */}
        <path 
          d="M 18 64 C 35 78 65 78 82 64 C 68 73 32 73 18 64 Z" 
          fill="url(#calligraphyGrad)" 
          opacity="0.8"
        />

        {/* Beautiful Calligraphy 'Dear' Text */}
        <text 
          x="50" 
          y="58" 
          textAnchor="middle" 
          fill="url(#calligraphyGrad)" 
          className="calligraphy-text"
          fontSize="40" 
          fontWeight="bold"
          filter="url(#calligraphyShadow)"
        >
          {shortName}
        </text>
      </svg>
    </div>
  );
};
