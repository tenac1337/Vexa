import React, { useEffect, useState } from 'react';
import { unifiedBlobManager, type UnifiedBlobState, type BlobEnvironment } from '../lib/UnifiedBlobManager';

interface Capabilities {
  environment: BlobEnvironment;
  crossTabSync: boolean;
  systemWideFloating: boolean;
  browserFloating: boolean;
  platform?: string;
}

export const BlobCapabilitiesDemo: React.FC = () => {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [blobState, setBlobState] = useState<UnifiedBlobState | null>(null);
  const [isFloating, setIsFloating] = useState(false);

  useEffect(() => {
    // Get capabilities
    unifiedBlobManager.getCapabilities().then(setCapabilities);

    // Subscribe to blob state
    const unsubscribe = unifiedBlobManager.subscribe('demo', (state) => {
      setBlobState(state);
      setIsFloating(state.isVisible);
    });

    return unsubscribe;
  }, []);

  const handleCreateFloatingBlob = async () => {
    const success = await unifiedBlobManager.createFloatingBlob({
      x: window.innerWidth - 200,
      y: 100
    });
    
    if (success) {
      console.log('✅ Floating blob created successfully!');
    } else {
      console.warn('❌ Failed to create floating blob');
    }
  };

  const handleCloseFloatingBlob = async () => {
    const success = await unifiedBlobManager.closeFloatingBlob();
    
    if (success) {
      console.log('✅ Floating blob closed successfully!');
    } else {
      console.warn('❌ Failed to close floating blob');
    }
  };

  const getEnvironmentIcon = (env: BlobEnvironment) => {
    switch (env) {
      case 'electron': return '🖥️';
      case 'browser': return '🌐';
      default: return '❓';
    }
  };

  const getEnvironmentDescription = (env: BlobEnvironment) => {
    switch (env) {
      case 'electron': 
        return 'Running in Electron - System-wide floating available!';
      case 'browser': 
        return 'Running in browser - Cross-tab sync available!';
      default: 
        return 'Environment detection failed';
    }
  };

  if (!capabilities) {
    return <div>Loading capabilities...</div>;
  }

  return (
    <div style={{
      padding: '20px',
      margin: '20px 0',
      border: '2px solid #FF8C42',
      borderRadius: '16px',
      background: 'linear-gradient(135deg, rgba(255, 140, 66, 0.1) 0%, rgba(255, 107, 26, 0.05) 100%)',
    }}>
      <h3 style={{ color: '#FF8C42', marginBottom: '16px' }}>
        {getEnvironmentIcon(capabilities.environment)} Vexa Blob Capabilities
      </h3>
      
      <div style={{ marginBottom: '16px' }}>
        <p style={{ marginBottom: '8px' }}>
          <strong>Environment:</strong> {getEnvironmentDescription(capabilities.environment)}
        </p>
        
        {capabilities.platform && (
          <p style={{ marginBottom: '8px' }}>
            <strong>Platform:</strong> {capabilities.platform}
          </p>
        )}
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{
          padding: '12px',
          borderRadius: '8px',
          background: capabilities.crossTabSync ? '#d4edda' : '#f8d7da',
          border: `1px solid ${capabilities.crossTabSync ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          <div>{capabilities.crossTabSync ? '✅' : '❌'} Cross-Tab Sync</div>
          <small>Blob syncs across browser tabs</small>
        </div>

        <div style={{
          padding: '12px',
          borderRadius: '8px',
          background: capabilities.systemWideFloating ? '#d4edda' : '#f8d7da',
          border: `1px solid ${capabilities.systemWideFloating ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          <div>{capabilities.systemWideFloating ? '✅' : '❌'} System-Wide Floating</div>
          <small>Blob floats across entire system</small>
        </div>

        <div style={{
          padding: '12px',
          borderRadius: '8px',
          background: capabilities.browserFloating ? '#d4edda' : '#f8d7da',
          border: `1px solid ${capabilities.browserFloating ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          <div>{capabilities.browserFloating ? '✅' : '❌'} Browser Floating</div>
          <small>Blob floats within browser window</small>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <button
          onClick={handleCreateFloatingBlob}
          disabled={isFloating}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: isFloating ? '#6c757d' : 'linear-gradient(135deg, #FF8C42 0%, #FF6B1A 100%)',
            color: 'white',
            cursor: isFloating ? 'not-allowed' : 'pointer',
            fontWeight: '600',
          }}
        >
          {capabilities.systemWideFloating ? '🖥️ Create System Blob' : '🌐 Create Cross-Tab Blob'}
        </button>

        <button
          onClick={handleCloseFloatingBlob}
          disabled={!isFloating}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: !isFloating ? '#6c757d' : 'linear-gradient(135deg, #ff4757 0%, #ff3742 100%)',
            color: 'white',
            cursor: !isFloating ? 'not-allowed' : 'pointer',
            fontWeight: '600',
          }}
        >
          Close Floating Blob
        </button>
      </div>

      {blobState && (
        <div style={{
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.7)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 140, 66, 0.3)',
        }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#FF8C42' }}>Current Blob State:</h4>
          <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
            <div><strong>Visible:</strong> {blobState.isVisible ? '✅ Yes' : '❌ No'}</div>
            <div><strong>Position:</strong> ({blobState.position.x}, {blobState.position.y})</div>
            <div><strong>Listening:</strong> {blobState.isListening ? '🎤 Yes' : '❌ No'}</div>
            <div><strong>Speaking:</strong> {blobState.isSpeaking ? '🔊 Yes' : '❌ No'}</div>
            <div><strong>Volume:</strong> {(blobState.volume * 100).toFixed(1)}%</div>
          </div>
        </div>
      )}

      {capabilities.environment === 'browser' && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(255, 235, 59, 0.2)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 235, 59, 0.5)',
        }}>
          <strong>💡 Tip:</strong> Open this app in multiple browser tabs to see cross-tab sync in action!
        </div>
      )}

      {capabilities.environment === 'electron' && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(76, 175, 80, 0.2)',
          borderRadius: '8px',
          border: '1px solid rgba(76, 175, 80, 0.5)',
        }}>
          <strong>🚀 System-Wide Mode:</strong> Your blob can float across all applications on your desktop!
        </div>
      )}
    </div>
  );
}; 