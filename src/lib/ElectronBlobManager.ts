// ElectronBlobManager.ts - System-wide floating blob for Electron
export interface ElectronBlobState {
  isVisible: boolean;
  position: { x: number; y: number };
  isListening: boolean;
  isSpeaking: boolean;
  volume: number;
  userVolume?: number;
  userIsActive?: boolean;
  timestamp: number;
}

declare global {
  interface Window {
    electronAPI?: {
      createFloatingBlob: (position?: { x: number; y: number }) => Promise<{ success: boolean; window?: boolean; error?: string }>;
      closeFloatingBlob: () => Promise<{ success: boolean; error?: string }>;
      updateBlobPosition: (position: { x: number; y: number }) => Promise<{ success: boolean; error?: string }>;
      updateBlobState: (state: ElectronBlobState) => Promise<{ success: boolean; error?: string }>;
      isFloatingBlobOpen: () => Promise<{ success: boolean; isOpen?: boolean; error?: string }>;
      getScreenBounds: () => Promise<{ success: boolean; width?: number; height?: number; error?: string }>;
      getDesktopSources: (options?: { types?: string[]; thumbnailSize?: { width: number; height: number } }) => Promise<{ success: boolean; sources?: any[]; error?: string }>;
      onFloatingBlobClosed: (callback: () => void) => () => void;
      onBlobPositionChanged: (callback: (event: any, position: { x: number; y: number }) => void) => () => void;
      platform: string;
      isElectron: boolean;
    };
  }
}

export class ElectronBlobManager {
  private listeners: Map<string, (state: ElectronBlobState) => void> = new Map();
  private currentState: ElectronBlobState;
  private cleanupFunctions: (() => void)[] = [];

  constructor() {
    this.currentState = this.getDefaultState();
    this.setupElectronListeners();
  }

  private getDefaultState(): ElectronBlobState {
    return {
      isVisible: false,
      position: { x: 100, y: 100 },
      isListening: false,
      isSpeaking: false,
      volume: 0,
      userVolume: 0,
      userIsActive: false,
      timestamp: Date.now()
    };
  }

  private setupElectronListeners() {
    if (!this.isElectron()) return;

    // Listen for floating blob closed event
    const cleanupClosed = window.electronAPI!.onFloatingBlobClosed(() => {
      this.updateState({ isVisible: false });
    });

    // Listen for position changes from the floating window
    const cleanupPosition = window.electronAPI!.onBlobPositionChanged((event, position) => {
      this.updateState({ position });
    });

    this.cleanupFunctions.push(cleanupClosed, cleanupPosition);
  }

  public isElectron(): boolean {
    return !!(window.electronAPI?.isElectron);
  }

  public async createSystemFloatingBlob(position?: { x: number; y: number }): Promise<boolean> {
    if (!this.isElectron()) {
      console.warn('System-wide floating blob requires Electron');
      return false;
    }

    try {
      // Get screen bounds for position validation
      const screenBoundsResponse = await window.electronAPI!.getScreenBounds();
      
      if (!screenBoundsResponse.success) {
        console.error('Failed to get screen bounds:', screenBoundsResponse.error);
        return false;
      }

      const screenBounds = { 
        width: screenBoundsResponse.width || 1920, 
        height: screenBoundsResponse.height || 1080
      };
      
      const safePosition = position ? {
        x: Math.max(0, Math.min(position.x, screenBounds.width - 160)),
        y: Math.max(0, Math.min(position.y, screenBounds.height - 160))
      } : this.currentState.position;

      const result = await window.electronAPI!.createFloatingBlob(safePosition);
      
      if (!result.success) {
        console.error('Failed to create floating blob:', result.error);
        return false;
      }

      this.updateState({ 
        isVisible: true, 
        position: safePosition 
      });
      
      return true;
    } catch (error) {
      console.error('Failed to create system floating blob:', error);
      return false;
    }
  }

  public async closeSystemFloatingBlob(): Promise<boolean> {
    if (!this.isElectron()) {
      return false;
    }

    try {
      const result = await window.electronAPI!.closeFloatingBlob();
      
      if (!result.success) {
        console.error('Failed to close floating blob:', result.error);
        return false;
      }

      this.updateState({ isVisible: false });
      return true;
    } catch (error) {
      console.error('Failed to close system floating blob:', error);
      return false;
    }
  }

  public async updateSystemBlobPosition(position: { x: number; y: number }): Promise<boolean> {
    if (!this.isElectron()) {
      return false;
    }

    try {
      const result = await window.electronAPI!.updateBlobPosition(position);
      
      if (!result.success) {
        console.error('Failed to update blob position:', result.error);
        return false;
      }

      this.updateState({ position });
      return true;
    } catch (error) {
      console.error('Failed to update system blob position:', error);
      return false;
    }
  }

  public async isSystemBlobOpen(): Promise<boolean> {
    if (!this.isElectron()) {
      return false;
    }

    try {
      const result = await window.electronAPI!.isFloatingBlobOpen();
      return result.success && result.isOpen === true;
    } catch (error) {
      console.error('Failed to check system blob status:', error);
      return false;
    }
  }

  public updateBlobState(state: Partial<ElectronBlobState>) {
    const newState = {
      ...this.currentState,
      ...state,
      timestamp: Date.now()
    };

    this.updateState(newState);

    // Update the system floating blob if it exists
    if (this.isElectron() && newState.isVisible) {
      window.electronAPI!.updateBlobState(newState).catch(error => {
        console.error('Failed to update system blob state:', error);
      });
    }
  }

  private updateState(newState: Partial<ElectronBlobState>) {
    this.currentState = { ...this.currentState, ...newState };
    this.notifyListeners(this.currentState);
  }

  public getCurrentState(): ElectronBlobState {
    return { ...this.currentState };
  }

  public subscribe(id: string, listener: (state: ElectronBlobState) => void) {
    this.listeners.set(id, listener);
    
    // Send current state immediately
    setTimeout(() => listener(this.currentState), 0);
  }

  public unsubscribe(id: string) {
    this.listeners.delete(id);
  }

  private notifyListeners(state: ElectronBlobState) {
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.warn('Error in blob state listener:', error);
      }
    });
  }

  public async getCapabilities() {
    return {
      isElectron: this.isElectron(),
      systemWideFloating: this.isElectron(),
      crossTabSync: true,
      platform: this.isElectron() ? window.electronAPI!.platform : 'web'
    };
  }

  public cleanup() {
    this.cleanupFunctions.forEach(cleanup => cleanup());
    this.cleanupFunctions = [];
    this.listeners.clear();
  }
}

// Singleton instance
export const electronBlobManager = new ElectronBlobManager(); 