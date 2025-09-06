const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Floating blob management
  createFloatingBlob: (position) => ipcRenderer.invoke('create-floating-blob', position),
  closeFloatingBlob: () => ipcRenderer.invoke('close-floating-blob'),
  updateBlobPosition: (position) => ipcRenderer.invoke('update-blob-position', position),
  updateBlobState: (state) => ipcRenderer.invoke('update-blob-state', state),
  isFloatingBlobOpen: () => ipcRenderer.invoke('is-floating-blob-open'),
  getScreenBounds: () => ipcRenderer.invoke('get-screen-bounds'),

  // Desktop capturer for screen sharing
  getDesktopSources: (options) => ipcRenderer.invoke('get-desktop-sources', options),

  // Event listeners
  onFloatingBlobClosed: (callback) => {
    ipcRenderer.on('floating-blob-closed', callback);
    return () => ipcRenderer.removeListener('floating-blob-closed', callback);
  },
  onBlobPositionChanged: (callback) => {
    ipcRenderer.on('blob-position-changed', callback);
    return () => ipcRenderer.removeListener('blob-position-changed', callback);
  },

  // Platform detection
  platform: process.platform,
  isElectron: true
});

// Prevent the default context menu in production
window.addEventListener('contextmenu', (e) => {
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
    e.preventDefault();
  }
}); 