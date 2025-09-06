import React, { useEffect, useState } from 'react';

interface AudioDiagnostics {
  isSecureContext: boolean;
  isLocalhost: boolean;
  hasGetUserMedia: boolean;
  hasAudioWorklet: boolean;
  currentUrl: string;
  userAgent: string;
}

const AudioDiagnosticsComponent: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<AudioDiagnostics | null>(null);
  const [microphoneTest, setMicrophoneTest] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const diag: AudioDiagnostics = {
      isSecureContext: window.isSecureContext,
      isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
      hasGetUserMedia: !!(navigator.mediaDevices?.getUserMedia),
      hasAudioWorklet: !!(window.AudioContext && new AudioContext().audioWorklet),
      currentUrl: window.location.href,
      userAgent: navigator.userAgent,
    };
    setDiagnostics(diag);
  }, []);

  const testMicrophone = async () => {
    setMicrophoneTest('testing');
    setErrorMessage('');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicrophoneTest('success');
      // Stop the stream immediately after successful test
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      setMicrophoneTest('error');
      if (error instanceof DOMException) {
        setErrorMessage(`${error.name}: ${error.message}`);
      } else {
        setErrorMessage(String(error));
      }
    }
  };

  if (!diagnostics) return <div>Loading diagnostics...</div>;

  const getRecommendation = () => {
    if (!diagnostics.isSecureContext && !diagnostics.isLocalhost) {
      return {
        status: 'error',
        message: 'Insecure Context - Audio input blocked',
        solution: `Access via HTTPS: Replace "http://" with "https://" in your URL. Your HTTPS URL should be: https://${window.location.host}`
      };
    }
    
    if (!diagnostics.hasGetUserMedia) {
      return {
        status: 'error',
        message: 'getUserMedia not available',
        solution: 'Your browser does not support microphone access. Try updating your browser.'
      };
    }
    
    return {
      status: 'success',
      message: 'Audio input should work',
      solution: 'Click "Test Microphone" below to verify access.'
    };
  };

  const recommendation = getRecommendation();

  return (
    <div style={{ 
      padding: '20px', 
      border: '1px solid #ccc', 
      borderRadius: '8px', 
      margin: '10px',
      fontFamily: 'monospace',
      fontSize: '12px'
    }}>
      <h3>🎤 Audio Input Diagnostics</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <h4>Browser Environment:</h4>
        <div>✅ Secure Context: {diagnostics.isSecureContext ? '✅ Yes' : '❌ No'}</div>
        <div>🏠 Localhost: {diagnostics.isLocalhost ? '✅ Yes' : '❌ No'}</div>
        <div>🎤 getUserMedia: {diagnostics.hasGetUserMedia ? '✅ Available' : '❌ Not Available'}</div>
        <div>🔊 AudioWorklet: {diagnostics.hasAudioWorklet ? '✅ Available' : '❌ Not Available'}</div>
        <div>🌐 URL: {diagnostics.currentUrl}</div>
      </div>

      <div style={{ 
        padding: '10px', 
        borderRadius: '4px',
        backgroundColor: recommendation.status === 'success' ? '#d4edda' : '#f8d7da',
        color: recommendation.status === 'success' ? '#155724' : '#721c24'
      }}>
        <strong>Status:</strong> {recommendation.message}<br/>
        <strong>Solution:</strong> {recommendation.solution}
      </div>

      <div style={{ marginTop: '15px' }}>
        <button 
          onClick={testMicrophone}
          disabled={microphoneTest === 'testing' || !diagnostics.hasGetUserMedia}
          style={{
            padding: '8px 16px',
            backgroundColor: microphoneTest === 'success' ? '#28a745' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {microphoneTest === 'testing' ? 'Testing...' : 
           microphoneTest === 'success' ? '✅ Microphone Works!' : 
           'Test Microphone'}
        </button>
        
        {microphoneTest === 'error' && (
          <div style={{ marginTop: '10px', color: '#721c24' }}>
            <strong>Error:</strong> {errorMessage}
          </div>
        )}
      </div>

      <details style={{ marginTop: '15px' }}>
        <summary>Technical Details</summary>
        <pre style={{ fontSize: '10px', overflow: 'auto' }}>
          {JSON.stringify(diagnostics, null, 2)}
        </pre>
      </details>
    </div>
  );
};

export default AudioDiagnosticsComponent; 