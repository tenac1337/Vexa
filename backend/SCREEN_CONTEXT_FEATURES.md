# Enhanced Screen Context Functionality

## Overview
The screen context system provides comprehensive awareness of the user's current desktop environment, active applications, and screen content to enable better contextual assistance and **automatic integration with system-wide typing**.

## Key Features

### ✅ Cross-Platform Window Detection
- **macOS**: Uses AppleScript to detect active applications and window titles
- **Windows**: Uses PowerShell to identify active processes and windows
- **Linux**: Enhanced support for both X11 and Wayland display servers
  - **X11**: Uses `xdotool` and `xprop` for precise window detection
  - **Wayland**: Supports Sway and Hyprland compositors via `swaymsg` and `hyprctl`

### ✅ OCR Text Extraction
- **Tesseract OCR**: Integrated OCR engine for reading screen text
- **Cross-platform screenshots**: 
  - macOS: `screencapture`
  - Windows: PowerShell with System.Drawing
  - Linux: `gnome-screenshot`, `scrot`, or ImageMagick `import`
- **Automatic capture**: OCR is automatically enabled when using system-wide typing
- **Automatic cleanup**: Temporary screenshot files are automatically removed

### ✅ Persistent Data Storage
- **SQLite database**: All screen context data is stored for future reference
- **Historical analysis**: Track application usage patterns over time
- **Statistics API**: Get insights into screen context capture history
- **Session correlation**: Link screen context with conversation sessions

## Primary Use Case: System-Wide Typing Integration

**The main purpose of screen context is to enhance the `system_wide_typing` tool.** When you use system-wide typing:

1. **Automatic Context Capture**: Screen context (including OCR) is captured automatically
2. **Application-Aware Content**: Content is generated specifically for your current application
3. **Visual Context Integration**: OCR text helps understand what's currently visible
4. **No Manual Setup Required**: Everything happens automatically behind the scenes

### Supported Applications
- **Code Editors** (Cursor, VSCode): Generates code comments, documentation
- **Email Clients** (Gmail, Outlook): Professional email formatting
- **Chat Applications** (Slack, Discord, Teams): Conversational responses
- **Social Media** (Twitter/X): Tweet-optimized content with hashtags
- **Web Browsers**: Form-appropriate content for web interactions

## API Endpoints (For Development/Debugging)

### Get Current Screen Context
```bash
POST /api/screen-context
Content-Type: application/json

{
  "include_ocr": true  // Default: true
}
```

**Note**: This endpoint is primarily for development and debugging. End users should use the `system_wide_typing` tool which automatically captures screen context.

### Get Screen Context History
```bash
GET /api/screen-context/history?limit=50&include_ocr=false
```

### Get Screen Context Statistics
```bash
GET /api/screen-context/stats
```

## Database Schema

### screen_contexts table
- `id`: Primary key
- `timestamp`: Context capture time
- `platform`: Operating system
- `active_application`: Application name/class
- `active_window_title`: Window title
- `display_server`: X11/Wayland indicator
- `process_name`: Process name
- `ocr_text`: Extracted text content
- `ocr_status`: OCR processing result
- `note`: Additional context information
- `created_at`: Storage timestamp

## Installation Requirements

### Linux Dependencies
```bash
# Window detection tools
sudo apt install xdotool wmctrl

# OCR and screenshot tools
sudo apt install tesseract-ocr scrot gnome-screenshot

# Alternative screenshot tools
sudo apt install imagemagick  # for 'import' command
```

### macOS Dependencies
```bash
# OCR tool
brew install tesseract
```

### Windows Dependencies
- PowerShell (built-in)
- Windows.Forms assembly (built-in)

## Usage in System-Wide Typing

The screen context system integrates seamlessly with the `system_wide_typing` function to provide:

1. **Application-aware content**: Generate content appropriate for the current application
2. **Context-sensitive tone**: Adjust writing style based on the active window
3. **Visual context**: Use OCR text to understand what's currently visible
4. **Historical patterns**: Learn from past application usage for better predictions

## Privacy Considerations

- **Automatic OCR**: Text extraction happens automatically during typing for maximum context
- **Local processing**: All OCR happens locally with Tesseract
- **Temporary files**: Screenshots are automatically cleaned up
- **Session-based storage**: Context data is tied to conversation sessions
- **Selective access**: Only captured when actively using typing functionality

## Performance Features

- **Efficient detection**: Fast window detection with fallback methods
- **Optimized OCR**: OCR runs only when needed (during typing requests)
- **Chunked processing**: Large OCR results are handled efficiently
- **Database indexing**: Optimized queries for historical data access

## Developer Notes

While the API endpoints exist for development and debugging purposes, **the primary user interface is through the `system_wide_typing` tool**, which automatically:

- Captures screen context with OCR
- Analyzes the current application
- Generates contextually appropriate content
- Types the content at the cursor position

This makes screen context invisible to the user while providing maximum contextual intelligence. 

The enhanced screen context system transforms Pi from a simple assistant into a contextually-aware companion that understands your digital environment and can provide truly intelligent, situational assistance. 