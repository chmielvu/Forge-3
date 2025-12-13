
import React from 'react';
import { YandereLedger } from '../types';

interface Props {
  children: React.ReactNode;
  ledger?: YandereLedger;
}

const DistortionLayer: React.FC<Props> = ({ children, ledger }) => {
  // If ledger is missing, render children without effects to prevent crash
  if (!ledger) {
    return <div className="relative w-full h-full overflow-hidden">{children}</div>;
  }

  const trauma = ledger.traumaLevel || 0;
  const shame = ledger.shamePainAbyssLevel || 0;

  // Dynamic styles based on stats
  const blurAmount = Math.max(0, (trauma - 50) / 20); // Starts blurring after 50 trauma
  const saturateAmount = 100 - (shame / 2); // Desaturates as shame increases
  const contrastAmount = 100 + (trauma / 3); // High contrast with trauma

  const containerStyle: React.CSSProperties = {
    filter: `blur(${blurAmount}px) saturate(${saturateAmount}%) contrast(${contrastAmount}%)`,
    transition: 'filter 2s ease-in-out'
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* CRT Scanline Overlay - always present but faint */}
      <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_2px,3px_100%] bg-repeat opacity-20"></div>

      {/* Red Vignette Pulse for Pain */}
      <div 
        className="absolute inset-0 pointer-events-none z-40 bg-radial-gradient-crimson mix-blend-overlay transition-opacity duration-1000"
        style={{ opacity: trauma / 200 }} // Max 0.5 opacity
      ></div>

      {/* Chromatic Aberration Effect (SVG Filter) */}
      {trauma > 30 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-50 opacity-30 mix-blend-screen">
            <filter id="chromatic">
                <feOffset in="SourceGraphic" dx={trauma / 40} dy="0" result="red" />
                <feColorMatrix in="red" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red_channel" />
                <feOffset in="SourceGraphic" dx={-(trauma / 40)} dy="0" result="blue" />
                <feColorMatrix in="blue" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue_channel" />
                <feBlend in="red_channel" in2="blue_channel" mode="screen" />
            </filter>
        </svg>
      )}
      
      {/* Shake Animation Wrapper */}
      <div 
        style={containerStyle}
        className={`w-full h-full ${trauma > 80 ? 'animate-[pulse-slow_0.2s_infinite]' : ''}`}
      >
        {children}
      </div>
    </div>
  );
};

export default DistortionLayer;
