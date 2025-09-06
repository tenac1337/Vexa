// CrossTabBlobManager.ts
export interface BlobState {
  isVisible: boolean;
  position: { x: number; y: number };
  isListening: boolean;
  isSpeaking: boolean;
  volume: number;
  lastActiveTab: string;
  timestamp: number;
}

export class CrossTabBlobManager {
  private channel: BroadcastChannel;
  private tabId: string;
  private storageKey = 'pi-blob-state';
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private listeners: Map<string, (state: BlobState) => void> = new Map();

  constructor() {
    this.tabId = this.generateTabId();
    this.channel = new BroadcastChannel('pi-blob-sync');
    this.setupEventListeners();
    this.startHeartbeat();
  }

  private generateTabId(): string {
    return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupEventListeners() {
    // Listen for messages from other tabs
    this.channel.addEventListener('message', (event) => {
      const { type, data } = event.data;
      
      switch (type) {
        case 'BLOB_STATE_UPDATE':
          this.handleStateUpdate(data);
          break;
        case 'REQUEST_ACTIVE_TAB':
          this.respondToActiveTabRequest();
          break;
        case 'HEARTBEAT':
          this.handleHeartbeat(data);
          break;
      }
    });

    // Listen for storage changes (fallback)
    window.addEventListener('storage', (event) => {
      if (event.key === this.storageKey && event.newValue) {
        const state = JSON.parse(event.newValue);
        this.notifyListeners(state);
      }
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 2000);
  }

  private sendHeartbeat() {
    this.channel.postMessage({
      type: 'HEARTBEAT',
      data: { tabId: this.tabId, timestamp: Date.now() }
    });
  }

  private handleHeartbeat(data: { tabId: string; timestamp: number }) {
    // Could be used to track active tabs
  }

  private handleStateUpdate(state: BlobState) {
    // Only update if this isn't from our own tab
    if (state.lastActiveTab !== this.tabId) {
      this.notifyListeners(state);
      this.saveToStorage(state);
    }
  }

  private respondToActiveTabRequest() {
    const currentState = this.getStoredState();
    if (currentState && currentState.lastActiveTab === this.tabId) {
      this.channel.postMessage({
        type: 'ACTIVE_TAB_RESPONSE',
        data: currentState
      });
    }
  }

  public updateBlobState(partialState: Partial<BlobState>) {
    const currentState = this.getStoredState() || this.getDefaultState();
    const newState: BlobState = {
      ...currentState,
      ...partialState,
      lastActiveTab: this.tabId,
      timestamp: Date.now()
    };

    this.saveToStorage(newState);
    this.broadcastState(newState);
    this.notifyListeners(newState);
  }

  private getDefaultState(): BlobState {
    return {
      isVisible: false,
      position: { x: window.innerWidth - 200, y: 100 },
      isListening: false,
      isSpeaking: false,
      volume: 0,
      lastActiveTab: this.tabId,
      timestamp: Date.now()
    };
  }

  private saveToStorage(state: BlobState) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save blob state to localStorage:', error);
    }
  }

  private getStoredState(): BlobState | null {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn('Failed to parse stored blob state:', error);
      return null;
    }
  }

  private broadcastState(state: BlobState) {
    this.channel.postMessage({
      type: 'BLOB_STATE_UPDATE',
      data: state
    });
  }

  private notifyListeners(state: BlobState) {
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.warn('Error in blob state listener:', error);
      }
    });
  }

  public subscribe(id: string, listener: (state: BlobState) => void) {
    this.listeners.set(id, listener);
    
    // Send current state immediately
    const currentState = this.getStoredState();
    if (currentState) {
      setTimeout(() => listener(currentState), 0);
    }
  }

  public unsubscribe(id: string) {
    this.listeners.delete(id);
  }

  public getCurrentState(): BlobState {
    return this.getStoredState() || this.getDefaultState();
  }

  public requestActiveTab() {
    this.channel.postMessage({
      type: 'REQUEST_ACTIVE_TAB',
      data: { requester: this.tabId }
    });
  }

  public cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.channel.close();
    this.listeners.clear();
  }

  public isMainTab(): boolean {
    const state = this.getStoredState();
    return !state || state.lastActiveTab === this.tabId;
  }

  public getTabId(): string {
    return this.tabId;
  }
}

// Singleton instance
export const crossTabBlobManager = new CrossTabBlobManager(); 