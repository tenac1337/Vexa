export const styles = {
  blobModal: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: '#fff',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.3s',
  },
  blobContainer: {
    pointerEvents: 'none' as const,
  },
  closeButton: {
    position: 'absolute',
    top: 24,
    right: 32,
    background: 'rgba(0,0,0,0.04)',
    border: 'none',
    borderRadius: '50%',
    width: 40,
    height: 40,
    fontSize: 24,
    color: '#888',
    cursor: 'pointer',
    zIndex: 10000,
  },
  mainContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '30px',
    background: '#fff',
    borderRadius: '20px',
    margin: '15px 0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    transition: 'all 0.5s ease',
    position: 'relative',
    overflow: 'hidden',
  },
  googleServicesContainer: {
    padding: '10px',
    border: '1px solid #eee',
    margin: '10px 0',
    borderRadius: '8px',
    background: '#f9f9f9',
  },
  googleServicesTitle: {
    marginTop: 0,
    color: '#333',
  },
  authButton: {
    padding: '8px 12px',
    marginRight: '10px',
    background: '#64b5f6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  authButtonDisabled: {
    opacity: 0.6,
  },
  authButtonAuthorized: {
    background: '#a5d6a7',
  },
  signoutButton: {
    padding: '8px 12px',
    background: '#ef9a9a',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  signoutButtonDisabled: {
    opacity: 0.6,
  },
  statusMessage: {
    fontStyle: 'italic',
    color: '#555',
    fontSize: '0.9em',
    marginTop: '8px',
  },
  operationStatus: {
    margin: '10px 0',
    padding: '10px 12px',
    background: '#e3f2fd',
    border: '1px solid #bbdefb',
    borderRadius: '6px',
    color: '#1e88e5',
    fontSize: '13px',
  },
  calendarStatus: {
    fontWeight: 'bold',
  },
  calendarStatusError: {
    color: '#d32f2f',
  },
  calendarStatusSuccess: {
    color: '#388e3c',
  },
} as const;

export const animations = `
  @keyframes bgPulse {
    0%, 100% { opacity: 0.05; transform: scale(1); }
    50% { opacity: 0.1; transform: scale(1.03); }
  }
  @keyframes statusDotPulse {
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.2); }
  }
`; 