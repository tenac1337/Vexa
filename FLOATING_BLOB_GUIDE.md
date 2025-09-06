# 🎭 Pi AI Floating Blob Guide

Your Pi AI assistant now has **two amazing floating modes**:

## 🌐 **Browser Mode: Cross-Tab Floating**
*Blob syncs across all browser tabs*

### Features:
- ✅ **Cross-Tab Sync**: Blob appears and syncs across all tabs
- ✅ **Real-time Position Sync**: Move in one tab, updates everywhere
- ✅ **State Sharing**: Voice state, volume, and activity sync
- ✅ **Multi-Tab Awareness**: Shows sync indicators
- ✅ **BroadcastChannel API**: Fast, efficient communication

### How to Use:
1. **Start the app**: `npm start`
2. **Open multiple tabs** of your app
3. **Start a session** in any tab
4. **Watch the blob appear** and sync across all tabs!
5. **Drag the blob** in one tab - see it move in others

---

## 🖥️ **Desktop Mode: System-Wide Floating**
*True system-wide floating blob using Electron*

### Features:
- ✅ **System-Wide Floating**: Blob floats across ALL applications
- ✅ **Always On Top**: Stays visible over any app
- ✅ **Transparent Background**: Clean, polished appearance
- ✅ **Native Performance**: Smooth, responsive dragging
- ✅ **Multi-Monitor Support**: Works across multiple screens

### Setup Instructions:

#### 1. Install Dependencies (Already Done)
```bash
npm install electron electron-builder concurrently wait-on electron-is-dev electron-reload --save-dev
```

#### 2. Run in Development Mode
```bash
# Start Electron app with live reload
npm run electron-dev
```

#### 3. Build for Production
```bash
# Build the desktop app
npm run electron-pack

# Or create distributable packages
npm run dist
```

---

## 🎮 **Usage Guide**

### **Starting the Blob**
1. **Browser**: Blob auto-appears when you connect
2. **Desktop**: Use "Create System Blob" button or auto-start

### **Dragging & Positioning**
- **Click and drag** the blob to move it
- **Double-click** to center the blob
- **Position syncs** across tabs/instances

### **Controls**
- **Close button** (×): Hide the floating blob
- **Show button**: Bring back the blob if hidden
- **Auto-positioning**: Smart boundary detection

---

## 🔧 **Technical Details**

### **Browser Implementation**
- Uses `BroadcastChannel` for cross-tab communication
- Falls back to `localStorage` events
- Real-time state synchronization
- Tab identification system

### **Desktop Implementation**
- Electron main process manages floating window
- IPC communication between windows
- Native system integration
- Hardware acceleration

### **Unified API**
- Automatic environment detection
- Consistent interface across platforms
- Capability reporting
- Graceful fallbacks

---

## 🚀 **Advanced Features**

### **Environment Detection**
The system automatically detects whether you're running in:
- **Browser with cross-tab support**
- **Electron with system-wide capabilities**
- **Limited environment** (fallback mode)

### **State Management**
```typescript
// Example: Update blob state
unifiedBlobManager.updateBlobState({
  isVisible: true,
  position: { x: 100, y: 100 },
  isListening: true,
  volume: 0.8
});
```

### **Event Handling**
```typescript
// Subscribe to state changes
unifiedBlobManager.subscribe('my-listener', (state) => {
  console.log('Blob state changed:', state);
});
```

---

## 🎯 **Quick Start Commands**

### **For Development**
```bash
# Browser mode
npm start

# Desktop mode  
npm run electron-dev
```

### **For Production**
```bash
# Build web app
npm run build

# Build desktop app
npm run electron-pack
```

---

## 🔍 **Troubleshooting**

### **Cross-Tab Not Working?**
- Check if `BroadcastChannel` is supported
- Ensure same origin (localhost)
- Try refreshing tabs

### **Electron Not Starting?**
- Run `npm run electron-dev` instead of `npm run electron`
- Check that React dev server starts first
- Verify all dependencies installed

### **Blob Not Appearing?**
- Check browser console for errors
- Verify API key is set
- Ensure session is connected

---

## 🎨 **Customization**

### **Blob Appearance**
- Modify `BlobAI.tsx` for visual changes
- Update positioning logic in managers
- Customize animations and effects

### **Window Behavior**
- Edit `electron.js` for window properties
- Adjust transparency and always-on-top
- Modify multi-monitor behavior

---

## 📱 **Platform Support**

| Platform | Browser Mode | Desktop Mode |
|----------|-------------|-------------|
| Windows  | ✅          | ✅          |
| macOS    | ✅          | ✅          |
| Linux    | ✅          | ✅          |
| Mobile   | ✅          | ❌          |

---

## 🎉 **What's Next?**

### **Planned Features**
- [ ] Mobile floating blob (PWA)
- [ ] Voice activation for blob
- [ ] Custom blob themes
- [ ] Multi-blob support
- [ ] Screen edge snapping

### **Contribute**
Want to improve the floating blob? Submit PRs for:
- Performance optimizations
- New visual effects
- Platform-specific features
- Bug fixes

---

*🎭 Your Pi AI assistant is now truly omnipresent! Whether floating across browser tabs or your entire desktop, Pi is always ready to help.* 