const WebSocket = require("ws");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { VideoIntelligenceServiceClient } = require("@google-cloud/video-intelligence").v1;
const speech = require("@google-cloud/speech").v1p1beta1;

const GOOGLE_CREDS = process.env.GOOGLE_CREDS || "./src/vexa-471321-c91eb62f8897.json";
const FRAME_DIR = process.env.FRAME_DIR || "./src/frames";
let HLS_URL = process.env.HLS_URL || "";
let latestFramePath = "";

function setupVideoAgent(app, server) {
  if (!fs.existsSync(FRAME_DIR)) fs.mkdirSync(FRAME_DIR, { recursive: true });
  const wss = new WebSocket.Server({ noServer: true });
  const videoClient = new VideoIntelligenceServiceClient({ keyFilename: GOOGLE_CREDS });
  const speechClient = new speech.SpeechClient({ keyFilename: GOOGLE_CREDS });

  // FFmpeg frame extraction
  function startFFmpeg() {
    fs.readdirSync(FRAME_DIR).forEach(f => fs.unlinkSync(path.join(FRAME_DIR, f)));
    global.ffmpegProcess = ffmpeg(HLS_URL)
      .inputOptions(["-re"])
      .outputOptions([
        "-vf", "fps=1"
      ])
      .on("error", err => console.error("ffmpeg error:", err))
      .on("start", cmd => console.log("ffmpeg started:", cmd))
      .output(path.join(FRAME_DIR, "frame-%04d.jpg"))
      .run();
  }
  startFFmpeg();

  function watchFrames() {
    let lastFrame = "";
    setInterval(() => {
      const files = fs.readdirSync(FRAME_DIR).filter(f => f.endsWith(".jpg"));
      if (!files.length) return;
      const latest = files.sort().reverse()[0];
      if (latest !== lastFrame) {
        lastFrame = latest;
        latestFramePath = path.join(FRAME_DIR, latest);
        const buf = fs.readFileSync(latestFramePath);
        const base64 = "data:image/jpeg;base64," + buf.toString("base64");
        wss.clients.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({
            frame: base64,
            timestamp: Date.now()
          }));
        });
      }
    }, 1000);
  }
  watchFrames();

  // WebSocket upgrade
  server.on("upgrade", (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit("connection", ws, req);
    });
  });

  // Voice command endpoint
  app.post("/voice-command", async (req, res) => {
    const { audio } = req.body;
    const audioBuffer = Buffer.from(audio.replace(/^data:audio\/\w+;base64,/, ""), "base64");
    let transcript = "";
    try {
      const [response] = await speechClient.recognize({
        audio: { content: audioBuffer.toString("base64") },
        config: { encoding: "LINEAR16", languageCode: "en-US" }
      });
      transcript = response.results.map(r => r.alternatives[0].transcript).join(" ");
    } catch (err) {
      transcript = "Error transcribing audio: " + err.message;
    }

    let analysis = "No actionable command detected.";
    if (/analyze|look|check|what|where|how|see|detect/i.test(transcript) && latestFramePath) {
      try {
        const frameBuf = fs.readFileSync(latestFramePath);
        const [videoResponse] = await videoClient.annotateVideo({
          inputContent: frameBuf.toString("base64"),
          features: ["LABEL_DETECTION"]
        });
        const labels = videoResponse.annotationResults[0].segmentLabelAnnotations
          .map(l => l.entity.description)
          .join(", ");
        analysis = labels
          ? `Agent: Detected in frame: ${labels}`
          : "Agent: No labels detected in frame.";
      } catch (err) {
        analysis = "Error analyzing frame: " + err.message;
      }
    }
    res.json({ transcript, analysis });
  });
}

module.exports = setupVideoAgent;
