import { app, BrowserWindow, protocol, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import * as os from 'os';
import mqtt from 'mqtt';
import 'dotenv/config';

const isDev = process.env.NODE_ENV !== 'production';
const VITE_DEV_SERVER_URL = 'http://localhost:5174';

// Handle EPIPE errors on stdout/stderr
[process.stdout, process.stderr].forEach((stream) => {
  if (stream?.on) {
    stream.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EPIPE') return;
    });
  }
});

// In production, disable console logging to prevent stream write errors entirely
if (!isDev) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}

// Configuration
const CACHE_DIR = path.join(app.getPath('userData'), 'media_cache');
const API_URL = process.env.API_URL || 'http://localhost:3000';
const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Identity Management via fs
const identityPath = path.join(CACHE_DIR, 'identity.json');
let DEVICE_ID = '';
let SITE_ID = '';
let SCREEN_ID = '';
let STATUS = 'UNPAIRED';

if (fs.existsSync(identityPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
    DEVICE_ID = data.deviceId || '';
    SITE_ID = data.siteId || '';
    SCREEN_ID = data.screenId || '';
    STATUS = data.status || 'UNPAIRED';
  } catch (e) {
    console.error('[Identity] Error reading identity.json', e);
  }
}

if (!DEVICE_ID) {
  DEVICE_ID = process.env.DEVICE_ID || `display-${Math.random().toString(16).slice(2, 8)}`;
}

// Persist the current state
fs.writeFileSync(identityPath, JSON.stringify({ 
  deviceId: DEVICE_ID, 
  siteId: SITE_ID || null, 
  screenId: SCREEN_ID || null,
  status: STATUS
}, null, 2), 'utf8');

console.log(`[Identity] Device: ${DEVICE_ID} | Site: ${SITE_ID || 'None'} | Screen: ${SCREEN_ID || 'None'} | Status: ${STATUS}`);

const TOPIC_COMMANDS = `smartvision/display/${DEVICE_ID}/commands`;
const TOPIC_PLAYLIST = `smartvision/display/${DEVICE_ID}/playlist`;
const TOPIC_CONFIG = `smartvision/display/${DEVICE_ID}/config`;
const TOPIC_DISCOVERY = 'smartvision/display/discovery';

let mainWindow: BrowserWindow | null = null;
let mqttClient: mqtt.MqttClient | null = null;
let cachedPlaylist: any[] = [];

// ==========================================
// MediaCacheService
// ==========================================
class MediaCacheService {
  static async downloadMedia(campaignId: string, mediaUrl: string): Promise<string> {
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
        if (
          response.statusCode === 301 ||
          response.statusCode === 302 ||
          response.statusCode === 307
        ) {
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

  static getCacheUrl(campaignId: string, originalUrl: string): string {
    const ext = path.extname(new URL(originalUrl).pathname) || '.mp4';
    const filename = `${campaignId}${ext}`;
    return `cache://${filename}`;
  }
}

// ==========================================
// Electron App Setup
// ==========================================
function createWindow() {
  mainWindow = new BrowserWindow({
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
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // Register custom protocol for local media cache
  protocol.registerFileProtocol('cache', (request, callback) => {
    const url = request.url.replace('cache://', '');
    try {
      return callback(path.join(CACHE_DIR, decodeURI(url)));
    } catch (error) {
      console.error(error);
      return callback('404');
    }
  });

  createWindow();
  setupMQTT();

  // Discovery Heartbeat every 10 s
  const startTime = Date.now();
  setInterval(() => {
    if (mqttClient?.connected) {
      mqttClient.publish(TOPIC_DISCOVERY, JSON.stringify({
        deviceId: DEVICE_ID,
        siteId: SITE_ID || null,
        screenId: SCREEN_ID || null,
        status: STATUS,
        hostname: os.hostname(),
        platform: os.platform(),
        ip: Object.values(os.networkInterfaces()).flat().find((i: any) => i?.family === 'IPv4' && !i?.internal)?.address || '127.0.0.1',
        resolution: mainWindow ? `${mainWindow.getBounds().width}x${mainWindow.getBounds().height}` : 'unknown',
        version: app.getVersion(),
        uptime: Math.floor((Date.now() - startTime) / 1000)
      }));
    }
  }, 10_000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ==========================================
// MQTT Integration
// ==========================================

function setupMQTT() {
  console.log(`[MQTT] Connecting to ${MQTT_URL}`);

  mqttClient = mqtt.connect(MQTT_URL, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clientId: `${DEVICE_ID}-${Math.random().toString(16).slice(2, 8)}`,
  });

  mqttClient.on('connect', () => {
    console.log('[MQTT] Connected — subscribing to display commands');
    mqttClient?.subscribe(TOPIC_COMMANDS, { qos: 1 });
    mqttClient?.subscribe(TOPIC_PLAYLIST, { qos: 1 });
    mqttClient?.subscribe(TOPIC_CONFIG, { qos: 1 });
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
    let data: any;
    try {
      data = JSON.parse(message.toString());
    } catch (e) {
      console.error('[MQTT] Invalid JSON message on topic', topic);
      return;
    }

    // ── Main command channel ──────────────────────────────────────────
    if (topic === TOPIC_COMMANDS) {
      const action: string = data.action;
      console.log(`[MQTT] Received command: ${action}`, data);

      if (action === 'play') {
        // Track latency from timestamp if available
        const backendTs: number = data.timestamp ? new Date(data.timestamp).getTime() : Date.now();
        const latencyMs: number = Date.now() - backendTs;

        // Attempt to cache media locally
        try {
          await MediaCacheService.downloadMedia(data.campaignId, data.url);
          data.localUrl = MediaCacheService.getCacheUrl(data.campaignId, data.url);
        } catch (e) {
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
        } catch (e) {
          console.error(`[Cache] Failed to cache ${camp.name}`, e);
          newPlaylist.push({ ...camp, localUrl: camp.mediaUrl });
        }
      }

      // Persist for offline reload
      fs.writeFileSync(path.join(CACHE_DIR, 'playlist.json'), JSON.stringify(newPlaylist));
      mainWindow?.webContents.send('mqtt-playlist', newPlaylist);
    }
    
    // ── Configuration update (Pairing) ────────────────────────────────
    else if (topic === TOPIC_CONFIG) {
      console.log('[MQTT] Received CONFIG update', data);
      if (data.siteId !== undefined) SITE_ID = data.siteId;
      if (data.screenId !== undefined) SCREEN_ID = data.screenId;
      
      STATUS = SITE_ID ? 'ONLINE' : 'UNPAIRED';
      
      fs.writeFileSync(identityPath, JSON.stringify({ 
        deviceId: DEVICE_ID, 
        siteId: SITE_ID || null, 
        screenId: SCREEN_ID || null,
        status: STATUS
      }, null, 2), 'utf8');
      
      console.log('[Identity] Configuration saved. Restarting application to apply changes...');
      app.relaunch();
      app.exit(0);
    }
  });
}

// IPC Handlers
ipcMain.handle('get-cache-path', () => CACHE_DIR);
