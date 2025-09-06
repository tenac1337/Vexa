import { useCallback, useEffect, useRef, useState } from 'react';

export interface AudioInputData {
  volume: number;
  isActive: boolean;
  frequencies: Uint8Array | null;
}

export function useAudioInput(enabled: boolean = true) {
  const [audioData, setAudioData] = useState<AudioInputData>({
    volume: 0,
    isActive: false,
    frequencies: null,
  });
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();
  const volumeSmoothingRef = useRef(0);
  const enabledRef = useRef(enabled);
  
  // Update enabled ref when prop changes
  useEffect(() => {
    if (enabledRef.current !== enabled) {
      console.log('🎤 Audio input enabled state changed:', enabled);
      enabledRef.current = enabled;
    }
  }, [enabled]);
  
  const startAudioInput = useCallback(async () => {
    try {
      // Check security context before attempting to access microphone
      const isSecureContext = window.isSecureContext;
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (!isSecureContext && !isLocalhost) {
        const httpsUrl = window.location.href.replace('http://', 'https://');
        console.warn(
          "🎤 Insecure context detected. Microphone access may be blocked. " +
          `Current URL: ${window.location.href}. ` +
          `${isMobile ? 'Mobile devices require HTTPS. ' : ''}` +
          `Try accessing via HTTPS: ${httpsUrl}`
        );
      }

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      
      mediaStreamRef.current = stream;
      
      // Create audio context and analyzer
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      
      source.connect(analyser);
      analyserRef.current = analyser;
      
      // Start analysis loop
      const analyze = () => {
        if (!analyserRef.current) return;
        
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Only process audio data if enabled
        if (enabledRef.current) {
          // Calculate volume (RMS)
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(sum / bufferLength);
          const volume = rms / 255;
          
          // Smooth volume changes
          volumeSmoothingRef.current = volumeSmoothingRef.current * 0.7 + volume * 0.3;
          const smoothedVolume = volumeSmoothingRef.current;
          
          // Determine if voice is active (above threshold)
          const isActive = smoothedVolume > 0.01; // Adjustable threshold
          
          setAudioData({
            volume: smoothedVolume,
            isActive,
            frequencies: dataArray,
          });
        } else {
          // When disabled, clear the volume smoothing and set inactive state
          volumeSmoothingRef.current = 0;
          setAudioData({
            volume: 0,
            isActive: false,
            frequencies: null,
          });
        }
        
        animationFrameRef.current = requestAnimationFrame(analyze);
      };
      
      analyze();
      
    } catch (error) {
      console.error('🎤 Error accessing microphone:', error);
      
      const isSecureContext = window.isSecureContext;
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const httpsUrl = window.location.href.replace('http://', 'https://');
      
      // Provide specific error messages for common getUserMedia issues
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
            if (!isSecureContext && !isLocalhost && isMobile) {
              console.error(
                "🚫 Mobile microphone access denied - likely due to insecure context. " +
                "Mobile devices require HTTPS for microphone access. " +
                `Please access via HTTPS: ${httpsUrl}`
              );
            } else {
              console.error(
                "🚫 Microphone access denied. To fix this: " +
                "1) Click the microphone icon in your browser's address bar and allow access, " +
                "2) Make sure you're using HTTPS when accessing from other devices, " +
                "3) Refresh the page and try again."
              );
            }
            break;
          case 'NotFoundError':
            console.error("🎤 No microphone found. Please check if a microphone is connected.");
            break;
          case 'NotSupportedError':
            if (!isSecureContext && !isLocalhost) {
              console.error(
                "❌ Microphone not supported in this context. " +
                `${isMobile ? 'Mobile devices require HTTPS. ' : ''}` +
                `Try accessing via HTTPS: ${httpsUrl}`
              );
            } else {
              console.error(
                "❌ Microphone not supported in this context. " +
                "Try accessing via HTTPS or localhost."
              );
            }
            break;
          case 'SecurityError':
            if (!isSecureContext && !isLocalhost) {
              console.error(
                "🔒 Security error accessing microphone. " +
                `${isMobile ? 'Mobile devices require HTTPS for microphone access. ' : ''}` +
                `Current URL: ${window.location.href}. ` +
                `Please access via HTTPS: ${httpsUrl}`
              );
            } else {
              console.error(
                "🔒 Security error accessing microphone. " +
                "This often happens on non-HTTPS connections. " +
                `Current URL: ${window.location.href}. ` +
                "Try accessing via HTTPS for microphone functionality."
              );
            }
            break;
          default:
            if (!isSecureContext && !isLocalhost && isMobile) {
              console.error(
                `🎤 Microphone access error (${error.name}): ${error.message}. ` +
                `Mobile devices require HTTPS. Try accessing via: ${httpsUrl}`
              );
            } else {
              console.error(`🎤 Microphone access error (${error.name}): ${error.message}`);
            }
        }
      }
      
      setAudioData({ volume: 0, isActive: false, frequencies: null });
    }
  }, []);
  
  const stopAudioInput = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    volumeSmoothingRef.current = 0;
    setAudioData({ volume: 0, isActive: false, frequencies: null });
  }, []);
  
  // Start audio input once and keep it running
  useEffect(() => {
    startAudioInput();
    return stopAudioInput;
  }, [startAudioInput, stopAudioInput]);
  
  return {
    audioData,
    startAudioInput,
    stopAudioInput,
    isSupported: !!(navigator.mediaDevices?.getUserMedia),
  };
} 