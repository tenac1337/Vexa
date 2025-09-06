/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import "./react-select.scss";
import cn from "classnames";
import { useEffect, useRef, useState } from "react";
import { RiSidebarFoldLine, RiSidebarUnfoldLine } from "react-icons/ri";
import Select from "react-select";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { useLoggerStore } from "../../lib/store-logger";
import Logger, { LoggerFilterType } from "../logger/Logger";
import "./side-panel.scss";
import { openFileUploadPopup } from "../altair/FileUploadPanel";

const filterOptions = [
  { value: "conversations", label: "Conversations" },
  { value: "tools", label: "Tool Use" },
  { value: "none", label: "All" },
];

const uploadButtonStyle: React.CSSProperties = {
  width: "calc(100% - 8px)",
  margin: "12px 4px",
  padding: "16px 20px",
  borderRadius: "20px",
  border: "2px solid rgba(255,140,66,0.3)",
  background: "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,249,250,0.95) 100%)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  color: "#FF8C42",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  boxShadow: "0 8px 25px rgba(255,140,66,0.15), inset 0 1px 0 rgba(255,255,255,0.6)",
  transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  position: "relative" as const,
  overflow: "hidden" as const,
  transform: "perspective(400px) rotateX(2deg)",
};

const uploadButtonHoverStyle: React.CSSProperties = {
  ...uploadButtonStyle,
  background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,245,240,0.98) 100%)",
  transform: "perspective(400px) rotateX(0deg) translateY(-2px)",
  boxShadow: "0 12px 35px rgba(255,140,66,0.25), inset 0 1px 0 rgba(255,255,255,0.8)",
  borderColor: "rgba(255,107,26,0.5)",
  color: "#FF6B1A",
};

export default function SidePanel() {
  const { connected, client } = useLiveAPIContext();
  const [open, setOpen] = useState(true);
  const [isUploadHovered, setIsUploadHovered] = useState(false);
  const loggerRef = useRef<HTMLDivElement>(null);
  const loggerLastHeightRef = useRef<number>(-1);
  const { log, logs } = useLoggerStore();

  const [textInput, setTextInput] = useState("");
  const [selectedOption, setSelectedOption] = useState<{
    value: string;
    label: string;
  } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  //scroll the log to the bottom when new logs come in
  useEffect(() => {
    if (loggerRef.current) {
      const el = loggerRef.current;
      const scrollHeight = el.scrollHeight;
      if (scrollHeight !== loggerLastHeightRef.current) {
        el.scrollTop = scrollHeight;
        loggerLastHeightRef.current = scrollHeight;
      }
    }
  }, [logs]);

  // listen for log events and store them
  useEffect(() => {
    client.on("log", log);
    return () => {
      client.off("log", log);
    };
  }, [client, log]);

  const handleSubmit = () => {
    client.send([{ text: textInput }]);

    setTextInput("");
    if (inputRef.current) {
      inputRef.current.innerText = "";
    }
  };

  return (
    <div className={`side-panel ${open ? "open" : ""}`}>
      <header className="top">
        <h2>Console</h2>
        {open ? (
          <button className="opener" onClick={() => setOpen(false)}>
            {RiSidebarFoldLine({ color: "#b4b8bb" })}
          </button>
        ) : (
          <button className="opener" onClick={() => setOpen(true)}>
            {RiSidebarUnfoldLine({ color: "#b4b8bb" })}
          </button>
        )}
      </header>
      <section className="indicators">
        <Select
          className="react-select"
          classNamePrefix="react-select"
          styles={{
            control: (baseStyles) => ({
              ...baseStyles,
              background: "var(--Neutral-15)",
              color: "var(--Neutral-90)",
              minHeight: "33px",
              maxHeight: "33px",
              border: 0,
            }),
            option: (styles, { isFocused, isSelected }) => ({
              ...styles,
              backgroundColor: isFocused
                ? "var(--Neutral-30)"
                : isSelected
                  ? "var(--Neutral-20)"
                  : undefined,
            }),
          }}
          defaultValue={selectedOption}
          options={filterOptions}
          onChange={(e) => {
            setSelectedOption(e);
          }}
        />
        <div className={cn("streaming-indicator", { connected })}>
          {connected
            ? `🔵${open ? " Streaming" : ""}`
            : `⏸️${open ? " Paused" : ""}`}
        </div>
      </section>
      <div className="side-panel-container" ref={loggerRef}>
        <Logger
          filter={(selectedOption?.value as LoggerFilterType) || "none"}
        />
      </div>
      
      <button
        style={isUploadHovered ? uploadButtonHoverStyle : uploadButtonStyle}
        onClick={openFileUploadPopup}
        onMouseEnter={() => setIsUploadHovered(true)}
        onMouseLeave={() => setIsUploadHovered(false)}
        title="Open file upload popup window"
      >
        <span style={{ fontSize: "18px", transform: "perspective(100px) rotateY(10deg)" }}>📎</span>
        <span>Upload Files & Send Text</span>
        <span style={{ fontSize: "16px", opacity: 0.8, transform: "perspective(100px) rotateY(-10deg)" }}>🚀</span>
      </button>

      <div className={cn("input-container", { disabled: !connected })}>
        <div className="input-content">
          <textarea
            className="input-area"
            ref={inputRef}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit();
              }
            }}
            onChange={(e) => setTextInput(e.target.value)}
            value={textInput}
          ></textarea>
          <span
            className={cn("input-content-placeholder", {
              hidden: textInput.length,
            })}
          >
            Type&nbsp;something...
          </span>

          <button
            className="send-button material-symbols-outlined filled"
            onClick={handleSubmit}
          >
            send
          </button>
        </div>
      </div>
    </div>
  );
}
