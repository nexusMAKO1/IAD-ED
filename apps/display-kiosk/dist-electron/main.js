"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const mqtt_1 = __importDefault(require("mqtt"));
require("dotenv/config");
const isDev = process.env.NODE_ENV !== 'production';
const VITE_DEV_SERVER_URL = 'http://localhost:5174';
// Handle EPIPE errors on stdout/stderr
[process.stdout, process.stderr].forEach((stream) => {
    if (stream?.on) {
        stream.on('error', (err) => {
            if (err.code === 'EPIPE')
                return;
        });
    }
});
// In production, disable console logging to prevent stream write errors entirely
if (!isDev) {
    console.log = () => { };
    console.warn = () => { };
    console.error = () => { };
}
// Configuration
const CACHE_DIR = path.join(electron_1.app.getPath('userData'), 'media_cache');
const API_URL = process.env.API_URL || 'http://localhost:3000';
const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const DEVICE_ID = 'display-kiosk-01';
const TOPIC_COMMANDS = 'smartvision/display/commands';
const TOPIC_PLAYLIST = 'smartvision/display/playlist';
const TOPIC_STATUS = 'smartvision/display/status';
// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}
let mainWindow = null;
let mqttClient = null;
let cachedPlaylist = [];
// ==========================================
// MediaCacheService
// ==========================================
class MediaCacheService {
    static async downloadMedia(campaignId, mediaUrl) {
        const ext = path.extname(new URL(mediaUrl).pathname) || '.mp4';
        const filename = `${campaignId}${ext}`;
        const dest = path.join(CACHE_DIR, filename);
        if (fs.existsSync(dest)) {
            console.log(`[Cache] Already cached: ${filename}`);
            return dest;
        }
        console.log(`[Cache] Downloading ${mediaUrl} → ${dest}`);
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest);
            const protocolHandler = mediaUrl.startsWith('https') ? https : http;
            protocolHandler.get(mediaUrl, (response) => {
                if (response.statusCode === 301 ||
                    response.statusCode === 302 ||
                    response.statusCode === 307) {
                    const redirectUrl = response.headers.location;
                    if (redirectUrl) {
                        const redirHandler = redirectUrl.startsWith('https') ? https : http;
                        redirHandler
                            .get(redirectUrl, (redirResponse) => {
                            redirResponse.pipe(file);
                            file.on('finish', () => { file.close(); resolve(dest); });
                        })
                            .on('error', (err) => { fs.unlink(dest, () => reject(err)); });
                    }
                    return;
                }
                response.pipe(file);
                file.on('finish', () => { file.close(); resolve(dest); });
            }).on('error', (err) => {
                fs.unlink(dest, () => { });
                reject(err);
            });
        });
    }
    static getCacheUrl(campaignId, originalUrl) {
        const ext = path.extname(new URL(originalUrl).pathname) || '.mp4';
        const filename = `${campaignId}${ext}`;
        return `cache://${filename}`;
    }
}
// ==========================================
// Electron App Setup
// ==========================================
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1920,
        height: 1080,
        fullscreen: true,
        kiosk: true,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
        },
    });
    if (isDev) {
        mainWindow.loadURL(VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}
electron_1.app.whenReady().then(() => {
    // Register custom protocol for local media cache
    electron_1.protocol.registerFileProtocol('cache', (request, callback) => {
        const url = request.url.replace('cache://', '');
        try {
            return callback(path.join(CACHE_DIR, decodeURI(url)));
        }
        catch (error) {
            console.error(error);
            return callback('404');
        }
    });
    createWindow();
    setupMQTT();
    // Heartbeat every 30 s
    setInterval(() => {
        if (mqttClient?.connected) {
            mqttClient.publish(TOPIC_STATUS, JSON.stringify({
                deviceId: DEVICE_ID,
                status: 'online',
                timestamp: new Date().toISOString(),
            }));
        }
    }, 30_000);
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
// ==========================================
// MQTT Integration
// ==========================================
function setupMQTT() {
    console.log(`[MQTT] Connecting to ${MQTT_URL}`);
    mqttClient = mqtt_1.default.connect(MQTT_URL, {
        username: MQTT_USERNAME,
        password: MQTT_PASSWORD,
        clientId: `${DEVICE_ID}-${Math.random().toString(16).slice(2, 8)}`,
    });
    mqttClient.on('connect', () => {
        console.log('[MQTT] Connected — subscribing to display commands');
        mqttClient?.subscribe(TOPIC_COMMANDS, { qos: 1 });
        mqttClient?.subscribe(TOPIC_PLAYLIST, { qos: 1 });
        mainWindow?.webContents.send('mqtt-status', { connected: true, topic: TOPIC_COMMANDS });
    });
    mqttClient.on('disconnect', () => {
        console.warn('[MQTT] Disconnected');
        mainWindow?.webContents.send('mqtt-status', { connected: false, topic: TOPIC_COMMANDS });
    });
    mqttClient.on('close', () => {
        console.warn('[MQTT] Connection closed');
        mainWindow?.webContents.send('mqtt-status', { connected: false, topic: TOPIC_COMMANDS });
    });
    mqttClient.on('offline', () => {
        console.warn('[MQTT] Client offline');
        mainWindow?.webContents.send('mqtt-status', { connected: false, topic: TOPIC_COMMANDS });
    });
    mqttClient.on('error', (err) => {
        console.error('[MQTT] Error:', err.message);
    });
    mqttClient.on('message', async (topic, message) => {
        let data;
        try {
            data = JSON.parse(message.toString());
        }
        catch (e) {
            console.error('[MQTT] Invalid JSON message on topic', topic);
            return;
        }
        // ── Main command channel ──────────────────────────────────────────
        if (topic === TOPIC_COMMANDS) {
            const action = data.action;
            console.log(`[MQTT] Received command: ${action}`, data);
            if (action === 'play') {
                // Track latency from timestamp if available
                const backendTs = data.timestamp ? new Date(data.timestamp).getTime() : Date.now();
                const latencyMs = Date.now() - backendTs;
                // Attempt to cache media locally
                try {
                    await MediaCacheService.downloadMedia(data.campaignId, data.url);
                    data.localUrl = MediaCacheService.getCacheUrl(data.campaignId, data.url);
                }
                catch (e) {
                    console.error('[Cache] Download failed — streaming direct URL', e);
                    data.localUrl = data.url;
                }
                data.latencyMs = latencyMs;
                console.log(`[DISPLAY] Campaign loaded: ${data.campaignId} | latency: ${latencyMs} ms`);
                mainWindow?.webContents.send('mqtt-play', data);
            }
            else if (action === 'playlist') {
                console.log('[DISPLAY] Reverting to default playlist');
                mainWindow?.webContents.send('mqtt-revert-playlist');
            }
        }
        // ── Playlist update ───────────────────────────────────────────────
        else if (topic === TOPIC_PLAYLIST) {
            console.log('[MQTT] Received PLAYLIST update');
            cachedPlaylist = data.playlist ?? [];
            const newPlaylist = [];
            for (const camp of cachedPlaylist) {
                try {
                    await MediaCacheService.downloadMedia(camp.id, camp.mediaUrl);
                    newPlaylist.push({
                        ...camp,
                        localUrl: MediaCacheService.getCacheUrl(camp.id, camp.mediaUrl),
                    });
                }
                catch (e) {
                    console.error(`[Cache] Failed to cache ${camp.name}`, e);
                    newPlaylist.push({ ...camp, localUrl: camp.mediaUrl });
                }
            }
            // Persist for offline reload
            fs.writeFileSync(path.join(CACHE_DIR, 'playlist.json'), JSON.stringify(newPlaylist));
            mainWindow?.webContents.send('mqtt-playlist', newPlaylist);
        }
    });
}
// IPC Handlers
electron_1.ipcMain.handle('get-cache-path', () => CACHE_DIR);
//# sourceMappingURL=main.js.map