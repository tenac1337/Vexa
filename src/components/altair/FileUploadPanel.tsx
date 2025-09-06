import React, { useRef, useState, useEffect } from "react";
import Papa from "papaparse";
import * as pdfjsLib from "pdfjs-dist";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";

// TypeScript declarations for popup functionality
declare global {
  interface Window {
    sendToGemini?: (text: string) => void;
    renderFileUploadPopup?: (popupWindow: Window) => void;
    isFileUploadPopup?: boolean;
    popupReady?: boolean;
  }
}

// Fix PDF.js worker path - use CDN instead of local require
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Popup window styles - designed for standalone window
const popupContainerStyle: React.CSSProperties = {
  width: "100vw",
  height: "100vh",
  background: "linear-gradient(135deg, #ffffff 0%, #f8f9fa 50%, #ffffff 100%)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "40px 32px",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  overflow: "hidden",
  position: "relative",
};

// Glassmorphism card for popup content
const glassCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 400,
  background: "rgba(255, 255, 255, 0.25)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  borderRadius: 24,
  border: "1px solid rgba(255, 140, 66, 0.3)",
  boxShadow: "0 20px 60px rgba(255, 140, 66, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
  padding: "32px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  transform: "perspective(800px) rotateX(2deg)",
  transition: "all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)",
};

const dropZoneStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 180,
  border: "3px dashed #FF8C42",
  borderRadius: 20,
  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(248, 249, 250, 0.9) 100%)",
  color: "#FF8C42",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  fontWeight: 600,
  marginBottom: 28,
  cursor: "pointer",
  transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
  transform: "perspective(600px) rotateX(3deg)",
  boxShadow: "0 8px 25px rgba(255, 140, 66, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
  position: "relative",
  overflow: "hidden",
};

const dropZoneActiveStyle: React.CSSProperties = {
  ...dropZoneStyle,
  background: "linear-gradient(135deg, rgba(255, 245, 240, 0.95) 0%, rgba(255, 235, 223, 0.95) 100%)",
  borderColor: "#FF6B1A",
  transform: "perspective(600px) rotateX(0deg) translateY(-4px) scale(1.02)",
  boxShadow: "0 15px 40px rgba(255, 107, 26, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
  borderWidth: "4px",
};

const closeBtnStyle: React.CSSProperties = {
  position: "absolute",
  top: 20,
  right: 20,
  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(240, 240, 240, 0.8) 100%)",
  border: "2px solid #FF8C42",
  borderRadius: "50%",
  width: 40,
  height: 40,
  fontSize: 20,
  color: "#FF8C42",
  cursor: "pointer",
  boxShadow: "0 6px 20px rgba(255, 140, 66, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
  transform: "perspective(200px) rotateX(5deg)",
  fontWeight: 700,
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "16px 20px",
  borderRadius: 16,
  border: "2px solid rgba(224, 224, 224, 0.6)",
  background: "rgba(255, 255, 255, 0.7)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  fontSize: 16,
  marginBottom: 20,
  outline: "none",
  color: "#333",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
  transition: "all 0.3s ease",
  transform: "perspective(400px) rotateX(2deg)",
  fontFamily: "inherit",
};

const inputFocusStyle: React.CSSProperties = {
  ...inputStyle,
  borderColor: "#FF8C42",
  background: "rgba(255, 255, 255, 0.9)",
  boxShadow: "0 6px 20px rgba(255, 140, 66, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
  transform: "perspective(400px) rotateX(0deg) translateY(-2px)",
};

const sendBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "16px 0",
  borderRadius: 16,
  border: "none",
  background: "linear-gradient(135deg, #FF8C42 0%, #FF6B1A 100%)",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: 16,
  cursor: "pointer",
  marginBottom: 12,
  boxShadow: "0 8px 25px rgba(255, 140, 66, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
  transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
  transform: "perspective(400px) rotateX(3deg)",
  fontFamily: "inherit",
};

const titleStyle: React.CSSProperties = {
  color: "#FF8C42",
  fontWeight: 800,
  fontSize: 28,
  marginBottom: 32,
  letterSpacing: "0.5px",
  textAlign: "center",
  textShadow: "0 2px 8px rgba(255, 140, 66, 0.15)",
  transform: "perspective(300px) rotateX(5deg)",
  background: "linear-gradient(135deg, #FF8C42 0%, #FF6B1A 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

// Updated popup opener function with better window features
export function openFileUploadPopup() {
  const popupWindow = window.open(
    '',
    'fileUploadWindow_' + Date.now(),
    'width=480,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no,left=' + 
    (window.screen.width / 2 - 240) + ',top=' + (window.screen.height / 2 - 360)
  );

  if (popupWindow) {
    // Write the popup HTML content
    popupWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Upload Files & Send Text</title>
          <meta charset="utf-8">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
              background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 50%, #ffffff 100%);
              overflow: hidden;
            }
          </style>
        </head>
        <body>
          <div id="popup-root"></div>
          <script>
            // Create React app instance for popup
            window.isFileUploadPopup = true;
            window.popupReady = true;
          </script>
        </body>
      </html>
    `);
    
    // Signal that we want to render the popup content
    setTimeout(() => {
      if (window.renderFileUploadPopup) {
        window.renderFileUploadPopup(popupWindow);
      }
    }, 100);
  }

  return popupWindow;
}

// Standalone popup component that renders in the popup window
export const FileUploadPopupContent = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    let extractedText = "";
    try {
      if (file.type === "application/pdf") {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item: any) => item.str).join(" ") + "\n";
        }
        extractedText = text;
      } else if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        const text = await file.text();
        const parsed = Papa.parse(text, { header: false });
        extractedText = parsed.data.map((row: any) => row.join(", ")).join("\n");
      } else if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        extractedText = await file.text();
      } else {
        alert("Unsupported file type! Please upload PDF, CSV, or TXT files.");
        return;
      }

      if (extractedText.trim()) {
        // Send to parent window's client
        if (window.opener && window.opener.sendToGemini) {
          window.opener.sendToGemini(extractedText);
          window.close();
        } else {
          alert("Unable to send to main window. Please try again.");
        }
      }
    } catch (error) {
      console.error("Error processing file:", error);
      alert("Error processing file. Please try again.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const handleSendText = () => {
    if (textInput.trim()) {
      // Send to parent window's client
      if (window.opener && window.opener.sendToGemini) {
        window.opener.sendToGemini(textInput.trim());
        setTextInput("");
        window.close();
      } else {
        alert("Unable to send to main window. Please try again.");
      }
    }
  };

  return (
    <div style={popupContainerStyle}>
      <div style={glassCardStyle}>
        <button 
          style={{
            ...closeBtnStyle,
            transform: isDragging ? "perspective(200px) rotateX(0deg) scale(1.1)" : closeBtnStyle.transform,
          }}
          onClick={() => window.close()} 
          title="Close"
        >
          ×
        </button>
        
        <h2 style={titleStyle}>Upload & Send</h2>
        
        <div
          style={isDragging ? dropZoneActiveStyle : dropZoneStyle}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div style={{ fontSize: "52px", marginBottom: "16px", opacity: isDragging ? 1 : 0.7, transition: "all 0.3s ease" }}>
            {isDragging ? "📥" : "📄"}
          </div>
          <div style={{ textAlign: "center", lineHeight: 1.5 }}>
            {isDragging ? (
              <span style={{ color: "#FF6B1A", fontWeight: 700, fontSize: "16px" }}>Drop your file here!</span>
            ) : (
              <>
                <span style={{ fontSize: "16px", fontWeight: 600 }}>Drag & drop files here</span>
                <br />
                <span style={{ fontSize: "13px", opacity: 0.7, fontWeight: 400 }}>or click to browse</span>
              </>
            )}
          </div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.csv,.txt"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        
        <p style={{ 
          color: "#666", 
          fontSize: 12, 
          marginBottom: 24, 
          opacity: 0.8, 
          textAlign: "center",
          lineHeight: 1.4,
        }}>
          Supports PDF, CSV, and TXT files<br />
          Extracted text will be sent to Gemini
        </p>
        
        <input
          type="text"
          placeholder="Or type your message here..."
          style={inputFocused ? inputFocusStyle : inputStyle}
          value={textInput}
          onChange={e => setTextInput(e.target.value)}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          onKeyDown={e => { if (e.key === "Enter") handleSendText(); }}
        />
        
        <button 
          style={{
            ...sendBtnStyle,
            transform: textInput.trim() ? "perspective(400px) rotateX(0deg) translateY(-2px)" : sendBtnStyle.transform,
            boxShadow: textInput.trim() ? 
              "0 12px 30px rgba(255, 140, 66, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)" : 
              sendBtnStyle.boxShadow,
            opacity: textInput.trim() ? 1 : 0.8,
          }}
          onClick={handleSendText}
          disabled={!textInput.trim()}
        >
          Send Message
        </button>
      </div>
    </div>
  );
};

// Original FileUploadPanel component (for backwards compatibility)
const FileUploadPanel = ({ open: openProp = true, onClose }: { open?: boolean; onClose?: () => void }) => {
  // This is now just a wrapper that redirects to popup
  useEffect(() => {
    if (openProp) {
      openFileUploadPopup();
      if (onClose) onClose();
    }
  }, [openProp, onClose]);

  return null; // Don't render anything as sidebar panel anymore
};

export default FileUploadPanel;
