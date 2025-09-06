const { app, BrowserWindow, ipcMain, screen, session } = require('electron');
const path = require('path');

// Aggressive settings for Linux transparency.
// These switches can help force transparency on compositors that don't respect it by default.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-transparent-visuals');
  app.commandLine.appendSwitch('disable-gpu');
  app.disableHardwareAcceleration(); // Redundant but safe
}

// Simple development check instead of electron-is-dev
const isDev = process.env.NODE_ENV === 'development' || process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath);

let mainWindow;
let floatingBlobWindow;

// Configure Content Security Policy with Google OAuth support
function setupCSP() {
  // Development CSP (very permissive for development)
  const devCSP = [
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http: https:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: http: https:",
    "style-src 'self' 'unsafe-inline' data: https://fonts.googleapis.com",
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' blob: data: http: https:",
    "connect-src 'self' ws: wss: https: http: blob:",
    "font-src 'self' data: http: https: https://fonts.gstatic.com",
    "worker-src 'self' blob: http: https:",
    "frame-src 'self' https: http:",
    "child-src 'self' https: http:"
  ].join('; ');

  // Production CSP with enhanced Google OAuth and API support
  const prodCSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com https://www.gstatic.com https://ssl.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
    "img-src 'self' data: blob: https: https://www.google.com https://accounts.google.com https://ssl.gstatic.com",
    "media-src 'self' blob: data:",
    "connect-src 'self' https://apis.google.com https://accounts.google.com https://www.googleapis.com https://oauth2.googleapis.com https://oauth.googleusercontent.com wss: ws:",
    "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
    "worker-src 'self' blob:",
    "frame-src 'self' https://accounts.google.com https://content.googleapis.com https://oauth.googleusercontent.com https://www.google.com",
    "child-src 'self' https://accounts.google.com https://oauth.googleusercontent.com"
  ].join('; ');

  const csp = isDev ? devCSP : prodCSP;

  // Apply CSP headers with Cross-Origin policies optimized for OAuth
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
        // Optimized Cross-Origin policies for OAuth popups
        'Cross-Origin-Opener-Policy': ['unsafe-none'], // Changed from same-origin-allow-popups for better OAuth compatibility
        'Cross-Origin-Embedder-Policy': ['unsafe-none'],
        'Cross-Origin-Resource-Policy': ['cross-origin']
      }
    });
  });
}

// Handle OAuth popup windows
function setupOAuthHandling() {
  // Allow new window creation for OAuth
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // Allow popup permissions for Google OAuth and media access
    if (permission === 'openExternal' || 
        permission === 'popups' || 
        permission === 'media' || 
        permission === 'microphone' || 
        permission === 'camera') {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Handle new window creation for OAuth popups using modern API
  app.on('web-contents-created', (event, contents) => {
    // Use the modern setWindowOpenHandler instead of deprecated new-window
    contents.setWindowOpenHandler(({ url, frameName, disposition }) => {
      console.log('Window open requested for:', url);
      
      // Allow Google OAuth domains to open in popup
      if (url.startsWith('https://accounts.google.com/') || 
          url.startsWith('https://apis.google.com/') ||
          url.startsWith('https://www.googleapis.com/') ||
          url.startsWith('https://oauth.googleusercontent.com/') ||
          url.includes('postmessage') ||
          url.includes('oauth')) {
        
        console.log('Allowing OAuth popup for:', url);
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 500,
            height: 650,
            center: true,
            modal: true,
            parent: mainWindow,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
              sandbox: false, // Allow OAuth functionality
              webSecurity: true,
              allowRunningInsecureContent: false,
              experimentalFeatures: false,
              enableRemoteModule: false
            }
          }
        };
      }
      
      // Block other external URLs
      console.log('Blocking external URL:', url);
      return { action: 'deny' };
    });

    // Handle OAuth redirect responses
    contents.on('will-redirect', (event, navigationUrl) => {
      console.log('Redirect requested to:', navigationUrl);
      // Allow Google OAuth redirects and postmessage responses
      if (navigationUrl.startsWith('https://accounts.google.com/') ||
          navigationUrl.startsWith('https://apis.google.com/') ||
          navigationUrl.startsWith('https://www.googleapis.com/') ||
          navigationUrl.includes('postmessage') ||
          navigationUrl.includes('oauth')) {
        console.log('Allowing OAuth redirect to:', navigationUrl);
        return;
      }
    });

    // Handle navigation events
    contents.on('will-navigate', (event, navigationUrl) => {
      console.log('Navigation requested to:', navigationUrl);
      // Allow navigation within Google OAuth domains
      if (navigationUrl.startsWith('https://accounts.google.com/') ||
          navigationUrl.startsWith('https://apis.google.com/') ||
          navigationUrl.startsWith('https://www.googleapis.com/') ||
          navigationUrl.includes('postmessage') ||
          navigationUrl.includes('oauth')) {
        console.log('Allowing OAuth navigation to:', navigationUrl);
        return;
      }
    });
  });
}

// Keep a global reference of the window objects
function createMainWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      // Enhanced security settings with OAuth support
      webSecurity: true, // Keep enabled but allow OAuth via CSP and window handling
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      sandbox: false // Disable sandbox to allow OAuth popups
    },
    icon: path.join(__dirname, 'favicon.ico'), // Add app icon
    title: 'Vexa AI Assistant'
  });

  // Load the app
  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (floatingBlobWindow) {
      floatingBlobWindow.close();
    }
  });
}

function createFloatingBlobWindow(x = 100, y = 100) {
  if (floatingBlobWindow) {
    floatingBlobWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  floatingBlobWindow = new BrowserWindow({
    width: 160,
    height: 160,
    x: Math.min(x, screenWidth - 160),
    y: Math.min(y, screenHeight - 160),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    thickFrame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'blob-preload.js'),
      // More permissive settings for floating window
      webSecurity: false, // Disable web security for floating blob
      allowRunningInsecureContent: true, // Allow insecure content
      experimentalFeatures: true, // Enable experimental features for transparency
      devTools: isDev, // Enable DevTools only in development
      sandbox: false // Disable sandbox for better functionality
    },
    show: false // Start hidden, will show when ready
  });

  // Load floating blob page
  const blobUrl = isDev 
    ? 'http://localhost:3000/floating-blob' 
    : `file://${path.join(__dirname, '../build/floating-blob.html')}`;
  
  floatingBlobWindow.loadURL(blobUrl);

  // Make window click-through for the transparent areas
  floatingBlobWindow.setIgnoreMouseEvents(false);

  // Handle window events
  floatingBlobWindow.on('closed', () => {
    floatingBlobWindow = null;
    // Notify main window that floating blob was closed
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('floating-blob-closed');
    }
  });

  // Show window when ready
  floatingBlobWindow.once('ready-to-show', () => {
    // A small delay can help with transparency on some Linux compositors
    setTimeout(() => {
      if (floatingBlobWindow && !floatingBlobWindow.isDestroyed()) {
        floatingBlobWindow.show();
      }
    }, 100);
  });

  // Handle dragging
  let isDragging = false;
  floatingBlobWindow.on('will-move', (event, bounds) => {
    isDragging = true;
  });

  floatingBlobWindow.on('moved', () => {
    if (isDragging) {
      const [x, y] = floatingBlobWindow.getPosition();
      // Notify main window of position change
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('blob-position-changed', { x, y });
      }
    }
    isDragging = false;
  });

  return floatingBlobWindow;
}

// IPC Communication handlers
ipcMain.handle('create-floating-blob', async (event, position) => {
  try {
    const pos = position ? { x: position.x || 100, y: position.y || 100 } : { x: 100, y: 100 };
    const window = createFloatingBlobWindow(pos.x, pos.y);
    return { success: true, window: !!window };
  } catch (error) {
    console.error('Error creating floating blob:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('close-floating-blob', async () => {
  try {
    if (floatingBlobWindow && !floatingBlobWindow.isDestroyed()) {
      floatingBlobWindow.close();
    }
    return { success: true };
  } catch (error) {
    console.error('Error closing floating blob:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-blob-position', async (event, position) => {
  try {
    if (floatingBlobWindow && !floatingBlobWindow.isDestroyed()) {
      const pos = { x: position.x || 100, y: position.y || 100 };
      floatingBlobWindow.setPosition(pos.x, pos.y);
    }
    return { success: true };
  } catch (error) {
    console.error('Error updating blob position:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-blob-state', async (event, state) => {
  try {
    if (floatingBlobWindow && !floatingBlobWindow.isDestroyed()) {
      // Create a clean state object without any potential circular references
      const cleanState = {
        isVisible: !!state.isVisible,
        position: { x: state.position?.x || 100, y: state.position?.y || 100 },
        isListening: !!state.isListening,
        isSpeaking: !!state.isSpeaking,
        volume: Number(state.volume) || 0,
        userVolume: Number(state.userVolume) || 0,
        userIsActive: !!state.userIsActive,
        timestamp: Date.now()
      };
      floatingBlobWindow.webContents.send('blob-state-update', cleanState);
    }
    return { success: true };
  } catch (error) {
    console.error('Error updating blob state:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-screen-bounds', async () => {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    return { 
      success: true, 
      width: primaryDisplay.workAreaSize.width, 
      height: primaryDisplay.workAreaSize.height 
    };
  } catch (error) {
    console.error('Error getting screen bounds:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('is-floating-blob-open', async () => {
  try {
    const isOpen = floatingBlobWindow && !floatingBlobWindow.isDestroyed();
    return { success: true, isOpen: !!isOpen };
  } catch (error) {
    console.error('Error checking floating blob status:', error);
    return { success: false, error: error.message };
  }
});

// Move floating blob window (called from the floating window itself)
ipcMain.handle('move-floating-blob-window', async (event, position) => {
  try {
    if (floatingBlobWindow && !floatingBlobWindow.isDestroyed()) {
      const displays = screen.getAllDisplays();
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
      
      // Constrain position to screen bounds
      const constrainedX = Math.max(0, Math.min(position.x, screenWidth - 160));
      const constrainedY = Math.max(0, Math.min(position.y, screenHeight - 160));
      
      floatingBlobWindow.setPosition(constrainedX, constrainedY);
      
      // Notify main window of position change
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('blob-position-changed', { x: constrainedX, y: constrainedY });
      }
    }
    return { success: true };
  } catch (error) {
    console.error('Error moving floating blob window:', error);
    return { success: false, error: error.message };
  }
});

// Handle desktop capturer for screen sharing
ipcMain.handle('get-desktop-sources', async (event, options) => {
  try {
    const { desktopCapturer } = require('electron');
    const sources = await desktopCapturer.getSources({
      types: options?.types || ['screen', 'window'],
      thumbnailSize: options?.thumbnailSize || { width: 150, height: 150 }
    });
    return { success: true, sources: sources };
  } catch (error) {
    console.error('Error getting desktop sources:', error);
    return { success: false, error: error.message, sources: [] };
  }
});

// App event handlers
app.on('ready', () => {
  // Set up Content Security Policy first
  setupCSP();
  
  // Set up OAuth handling
  setupOAuthHandling();
  
  createMainWindow();
  
  // Set up desktop capture functionality
  const { session, desktopCapturer } = require('electron');

  // Updated display media request handler for current Electron version
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    // Get available desktop sources
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      // Return the first available screen source
      if (sources.length > 0) {
        const screenSource = sources.find(source => source.id.startsWith('screen:')) || sources[0];
        callback({ video: screenSource, audio: 'loopback' });
      } else {
        callback({});
      }
    }).catch((error) => {
      console.error('Error getting desktop sources:', error);
      callback({});
    });
  });
  
  // Enhanced security: Allow Google OAuth URLs and improve logging
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    
    // Always allow localhost, file://, and dev tools
    if (url.startsWith('http://localhost:') || 
        url.startsWith('https://localhost:') || 
        url.startsWith('file://') ||
        url.startsWith('devtools://') ||
        url.startsWith('chrome-extension://') ||
        url.includes('/floating-blob')) {
      callback({});
      return;
    }
    
    // Allow all Google OAuth, API, and service URLs
    if (url.startsWith('https://accounts.google.com/') ||
        url.startsWith('https://apis.google.com/') ||
        url.startsWith('https://www.googleapis.com/') ||
        url.startsWith('https://oauth2.googleapis.com/') ||
        url.startsWith('https://oauth.googleusercontent.com/') ||
        url.startsWith('https://www.gstatic.com/') ||
        url.startsWith('https://ssl.gstatic.com/') ||
        url.startsWith('https://fonts.googleapis.com/') ||
        url.startsWith('https://fonts.gstatic.com/') ||
        url.includes('google') && (url.includes('oauth') || url.includes('auth'))) {
      console.log('✅ Allowing Google/OAuth request to:', url);
      callback({});
      return;
    }
    
    if (isDev) {
      // In development, be more permissive but log
      console.log('🔄 Allowing dev request to:', url);
      callback({});
    } else {
      // In production, block other external URLs but log them
      console.log('❌ Blocking external request to:', url);
      callback({ cancel: true });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

// Enable live reload for Electron in development
if (isDev) {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    });
  } catch (error) {
    console.log('Electron-reload not available:', error.message);
  }
} 