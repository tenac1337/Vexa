import React, { useEffect, useState, useRef } from 'react';
import BlobAI from './BlobAI';

declare global {
  interface Window {
    electronBlobAPI?: {
      onBlobStateUpdate: (callback: (event: any, state: any) => void) => () => void;
      moveWindow: (position: { x: number; y: number }) => Promise<void>;
      platform: string;
      isElectronBlob: boolean;
    };
  }
}

interface BlobState {
  isVisible: boolean;
  position: { x: number; y: number };
  isListening: boolean;
  isSpeaking: boolean;
  volume: number;
  userVolume?: number; // Volume from user's microphone
  userIsActive?: boolean; // Activity from user's microphone
  timestamp: number;
}

// Extend CSSProperties to include WebkitAppRegion
interface ElectronCSSProperties extends React.CSSProperties {
  WebkitAppRegion?: 'drag' | 'no-drag';
}

export const FloatingBlobWindow: React.FC = () => {
  const [blobState, setBlobState] = useState<BlobState>({
    isVisible: true,
    position: { x: 100, y: 100 },
    isListening: false,
    isSpeaking: false,
    volume: 0,
    userVolume: 0,
    userIsActive: false,
    timestamp: Date.now()
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const [showTick, setShowTick] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);

  // Ensure transparency is applied immediately when component mounts
  useEffect(() => {
    // Force transparency for the entire document
    document.documentElement.style.background = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
    document.body.style.background = 'transparent';
    document.body.style.backgroundColor = 'transparent';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    
    // Find and make root and App elements transparent
    const root = document.getElementById('root');
    if (root) {
      root.style.background = 'transparent';
      root.style.backgroundColor = 'transparent';
    }
    
    const app = document.querySelector('.App') as HTMLElement;
    if (app) {
      app.style.background = 'transparent';
      app.style.backgroundColor = 'transparent';
    }
  }, []);

  useEffect(() => {
    // Listen for state updates from the main Electron process
    if (window.electronBlobAPI) {
      const cleanup = window.electronBlobAPI.onBlobStateUpdate((event, state) => {
        setBlobState(state);
      });

      return cleanup;
    }
  }, []);

  // Handle mouse events for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only handle left mouse button
    
    setIsDragging(true);
    const rect = dragRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
    e.preventDefault();
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (isDragging && dragRef.current && window.electronBlobAPI?.isElectronBlob && window.electronBlobAPI?.moveWindow) {
      // Calculate new window position
      const newX = e.screenX - dragOffset.x;
      const newY = e.screenY - dragOffset.y;
      
      // Move the Electron window via IPC
      try {
        const movePromise = window.electronBlobAPI.moveWindow({ x: newX, y: newY });
        if (movePromise && typeof movePromise.catch === 'function') {
          movePromise.catch(error => {
            console.error('Failed to move window:', error);
          });
        }
      } catch (error) {
        console.error('Failed to call moveWindow:', error);
      }
    }
  }, [isDragging, dragOffset.x, dragOffset.y]);

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add global mouse event listeners when dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // --- Drag and Drop Handlers ---
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Necessary to allow drop
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    let droppedText = '';
    
    // Handle dropped text
    if (e.dataTransfer.types.includes('text/plain')) {
      droppedText = e.dataTransfer.getData('text/plain');
      console.log('Dropped text:', droppedText);
    }
    
    // Handle dropped files
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      console.log('Dropped file:', file.name, file.type);
      
      try {
        if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
          droppedText = await file.text();
        } else {
          // Placeholder for more complex file readers (PDF, etc.)
          showTickMark();
          return;
        }
      } catch (error) {
        console.error('Error reading file:', error);
        showTickMark();
        return;
      }
    }

    if (droppedText) {
      // Send to backend
      console.log('Extracted content to send to backend:', droppedText);
      
      try {
        const response = await fetch('http://localhost:3001/api/context', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: droppedText }),
        });
        
        const result = await response.json();
        
        if (result.success) {
          showTickMark();
        } else {
          throw new Error(result.error || 'Unknown error occurred');
        }
      } catch (error: any) {
        console.error('Error storing context:', error);
        showTickMark();
      }
    }
  };

  // Show tick mark with auto-hide
  const showTickMark = () => {
    setShowTick(true);
    setTimeout(() => {
      setShowTick(false);
    }, 2000); // Auto-hide after 2 seconds
  };

  const containerStyle: ElectronCSSProperties = {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent', // Fully transparent background
    overflow: 'hidden',
    cursor: isDragging ? 'grabbing' : 'grab',
    userSelect: 'none',
  };

  const blobStyle: ElectronCSSProperties = {
    borderRadius: '50%',
    background: 'transparent',
    transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    transform: isDragging ? 'scale(1.08)' : 'scale(1)',
    // Glass sphere effect
    position: 'relative',
    // Enhanced shadow for floating effect, now themed with peach
    filter: 'drop-shadow(0 4px 15px rgb(238, 142, 105)) drop-shadow(0 4px 12px rgb(207, 124, 89))',
    // Add subtle glow when active
    ...(blobState.isListening || blobState.isSpeaking ? {
      filter: 'drop-shadow(0 8px 25px rgba(255, 180, 150, 0.25)) drop-shadow(0 4px 12px rgba(220, 150, 120, 0.2)) drop-shadow(0 0 20px rgba(255, 200, 180, 0.5))'
    } : {})
  };

  return (
    <div 
      ref={dragRef}
      onMouseDown={handleMouseDown}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        ...containerStyle,
        // Force absolute transparency
        background: 'none !important' as any,
        backgroundColor: 'transparent !important' as any,
      }}
    >
      {/* Animated Tick Mark */}
      {showTick && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '48px',
            color: '#FF8C42',
            zIndex: 1000,
            animation: 'tickPop 0.6s ease-out',
            pointerEvents: 'none',
            textShadow: '0 3px 12px rgba(255, 140, 66, 0.6)',
            fontWeight: 'bold',
          }}
        >
          ✓
        </div>
      )}

      <div 
        style={{
          ...blobStyle,
          // Additional glass effect styling for transparency
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        <BlobAI
          isListening={blobState.isListening}
          isSpeaking={blobState.isSpeaking}
          volume={blobState.volume}
          userVolume={blobState.userVolume}
          userIsActive={blobState.userIsActive}
          isDragOver={isDragOver}
          size={140}
          enableUserAudio={true} // Disable user audio in floating window to prevent feedback
          transparency={0.95} // Increased opacity for better visibility
        />
      </div>

      {/* CSS Animation for tick mark */}
      <style>{`
        @keyframes tickPop {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.2);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default FloatingBlobWindow; 