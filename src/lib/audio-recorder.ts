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

import { audioContext } from "./utils";
import AudioRecordingWorklet from "./worklets/audio-processing";
import VolMeterWorket from "./worklets/vol-meter";

import { createWorketFromSrc } from "./audioworklet-registry";
import EventEmitter from "eventemitter3";

function arrayBufferToBase64(buffer: ArrayBuffer) {
  var binary = "";
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export class AudioRecorder extends EventEmitter {
  stream: MediaStream | undefined;
  audioContext: AudioContext | undefined;
  source: MediaStreamAudioSourceNode | undefined;
  recording: boolean = false;
  recordingWorklet: AudioWorkletNode | undefined;
  vuWorklet: AudioWorkletNode | undefined;

  private starting: Promise<void> | null = null;

  constructor(public sampleRate = 16000) {
    super();
  }

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Could not request user media");
    }

    this.starting = new Promise(async (resolve, reject) => {
      try {
        // Check if we're in a secure context for better error messaging
        const isSecureContext = window.isSecureContext;
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (!isSecureContext && !isLocalhost) {
          console.warn(
            "Insecure context detected. Microphone access may be blocked. " +
            `Current URL: ${window.location.href}. ` +
            "Try accessing via HTTPS or localhost for microphone functionality."
          );
        }

        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.audioContext = await audioContext({ sampleRate: this.sampleRate });
        this.source = this.audioContext.createMediaStreamSource(this.stream);

        // Check if AudioWorklet is available (requires secure context)
        if (!this.audioContext.audioWorklet) {
          console.warn(
            "AudioWorklet not available - likely due to insecure context. " +
            "Audio recording may not work properly. " +
            "Try accessing via HTTPS or localhost for full functionality."
          );
          // Still resolve to allow basic functionality without worklets
          this.recording = true;
          resolve();
          this.starting = null;
          return;
        }

        const workletName = "audio-recorder-worklet";
        const src = createWorketFromSrc(workletName, AudioRecordingWorklet);

        await this.audioContext.audioWorklet.addModule(src);
        this.recordingWorklet = new AudioWorkletNode(
          this.audioContext,
          workletName,
        );

        this.recordingWorklet.port.onmessage = async (ev: MessageEvent) => {
          // worklet processes recording floats and messages converted buffer
          const arrayBuffer = ev.data.data.int16arrayBuffer;

          if (arrayBuffer) {
            const arrayBufferString = arrayBufferToBase64(arrayBuffer);
            this.emit("data", arrayBufferString);
          }
        };
        this.source.connect(this.recordingWorklet);

        // vu meter worklet
        const vuWorkletName = "vu-meter";
        await this.audioContext.audioWorklet.addModule(
          createWorketFromSrc(vuWorkletName, VolMeterWorket),
        );
        this.vuWorklet = new AudioWorkletNode(this.audioContext, vuWorkletName);
        this.vuWorklet.port.onmessage = (ev: MessageEvent) => {
          this.emit("volume", ev.data.volume);
        };

        this.source.connect(this.vuWorklet);
        this.recording = true;
        resolve();
        this.starting = null;
      } catch (error) {
        console.error("Error starting audio recording:", error);
        
        // Provide specific error messages for common issues
        if (error instanceof DOMException) {
          switch (error.name) {
            case 'NotAllowedError':
              console.error(
                "Microphone access denied. Please: " +
                "1) Click the microphone icon in your browser's address bar and allow access, " +
                "2) Check if you're using HTTPS when accessing from other devices, " +
                "3) Refresh the page and try again."
              );
              break;
            case 'NotFoundError':
              console.error("No microphone found. Please check if a microphone is connected.");
              break;
            case 'NotSupportedError':
              console.error(
                "Microphone not supported in this context. " +
                "Try accessing via HTTPS or localhost."
              );
              break;
            case 'SecurityError':
              console.error(
                "Security error accessing microphone. " +
                "This often happens on non-HTTPS connections. " +
                `Current URL: ${window.location.href}. ` +
                "Try accessing via HTTPS for microphone functionality."
              );
              break;
            default:
              console.error(`Microphone access error (${error.name}): ${error.message}`);
          }
        }
        
        reject(error);
        this.starting = null;
      }
    });
  }

  stop() {
    // its plausible that stop would be called before start completes
    // such as if the websocket immediately hangs up
    const handleStop = () => {
      this.source?.disconnect();
      this.stream?.getTracks().forEach((track) => track.stop());
      this.stream = undefined;
      this.recordingWorklet = undefined;
      this.vuWorklet = undefined;
    };
    if (this.starting) {
      this.starting.then(handleStop);
      return;
    }
    handleStop();
  }
}
