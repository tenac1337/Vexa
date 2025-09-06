const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods for the floating blob window
contextBridge.exposeInMainWorld('electronBlobAPI', {
  // Receive state updates from main process
  onBlobStateUpdate: (callback) => {
    ipcRenderer.on('blob-state-update', callback);
    return () => ipcRenderer.removeListener('blob-state-update', callback);
  },

  // Move window position
  moveWindow: (position) => {
    return ipcRenderer.invoke('move-floating-blob-window', position);
  },

  // Platform detection
  platform: process.platform,
  isElectronBlob: true
});

// Prevent the default context menu in production
window.addEventListener('contextmenu', (e) => {
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
    e.preventDefault();
  }
}); 