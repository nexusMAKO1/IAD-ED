"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    onPlayCommand: (cb) => electron_1.ipcRenderer.on('mqtt-play', (_e, data) => cb(data)),
    onPlaylistUpdate: (cb) => electron_1.ipcRenderer.on('mqtt-playlist', (_e, data) => cb(data)),
    onRevertPlaylist: (cb) => electron_1.ipcRenderer.on('mqtt-revert-playlist', (_e) => cb()),
    onMqttStatus: (cb) => electron_1.ipcRenderer.on('mqtt-status', (_e, data) => cb(data)),
    getCachePath: () => electron_1.ipcRenderer.invoke('get-cache-path'),
});
//# sourceMappingURL=preload.js.map