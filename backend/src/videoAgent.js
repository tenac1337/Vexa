const express = require("express");
const WebSocket = require("ws");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const { ImageAnnotatorClient } = require("@google-cloud/vision");

const GOOGLE_CREDS = path.resolve(__dirname, "resources/vexa-471321-c91eb62f8897.json");
const PORT = 4000;
const FRAME_DIR = path.resolve(__dirname, "resources/frames");

// -- Update this with your Twitch HLS URL --
let HLS_URL = "https://use12.playlist.ttvnw.net/v1/playlist/CuIEAS3bM5JNw17-v854r14MBQQulLmduhk3jAcs7UF20xIFjQ263-5e_E0JaFmPnn0gFgVty2wG8vYtKgtMq3A74joFRRzLXrtYBJYU-n-qVxSFpwmA9QzSWLYh7Yluxn5r9toIeb32EFugCpsPh_OB4TJ9abfaGieUWuDxbsMr5NCfkGI96WsS-mP1huZAkhv1ckks4-KWbq1Hb7axKcOsiSDM2AmpDu_K3cm-n3MuG8amdZpr9YmZb7SvCQE1toLkLSm93G92uF1izlsrMCR24t6GOVZGL35PSh-IHSm8lxlCLAZzDQwwrxQdK6OBr2HUIpgQDGjXJgNs6RZNeudtHZDhk3JmtdYxEMBIIPx86RJ7K7xh9X0iA8U_UO283gzeS1S84fwhB5c4rMa5GFlMstF8B6FPHZY-jtfvTxC7eIecvbdUyZAcO2SGMNyIiXqMgBDlcW2a3BsrxZ5s8A-scDETXbBrODXEEX3p1O0ZsRnhAF4R9jgzFy_Laafg33jw9Q-nk9xk4IYzRaOzLLQfNFj7mAz_eAZwXMgGju_LXodZsDl1qONAlSN5pjLv578dwD45lmAdAf16FcHINHrNSHopCtUcSiGBHV1xofZlRfUbzw8TIULTCK-jN0tnuSZk8m8ok0jwg27dxgAvb0wziIqmz83bWNOJ0bnE2fd4WDjxNzci007EcE7YGcl8p2r_y2Z_cZuUop6Fdx8Bqto0egwdk6pr17w3vVLBhsXbRdYwJOh5Jvt7E6ui18wEiCF0W4wNibNe_gAU_MWDH7vWr_NV9H9N7aab4IWW3T226LKK9hoMkqOCtlZSvVmBMc7VIAEqCXVzLXdlc3QtMjCWDQ.m3u8"
// ---- INIT DIRECTORIES ----
if (!fs.existsSync(path.dirname(GOOGLE_CREDS))) fs.mkdirSync(path.dirname(GOOGLE_CREDS), { recursive: true });
if (!fs.existsSync(FRAME_DIR)) fs.mkdirSync(FRAME_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: "50mb" }));

const server = app.listen(PORT, () =>
  console.log(`Server listening on http://localhost:${PORT}`)
);

// ---- GOOGLE VISION CLIENT ----
const visionClient = new ImageAnnotatorClient({ keyFilename: GOOGLE_CREDS });

let latestFramePath = "";
let latestAnalysis = "";

// ---- FRAME EXTRACTION ----
function startFFmpeg() {
  fs.readdirSync(FRAME_DIR).forEach(f => fs.unlinkSync(path.join(FRAME_DIR, f)));
  global.ffmpegProcess = ffmpeg(HLS_URL)
    .inputOptions(["-re", "-user_agent", "Mozilla/5.0"])
    .outputOptions([
      "-vf", "fps=1"
    ])
    .on("error", err => console.error("ffmpeg error:", err))
    .on("start", cmd => console.log("ffmpeg started:", cmd))
    .output(path.join(FRAME_DIR, "frame-%04d.jpg"))
    .run();
}
startFFmpeg();

// ---- FRAME WATCHER & ANALYSIS ----
function watchAndAnalyzeFrames() {
  let lastFrame = "";
  setInterval(async () => {
    const files = fs.readdirSync(FRAME_DIR).filter(f => f.endsWith(".jpg"));
    if (!files.length) return;
    const latest = files.sort().reverse()[0];
    if (latest !== lastFrame) {
      lastFrame = latest;
      latestFramePath = path.join(FRAME_DIR, latest);
      const buf = fs.readFileSync(latestFramePath);
      let analysis = "";
      try {
        const [result] = await visionClient.labelDetection({ image: { content: buf } });
        const labels = result.labelAnnotations?.map(l => l.description).join(", ");
        analysis = labels ? `Detected in frame: ${labels}` : "No labels detected in frame.";
        latestAnalysis = analysis;
        console.log(`Analysis for ${latest}: ${analysis}`);
      } catch (err) {
        analysis = "Error analyzing frame: " + err.message;
        latestAnalysis = analysis;
        console.log(`Analysis error for ${latest}: ${analysis}`);
      }
      // Broadcast to all clients
      wss.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            frame: "data:image/jpeg;base64," + buf.toString("base64"),
            analysis,
            timestamp: Date.now()
          }));
        }
      });
    }
  }, 2000); // every 2 seconds (adjust as needed)
}
watchAndAnalyzeFrames();

// ---- WEBSOCKET SERVER ----
const wss = new WebSocket.Server({ server });

wss.on("connection", ws => {
  console.log("WebSocket connection established for frame analysis.");
  // Send latest frame and analysis immediately on connection
  if (latestFramePath && fs.existsSync(latestFramePath)) {
    const buf = fs.readFileSync(latestFramePath);
    ws.send(JSON.stringify({
      frame: "data:image/jpeg;base64," + buf.toString("base64"),
      analysis: latestAnalysis,
      timestamp: Date.now()
    }));
  }
  ws.on("close", () => {
    console.log("WebSocket connection closed.");
  });
});

// ---- TEST ENDPOINTS ----
app.get("/frames/latest", (req, res) => {
  if (!latestFramePath || !fs.existsSync(latestFramePath)) {
    return res.status(404).json({ error: "No frame available." });
  }
  res.sendFile(latestFramePath);
});

app.get("/analysis/latest", (req, res) => {
  res.json({ analysis: latestAnalysis, frame: latestFramePath });
});

app.get("/", (req, res) => {
  res.send("Twitch Live Analysis Agent is running.<br>Connect via WebSocket for live frame analysis.<br>GET /frames/latest for latest frame.<br>GET /analysis/latest for latest analysis.");
});