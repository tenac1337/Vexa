// UnifiedBlobManager.ts - Works in both browser and Electron environments
import { crossTabBlobManager, type BlobState } from './CrossTabBlobManager';
import { electronBlobManager, type ElectronBlobState } from './ElectronBlobManager';

export interface UnifiedBlobState {
  isVisible: boolean;
  position: { x: number; y: number };
  isListening: boolean;
  isSpeaking: boolean;
  volume: number;
  userVolume?: number;
  userIsActive?: boolean;
  timestamp: number;
}

export type BlobEnvironment = 'browser' | 'electron' | 'unknown';

export class UnifiedBlobManager {
  private environment: BlobEnvironment;
  private listeners: Map<string, (state: UnifiedBlobState) => void> = new Map();

  constructor() {
    this.environment = this.detectEnvironment();
    this.setupEnvironmentListeners();
  }

  private detectEnvironment(): BlobEnvironment {
    if (typeof window !== 'undefined') {
      if (window.electronAPI?.isElectron) {
        return 'electron';
      }
      if (typeof BroadcastChannel !== 'undefined') {
        return 'browser';
      }
    }
    return 'unknown';
  }

  private setupEnvironmentListeners() {
    const handleStateUpdate = (state: BlobState | ElectronBlobState) => {
      const unifiedState: UnifiedBlobState = {
        isVisible: state.isVisible,
        position: state.position,
        isListening: state.isListening,
        isSpeaking: state.isSpeaking,
        volume: state.volume,
        userVolume: (state as any).userVolume,
        userIsActive: (state as any).userIsActive,
        timestamp: state.timestamp
      };
      this.notifyListeners(unifiedState);
    };

    switch (this.environment) {
      case 'browser':
        crossTabBlobManager.subscribe('unified-manager', handleStateUpdate);
        break;
      case 'electron':
        electronBlobManager.subscribe('unified-manager', handleStateUpdate);
        break;
    }
  }

  public async createFloatingBlob(position?: { x: number; y: number }): Promise<boolean> {
    switch (this.environment) {
      case 'electron':
        return await electronBlobManager.createSystemFloatingBlob(position);
      case 'browser':
        crossTabBlobManager.updateBlobState({
          isVisible: true,
          position: position || { x: window.innerWidth - 200, y: 100 }
        });
        return true;
      default:
        console.warn('Floating blob not supported in this environment');
        return false;
    }
  }

  public async closeFloatingBlob(): Promise<boolean> {
    switch (this.environment) {
      case 'electron':
        return await electronBlobManager.closeSystemFloatingBlob();
      case 'browser':
        crossTabBlobManager.updateBlobState({ isVisible: false });
        return true;
      default:
        return false;
    }
  }

  public async updateBlobPosition(position: { x: number; y: number }): Promise<boolean> {
    switch (this.environment) {
      case 'electron':
        return await electronBlobManager.updateSystemBlobPosition(position);
      case 'browser':
        crossTabBlobManager.updateBlobState({ position });
        return true;
      default:
        return false;
    }
  }

  public updateBlobState(state: Partial<UnifiedBlobState>) {
    switch (this.environment) {
      case 'electron':
        electronBlobManager.updateBlobState(state);
        break;
      case 'browser':
        crossTabBlobManager.updateBlobState(state);
        break;
    }
  }

  public getCurrentState(): UnifiedBlobState {
    switch (this.environment) {
      case 'electron':
        return electronBlobManager.getCurrentState();
      case 'browser':
        return crossTabBlobManager.getCurrentState();
      default:
        return this.getDefaultState();
    }
  }

  private getDefaultState(): UnifiedBlobState {
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

  public async getCapabilities() {
    const baseCapabilities = {
      environment: this.environment,
      crossTabSync: this.environment === 'browser',
      systemWideFloating: this.environment === 'electron',
      browserFloating: this.environment !== 'unknown'
    };

    if (this.environment === 'electron') {
      const electronCaps = await electronBlobManager.getCapabilities();
      return { ...baseCapabilities, ...electronCaps };
    }

    return baseCapabilities;
  }

  public subscribe(id: string, listener: (state: UnifiedBlobState) => void) {
    this.listeners.set(id, listener);
    
    // Send current state immediately
    const currentState = this.getCurrentState();
    setTimeout(() => listener(currentState), 0);
  }

  public unsubscribe(id: string) {
    this.listeners.delete(id);
  }

  private notifyListeners(state: UnifiedBlobState) {
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.warn('Error in unified blob state listener:', error);
      }
    });
  }

  public getEnvironment(): BlobEnvironment {
    return this.environment;
  }

  public isSystemWideCapable(): boolean {
    return this.environment === 'electron';
  }

  public isCrossTabCapable(): boolean {
    return this.environment === 'browser';
  }

  public cleanup() {
    switch (this.environment) {
      case 'electron':
        electronBlobManager.cleanup();
        break;
      case 'browser':
        crossTabBlobManager.cleanup();
        break;
    }
    this.listeners.clear();
  }
}

// Singleton instance
export const unifiedBlobManager = new UnifiedBlobManager(); 