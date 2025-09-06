// src/components/altair/BlobAI.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useAudioInput } from '../hooks/use-audio-input';

interface BlobAIProps {
  isListening?: boolean;
  isSpeaking?: boolean;
  volume?: number; // Agent speaking volume
  userVolume?: number;
  userIsActive?: boolean;
  size?: number;
  enableUserAudio?: boolean;
  transparency?: number; // 0-1, for floating windows
  isDragOver?: boolean;
}

const BlobAI: React.FC<BlobAIProps> = ({
  isListening = false,
  isSpeaking = false,
  volume = 0, // Agent volume
  userVolume: userVolumeProp = 0,
  userIsActive: userIsActiveProp = false,
  size = 280,
  enableUserAudio = true,
  transparency = 1, // Default transparency
  isDragOver = false,
}) => {
  // User audio input - enabled when listening OR when not speaking (more permissive)
  const shouldEnableUserAudio = enableUserAudio && (isListening || !isSpeaking);
  const { audioData: userAudioFromHook } = useAudioInput(shouldEnableUserAudio);

  // If user audio is disabled (e.g., for floating blob), use props instead.
  const userAudio = !enableUserAudio 
    ? { volume: userVolumeProp, isActive: userIsActiveProp, frequencies: new Uint8Array() }
    : userAudioFromHook;
  
  // Debug logging for BlobAI state
  const lastBlobStateRef = useRef({ isListening: false, isSpeaking: false, shouldEnableUserAudio: false });
  
  useEffect(() => {
    const current = { isListening, isSpeaking, shouldEnableUserAudio };
    const last = lastBlobStateRef.current;
    
    if (last.isListening !== current.isListening || 
        last.isSpeaking !== current.isSpeaking || 
        last.shouldEnableUserAudio !== current.shouldEnableUserAudio) {
      console.log('🎭 BlobAI state:', {
        isListening: current.isListening,
        isSpeaking: current.isSpeaking,
        shouldEnableUserAudio: current.shouldEnableUserAudio,
        userAudioActive: userAudio.isActive,
        isDragOver,
      });
      lastBlobStateRef.current = current;
    }
  }, [isListening, isSpeaking, shouldEnableUserAudio, userAudio.isActive, isDragOver]);

  // Animation state
  const [pulse, setPulse] = useState(0);
  const [gradPhase, setGradPhase] = useState(0);
  const [eyeLook, setEyeLook] = useState({ x: 0, y: 0 });
  const [eyeOpen, setEyeOpen] = useState(1);
  const [audioRipples, setAudioRipples] = useState<Array<{id: number, progress: number, intensity: number}>>([]);
  const [rotation, setRotation] = useState(0);
  const requestRef = useRef<number>();
  const blinkTimeout = useRef<NodeJS.Timeout | null>(null);
  const lookTimeout = useRef<NodeJS.Timeout | null>(null);
  const rippleIdRef = useRef(0);

  // Create audio ripples for user input OR agent speaking
  useEffect(() => {
    if (isSpeaking && volume > 0.02) {
      // Agent is speaking - create ripples based on agent volume
      const intensity = Math.min(volume * 3, 1);
      const newRipple = {
        id: rippleIdRef.current++,
        progress: 0,
        intensity,
      };
      setAudioRipples(prev => [...prev.slice(-4), newRipple]);
    } else if (userAudio.isActive && userAudio.volume > 0.02 && shouldEnableUserAudio) {
      // User is speaking - create ripples based on user volume (increased intensity)
      const intensity = Math.min(userAudio.volume * 4, 1); // Increased from 2 to 4
      const newRipple = {
        id: rippleIdRef.current++,
        progress: 0,
        intensity,
      };
      setAudioRipples(prev => [...prev.slice(-4), newRipple]);
    }
  }, [userAudio.isActive, userAudio.volume, shouldEnableUserAudio, isSpeaking, volume]);

  // Animate pulse, gradient, and ripples
  useEffect(() => {
    let last = Date.now();
    const animate = () => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      
      setPulse(prev => {
        const speed = 1.8 + (isSpeaking ? 2.2 : isListening ? 1.2 : 0.7) + volume * 3.5;
        return prev + dt * speed;
      });
      
      setGradPhase(prev => prev + dt * (0.18 + volume * 0.7 + (isSpeaking ? 0.18 : isListening ? 0.09 : 0)));
      
      // Update rotation based on state
      const baseRotationSpeed = isSpeaking ? 60 : isListening ? 25 : 5; // degrees per second
      const rotationSpeed = isDragOver ? 250 : baseRotationSpeed; // Spin faster for black hole
      setRotation(prev => (prev + dt * rotationSpeed) % 360);

      // Update ripples
      setAudioRipples(prev => prev
        .map(ripple => ({ ...ripple, progress: ripple.progress + dt * 1.2 }))
        .filter(ripple => ripple.progress < 1)
      );
      
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [isSpeaking, isListening, volume, isDragOver]);

  // Eye blinking and looking
  useEffect(() => {
    const blink = () => {
      setEyeOpen(0);
      setTimeout(() => setEyeOpen(1), 120 + Math.random() * 80);
      blinkTimeout.current = setTimeout(
        blink,
        1200 + Math.random() * 1800 + (isSpeaking ? 0 : 400 * Math.random())
      );
    };
    blinkTimeout.current = setTimeout(blink, 1200 + Math.random() * 1200);
    return () => {
      if (blinkTimeout.current) clearTimeout(blinkTimeout.current);
    };
  }, [isSpeaking]);

  useEffect(() => {
    const look = () => {
      const dirs = [
        { x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, 
        { x: 0, y: -1 }, { x: -0.7, y: 0.7 }, { x: 0.7, y: 0.7 },
      ];
      const idx = Math.floor(Math.random() * dirs.length);
      setEyeLook(dirs[idx]);
      lookTimeout.current = setTimeout(look, 1200 + Math.random() * 1800);
    };
    lookTimeout.current = setTimeout(look, 1000 + Math.random() * 1200);
    return () => {
      if (lookTimeout.current) clearTimeout(lookTimeout.current);
    };
  }, []);

  // Geometry
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.32;
  
  // Dynamic scaling based on state
  const pulseStrength = 0.08 + 0.12 * Math.abs(Math.sin(pulse * 0.8)) + 
                        (isSpeaking ? volume * 0.15 : userAudio.volume * 0.2); // Increased user volume multiplier from 0.1 to 0.2
  const blackHoleScale = isDragOver ? 1.15 : 1;
  const scale = (1 + pulseStrength) * blackHoleScale;

  // Volume calculations
  const userVolume = userAudio.volume;
  const currentVolume = isSpeaking ? volume : userVolume;
  const isAudioActive = isSpeaking ? (volume > 0.02) : (userAudio.isActive && shouldEnableUserAudio);
  const listeningIntensity = shouldEnableUserAudio && !isSpeaking ? 0.3 : 0;
  
  // Dynamic color system - new peach theme
  const primaryColor = { r: 255, g: 200, b: 180 }; // Soft Peach
  const secondaryColor = { r: 255, g: 220, b: 200 }; // Lighter Peach

  // Gradient animations
  const gradCx = 60 + Math.sin(gradPhase) * 18 + Math.cos(gradPhase * 0.6) * 8 + Math.sin(pulse * 1.2) * 8 * currentVolume;
  const gradCy = 40 + Math.cos(gradPhase * 1.2) * 16 + Math.sin(gradPhase * 0.4) * 7 + Math.cos(pulse * 1.5) * 8 * currentVolume;

  // Eyes
  const eyeW = size * 0.08;
  const eyeHopen = size * 0.16;
  const eyeHclosed = size * 0.025;
  const eyeH = eyeOpen * eyeHopen + (1 - eyeOpen) * eyeHclosed;
  const eyeY = cy - size * 0.01 + eyeLook.y * size * 0.03;
  const leftEyeX = cx - size * 0.08 + eyeLook.x * size * 0.03;
  const rightEyeX = cx + size * 0.08 + eyeLook.x * size * 0.03;
  const eyeRadius = size * 0.04;

  // Shadow
  const shadowY = cy + r + size * 0.12;
  const shadowW = r * 1.2 * scale;
  const shadowH = r * 0.28 * scale;

  // Show visuals when there's any meaningful state
  const showVisuals = (isListening || isSpeaking) && !isDragOver;
  const showEyes = !isDragOver;

  // Apply transparency styling when in transparent mode
  useEffect(() => {
    if (transparency < 1) {
      // Ensure parent elements are transparent when blob is in transparent mode
      const parentElements = [
        document.documentElement,
        document.body,
        document.getElementById('root'),
        document.querySelector('.App'),
        document.querySelector('.floating-blob-app')
      ];
      
      parentElements.forEach(element => {
        if (element) {
          (element as HTMLElement).style.background = 'transparent';
          (element as HTMLElement).style.backgroundColor = 'transparent';
        }
      });
    }
  }, [transparency]);

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        borderRadius: '50%',
        overflow: 'visible',
        opacity: transparency,
      }}
    >
      {/* Enhanced Shadow with depth */}
      <svg
        width={size}
        height={size * 0.6}
        style={{ position: 'absolute', left: 0, top: size * 0.78, pointerEvents: 'none', zIndex: 1 }}
      >
        <defs>
          <radialGradient id="shadowGradient">
            <stop offset="0%" stopColor="rgba(60,45,100,0.25)" />
            <stop offset="70%" stopColor="rgba(60,45,100,0.08)" />
            <stop offset="100%" stopColor="rgba(60,45,100,0)" />
          </radialGradient>
        </defs>
        <ellipse
          cx={cx}
          cy={shadowH * 1.5}
          rx={shadowW}
          ry={shadowH}
          fill="url(#shadowGradient)"
          style={{ filter: 'blur(8px)' }}
        />
      </svg>

      {/* Unified Audio Visualization Rings (changes color based on state) */}
      {showVisuals && (
        <svg
          width={size}
          height={size}
          viewBox={`${-size * 0.2} ${-size * 0.2} ${size * 1.4} ${size * 1.4}`}
          style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 2 }}
        >
          <defs>
            <radialGradient id="dynamicRingGradient">
              <stop offset="0%" stopColor={`rgba(${primaryColor.r},${primaryColor.g},${primaryColor.b},0)`} />
              <stop offset="85%" stopColor={`rgba(${primaryColor.r},${primaryColor.g},${primaryColor.b},0.6)`} />
              <stop offset="100%" stopColor={`rgba(${primaryColor.r},${primaryColor.g},${primaryColor.b},0)`} />
            </radialGradient>
            <filter id="dynamicRingGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={size * 0.08} result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          {/* Static outer ring */}
          <circle
            cx={cx}
            cy={cy}
            r={r + size * 0.18}
            fill="none"
            stroke={`rgba(${primaryColor.r},${primaryColor.g},${primaryColor.b},0.15)`}
            strokeWidth={2 + currentVolume * 3 + listeningIntensity * 2}
            style={{ 
              filter: 'url(#dynamicRingGlow)',
              opacity: isAudioActive ? 0.9 : 0.6,
              transition: 'all 0.3s ease'
            }}
          />
          
          {/* Dynamic audio ripples */}
          {audioRipples.map(ripple => (
            <circle
              key={ripple.id}
              cx={cx}
              cy={cy}
              r={r + size * 0.15 + ripple.progress * size * 0.25}
              fill="none"
              stroke={`rgba(${primaryColor.r},${primaryColor.g},${primaryColor.b},${ripple.intensity * (1 - ripple.progress) * 0.8})`}
              strokeWidth={4 * ripple.intensity * (1 - ripple.progress)}
              style={{ filter: 'url(#dynamicRingGlow)' }}
            />
          ))}
          
          {/* Breathing ring */}
          <circle
            cx={cx}
            cy={cy}
            r={r + size * 0.12 + Math.sin(pulse * 0.6) * size * 0.04}
            fill="none"
            stroke={`rgba(${primaryColor.r},${primaryColor.g},${primaryColor.b},${0.4 + currentVolume * 0.4 + listeningIntensity * 0.3})`}
            strokeWidth={1 + currentVolume * 2 + listeningIntensity}
            style={{ 
              filter: 'url(#dynamicRingGlow)',
              opacity: isAudioActive ? 0.9 : 0.7,
              transition: 'opacity 0.3s ease'
            }}
          />
        </svg>
      )}

      {/* Dynamic Frequency Bars - only show when user is speaking */}
      {showVisuals && !isSpeaking && userAudio.isActive && (
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 4 }}
        >
          <defs>
            <filter id="freqGlow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {Array.from({ length: 32 }, (_, i) => {
            const angle = (i / 32) * Math.PI * 2;
            let amplitude = 0;
            
            // Only show frequency bars for user speaking (not agent)
            if (userAudio.frequencies && userAudio.isActive) {
              // User speaking - use real frequency data with increased intensity
              const freqIndex = Math.floor((i / 32) * userAudio.frequencies.length * 0.3);
              amplitude = (userAudio.frequencies[freqIndex] / 255) * 1.5; // Increased by 1.5x
            } else if (showVisuals && !isSpeaking) {
              // Baseline pattern when listening (but not when agent is speaking)
              amplitude = 0.1 + Math.sin(pulse * 0.5 + i * 0.2) * 0.05;
            }
            
            const barLength = amplitude * size * 0.15;
            const baseRadius = r + size * 0.10;
            const x1 = cx + Math.cos(angle) * baseRadius;
            const y1 = cy + Math.sin(angle) * baseRadius;
            const x2 = cx + Math.cos(angle) * (baseRadius + barLength);
            const y2 = cy + Math.sin(angle) * (baseRadius + barLength);
            
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={`rgba(${primaryColor.r},${primaryColor.g},${primaryColor.b},${amplitude * 0.8})`} // Always use full opacity for user
                strokeWidth={2 + amplitude * 3} // Increased stroke width multiplier from 2 to 3
                style={{ filter: 'url(#freqGlow)' }}
              />
            );
          })}
        </svg>
      )}

      {/* Main AI Sphere (simplified, no separate agent colors) */}
      <svg
        width={size}
        height={size}
        viewBox={`${-size * 0.15} ${-size * 0.15} ${size * 1.3} ${size * 1.3}`}
        style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 3, transition: 'transform 0.4s ease-out' }}
      >
        <defs>
          {isDragOver ? (
            <>
              {/* Warp Hole Gradient - White and Peachy */}
              <radialGradient id="warpHoleGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFFFFF" /> 
                <stop offset="30%" stopColor="#FFF8F0" /> 
                <stop offset="60%" stopColor="#FFE4D2" />
                <stop offset="80%" stopColor="#FFC8B4" />
                <stop offset="100%" stopColor="#FFB8A0" />
              </radialGradient>
              <radialGradient id="warpHoleCenter" cx="50%" cy="50%" r="25%">
                <stop offset="0%" stopColor="rgba(255, 255, 255, 0.9)" />
                <stop offset="50%" stopColor="rgba(255, 240, 230, 0.7)" />
                <stop offset="100%" stopColor="rgba(255, 200, 180, 0.3)" />
              </radialGradient>
              <linearGradient id="warpRingGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255, 255, 255, 0)" />
                <stop offset="50%" stopColor="rgba(255, 230, 210, 1)" />
                <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
              </linearGradient>
              <filter id="warpHoleGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation={size * 0.025} result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </>
          ) : (
            <>
              {/* Enhanced gradients for a matte, liquid-glass feel */}
              <radialGradient id="mainSphereGradient" cx={`${gradCx}%`} cy={`${gradCy}%`} r="80%">
  <stop offset="0%" stopColor={transparency < 1 ? "rgba(255, 250, 240, 0.8)" : "#FFFAF0"} />
  <stop offset="30%" stopColor={transparency < 1 ? "rgba(251, 228, 210, 0.92)" : "#FBE4D2"} />
  <stop offset="65%" stopColor={transparency < 1 ? "rgba(255, 192, 203, 0.79)" : "#FFC0CB"} />
  <stop offset="85%" stopColor={transparency < 1 ? "rgba(240, 128, 128, 0.6)" : "#F08080"} />
  <stop offset="100%" stopColor={transparency < 1 ? "rgb(205, 92, 92)" : "#CD5C5C"} />
</radialGradient>
              
              <radialGradient id="sphereOverlay" cx="35%" cy="25%" r="85%">
                <stop offset="0%" stopColor="rgba(255, 248, 245, 0.6)" stopOpacity={transparency < 1 ? 0.2 : 0.4} />
                <stop offset="40%" stopColor="rgba(255, 220, 200, 0.3)" stopOpacity={transparency < 1 ? 0.1 : 0.2} />
                <stop offset="75%" stopColor="rgba(255, 230, 220, 0.2)" stopOpacity={transparency < 1 ? 0.05 : 0.1} />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" stopOpacity="0" />
              </radialGradient>
              
              {/* Inner light reflections - softened for a matte finish */}
              <radialGradient id="innerReflection" cx="35%" cy="25%" r="40%">
                <stop offset="0%" stopColor={transparency < 1 ? "rgba(255, 240, 230, 0.7)" : "rgba(255, 240, 230, 0.6)"} />
                <stop offset="50%" stopColor={transparency < 1 ? "rgba(255, 240, 230, 0.3)" : "rgba(255, 240, 230, 0.2)"} />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
              
              {/* Glass refraction effect for floating windows */}
              {transparency < 1 && (
                <radialGradient id="glassRefraction" cx="60%" cy="40%" r="50%">
                  <stop offset="0%" stopColor="rgba(255, 220, 200, 0.15)" />
                  <stop offset="30%" stopColor="rgba(255, 230, 210, 0.08)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
              )}
            </>
          )}
        </defs>

        {/* Main sphere body with enhanced glass effect */}
        <circle
          cx={cx}
          cy={cy}
          r={r * scale}
          fill={isDragOver ? "url(#warpHoleGradient)" : "url(#mainSphereGradient)"}
          style={{ 
            opacity: transparency, 
            transition: 'all 0.4s ease-out',
            filter: isDragOver ? 'url(#warpHoleGlow)' : 'none',
          }}
        />

        {isDragOver ? (
          // Warp Hole Effect with White Center and Peachy Rings
          <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center center', transition: 'transform 0.05s linear' }}>
            {/* Central white glow */}
            <circle
              cx={cx}
              cy={cy}
              r={r * scale * 0.3}
              fill="url(#warpHoleCenter)"
              style={{ filter: 'url(#warpHoleGlow)', opacity: 0.9 }}
            />
            
            {/* Outer warp rings */}
            <ellipse
              cx={cx}
              cy={cy}
              rx={r * scale * 0.9}
              ry={r * scale * 0.6}
              fill="none"
              stroke="url(#warpRingGradient)"
              strokeWidth={size * 0.015}
              strokeLinecap="round"
              style={{ filter: 'blur(4px)', opacity: 0.9 }}
            />
            <ellipse
              cx={cx}
              cy={cy}
              rx={r * scale * 0.75}
              ry={r * scale * 0.45}
              fill="none"
              stroke="url(#warpRingGradient)"
              strokeWidth={size * 0.01}
              strokeLinecap="round"
              style={{ filter: 'blur(2px)', transform: 'rotate(45deg)', transformOrigin: 'center center', opacity: 0.7 }}
            />
          </g>
        ) : (
          <>
            {/* Sphere overlay for depth */}
            <circle
              cx={cx}
              cy={cy}
              r={r * scale}
              fill="url(#sphereOverlay)"
              style={{ 
                transform: `rotate(${rotation}deg)`, 
                transformOrigin: 'center center',
                transition: 'transform 0.1s linear'
              }}
            />
            
            {/* Glass refraction layer for floating windows */}
            {transparency < 1 && (
              <circle
                cx={cx}
                cy={cy}
                r={r * scale}
                fill="url(#glassRefraction)"
                style={{ opacity: 0.6 }}
              />
            )}
            
            {/* Inner reflection for 3D effect */}
            <ellipse
              cx={cx - size * 0.02}
              cy={cy - size * 0.03}
              rx={r * scale * 0.6}
              ry={r * scale * 0.4}
              fill="url(#innerReflection)"
              style={{ opacity: transparency < 1 ? 0.7 : 0.5 }}
            />
          </>
        )}
        

        {showEyes && (
          <>
            {/* Enhanced Eyes with depth */}
            <defs>
              <filter id="eyeGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation={2} result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            
            {/* Eye shadows for depth */}
            <rect
              x={leftEyeX - eyeW / 2 + 1}
              y={eyeY - eyeH / 2 + 1}
              width={eyeW}
              height={eyeH}
              rx={eyeRadius}
              ry={eyeRadius}
              fill="rgba(180, 120, 100, 0.2)"
            />
            <rect
              x={rightEyeX - eyeW / 2 + 1}
              y={eyeY - eyeH / 2 + 1}
              width={eyeW}
              height={eyeH}
              rx={eyeRadius}
              ry={eyeRadius}
              fill="rgba(180, 120, 100, 0.2)"
            />
            
            {/* Main eyes */}
            <rect
              x={leftEyeX - eyeW / 2}
              y={eyeY - eyeH / 2}
              width={eyeW}
              height={eyeH}
              rx={eyeRadius}
              ry={eyeRadius}
              fill="#ffffff"
              style={{ 
                filter: 'url(#eyeGlow)', 
                transition: 'all 0.18s cubic-bezier(.4,2,.6,1)' 
              }}
            />
            <rect
              x={rightEyeX - eyeW / 2}
              y={eyeY - eyeH / 2}
              width={eyeW}
              height={eyeH}
              rx={eyeRadius}
              ry={eyeRadius}
              fill="#ffffff"
              style={{ 
                filter: 'url(#eyeGlow)', 
                transition: 'all 0.18s cubic-bezier(.4,2,.6,1)' 
              }}
            />
            
            {/* Eye highlights */}
            <circle
              cx={leftEyeX - eyeW * 0.15}
              cy={eyeY - eyeH * 0.2}
              r={eyeW * 0.15}
              fill="rgba(255,255,255,0.9)"
              style={{ opacity: eyeOpen }}
            />
            <circle
              cx={rightEyeX - eyeW * 0.15}
              cy={eyeY - eyeH * 0.2}
              r={eyeW * 0.15}
              fill="rgba(255,255,255,0.9)"
              style={{ opacity: eyeOpen }}
            />
          </>
        )}
      </svg>
    </div>
  );
};

export default BlobAI;