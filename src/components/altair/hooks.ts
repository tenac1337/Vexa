import { useEffect, useRef, useState } from 'react';

export function useVolumeState(
  volume: number,
  connected: boolean,
  setIsListening: (isListening: boolean) => void,
  setIsSpeaking: (isSpeaking: boolean) => void
) {
  const lastVolumeRef = useRef(0);
  const volumeTimeoutRef = useRef<NodeJS.Timeout>();
  const [internalIsSpeaking, setInternalIsSpeaking] = useState(false);
  const consecutiveSilenceRef = useRef(0);
  const lastLoggedStateRef = useRef({ volume: 0, speaking: false, listening: false });
  const speakingEndTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (volumeTimeoutRef.current) {
      clearTimeout(volumeTimeoutRef.current);
    }

    const speakingThreshold = 0.05;
    const silenceThreshold = 0.02;
    const speakingEndDelay = 500; // Wait 500ms before switching from speaking to listening

    if (volume > speakingThreshold) {
      consecutiveSilenceRef.current = 0;
      
      // Clear any pending speaking end timeout since we're speaking again
      if (speakingEndTimeoutRef.current) {
        console.log('🔄 Clearing existing timeout - agent resumed speaking');
        clearTimeout(speakingEndTimeoutRef.current);
        speakingEndTimeoutRef.current = undefined;
      }
      
      if (!internalIsSpeaking) {
        console.log('🎵 Agent starts speaking, volume:', volume.toFixed(4));
        setInternalIsSpeaking(true);
        setIsSpeaking(true);
        setIsListening(false);
        lastLoggedStateRef.current = { volume, speaking: true, listening: false };
      }
    } else if (internalIsSpeaking && volume <= silenceThreshold) {
      // Agent volume dropped - start countdown to switch to listening
      if (!speakingEndTimeoutRef.current) {
        // console.log('⏳ Agent speech paused, starting delay before switching to listening... (volume:', volume.toFixed(4), ')');
        speakingEndTimeoutRef.current = setTimeout(() => {
          // console.log('✅ Agent finished speaking after delay, switching to listening');
          setInternalIsSpeaking(false);
          setIsSpeaking(false);
          setIsListening(true);
          lastLoggedStateRef.current = { volume: 0, speaking: false, listening: true };
          speakingEndTimeoutRef.current = undefined;
        }, speakingEndDelay);
        
        // Debug: Check if timeout was properly set
        // console.log('⏰ Timeout created:', speakingEndTimeoutRef.current);
      } else {
        // Timeout already exists, don't create another one
        // console.log('⏸️ Timeout already exists, volume:', volume.toFixed(4));
      }
    }
    // Check for silence using lower threshold (hysteresis)
    else if (volume <= silenceThreshold) {
      consecutiveSilenceRef.current++;
      
      // If we have consecutive silence and connected, ensure listening state (but only if not speaking)
      if (connected && !internalIsSpeaking && consecutiveSilenceRef.current > 3) {
        if (!lastLoggedStateRef.current.listening) {
          // console.log('👂 Ensuring listening state (silence detected, volume:', volume.toFixed(4), ')');
          lastLoggedStateRef.current.listening = true;
        }
        setIsListening(true);
        setIsSpeaking(false);
      }
    }
    // In between thresholds - maintain current state to avoid flapping
    else if (volume > silenceThreshold && volume <= speakingThreshold) {
      // Do nothing - maintain current state to prevent rapid switching
      if (internalIsSpeaking) {
        // console.log('🔄 Volume in middle range, maintaining speaking state:', volume.toFixed(4));
      }
    }

    lastVolumeRef.current = volume;

    return () => {
      if (volumeTimeoutRef.current) {
        clearTimeout(volumeTimeoutRef.current);
      }
      // Don't clear the speaking end timeout in cleanup - let it complete
    };
  }, [volume, connected, internalIsSpeaking, setIsSpeaking, setIsListening]);

  // Handle connection state changes (removed volume dependency to prevent constant re-runs)
  useEffect(() => {
      // console.log('🔌 Connection state changed:', { connected, internalIsSpeaking });
    
    if (connected && !internalIsSpeaking) {
      // When connected and not speaking, should be listening
      // console.log('🎧 Setting initial listening state (connected + not speaking)');
      setIsListening(true);
      setIsSpeaking(false);
    } else if (!connected) {
      // When disconnected, reset states and clear any pending timeouts
      // console.log('🔴 Disconnected - resetting all states');
      setIsListening(false);
      setIsSpeaking(false);
      setInternalIsSpeaking(false);
      consecutiveSilenceRef.current = 0;
      lastLoggedStateRef.current = { volume: 0, speaking: false, listening: false };
      
      // Clear any pending speaking end timeout
      if (speakingEndTimeoutRef.current) {
        // console.log('🧹 Clearing timeout on disconnect');
        clearTimeout(speakingEndTimeoutRef.current);
        speakingEndTimeoutRef.current = undefined;
      }
    }
  }, [connected, internalIsSpeaking, setIsListening, setIsSpeaking]); // Removed volume dependency
}

export function useBlobModal(
  connected: boolean,
  isListening: boolean,
  isSpeaking: boolean,
  setShowBlobModal: (show: boolean) => void
) {
  const hasShownModalRef = useRef(false);

  useEffect(() => {
    if (connected && (isListening || isSpeaking) && !hasShownModalRef.current) {
      setShowBlobModal(true);
      hasShownModalRef.current = true;
    }
    if (!connected) {
      hasShownModalRef.current = false;
      setShowBlobModal(false);
    }
  }, [connected, isListening, isSpeaking, setShowBlobModal]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowBlobModal(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setShowBlobModal]);
} 