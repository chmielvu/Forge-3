
import React, { useEffect, useRef } from 'react';
import { YandereLedger } from '../types';

interface Props {
  ledger?: YandereLedger;
  isActive: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const ReactiveCanvas: React.FC<Props> = ({ ledger, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const getParticleConfig = () => {
      // Defensive coding: Handle undefined ledger safely
      const trauma = ledger?.traumaLevel ?? 0;
      const shame = ledger?.shamePainAbyssLevel ?? 0;
      const arousal = ledger?.arousalLevel ?? 0;
      const hope = ledger?.hopeLevel ?? 50;

      return {
        spawnRate: Math.max(1, Math.floor(trauma / 10)),
        // Color Logic: Deep crimson for shame, bright arterial red for arousal, dried blood otherwise
        color: shame > 60 ? '#450a0a' : arousal > 60 ? '#ef4444' : '#7f1d1d', 
        // Speed increases with trauma
        speed: 0.5 + (trauma / 50), 
        // Size increases with shame (heavier drops)
        size: 1 + (shame / 40), 
        // Opacity linked to trauma
        opacity: Math.min(0.9, 0.2 + (trauma / 100)), 
        // Turbulence (X-axis jitter) linked to arousal
        turbulence: arousal / 50, 
        // Gravity heavier when hope is low
        gravity: hope < 30 ? 0.15 : 0.05, 
        // Glow threshold
        hasGlow: trauma > 70,
        // Shake threshold
        hasShake: shame > 80 || trauma > 90
      };
    };

    const loop = () => {
      if (!isActive) return;

      const config = getParticleConfig();
      const { width, height } = canvas;

      // 1. Clear / Trail Effect
      // We use a low-opacity fillRect to create trails instead of clearRect
      ctx.fillStyle = 'rgba(5, 5, 5, 0.15)';
      ctx.fillRect(0, 0, width, height);

      // 2. Screen Shake Logic (Canvas Jitter)
      ctx.save();
      if (config.hasShake) {
        const trauma = ledger?.traumaLevel ?? 0;
        const shakeIntensity = (trauma / 20);
        const dx = (Math.random() - 0.5) * shakeIntensity;
        const dy = (Math.random() - 0.5) * shakeIntensity;
        ctx.translate(dx, dy);
      }

      // 3. Spawn Logic
      // Limit max particles for performance
      if (particles.current.length < 500) {
        // Spawn multiple based on rate
        for (let i = 0; i < config.spawnRate; i++) {
          if (Math.random() > 0.5) continue; // Throttle slightly
          
          particles.current.push({
            x: Math.random() * width,
            y: -20, // Start above screen
            vx: (Math.random() - 0.5) * 0.5,
            vy: Math.random() * config.speed + 1,
            life: 1.0,
            maxLife: 1.0,
            size: Math.random() * config.size + 1,
            color: config.color
          });
        }
      }

      // 4. Update & Draw
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];

        // Physics
        p.x += p.vx + ((Math.random() - 0.5) * config.turbulence);
        p.y += p.vy;
        p.vy += config.gravity; // Apply gravity acceleration
        p.life -= 0.005;

        // Drawing
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        
        ctx.fillStyle = p.color;
        ctx.globalAlpha = config.opacity * p.life;
        
        // Glow Effect for High Trauma
        if (config.hasGlow) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#ef4444';
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0; // Reset

        // Cull dead particles
        if (p.life <= 0 || p.y > height + 20) {
          particles.current.splice(i, 1);
        }
      }

      ctx.restore();
      animationRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [ledger, isActive]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 z-5 pointer-events-none mix-blend-screen opacity-80"
    />
  );
};

export default ReactiveCanvas;
