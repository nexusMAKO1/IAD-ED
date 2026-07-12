import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onPlayCommand:      (cb: (data: any) => void) => ipcRenderer.on('mqtt-play',            (_e, data) => cb(data)),
  onPlaylistUpdate:   (cb: (data: any) => void) => ipcRenderer.on('mqtt-playlist',         (_e, data) => cb(data)),
  onRevertPlaylist:   (cb: ()          => void) => ipcRenderer.on('mqtt-revert-playlist',  (_e)       => cb()),
  onMqttStatus:       (cb: (data: any) => void) => ipcRenderer.on('mqtt-status',           (_e, data) => cb(data)),
  getCachePath:       ()                         => ipcRenderer.invoke('get-cache-path'),
});
