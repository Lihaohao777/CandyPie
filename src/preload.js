const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (data) => ipcRenderer.invoke('config:save', data),
  sendMessage: (message, config, history) => ipcRenderer.send('chat:send', { message, config, history }),
  stopMessage: () => ipcRenderer.send('chat:stop'),
  onChunk: (cb) => ipcRenderer.on('chat:chunk', (_, text) => cb(text)),
  onDone: (cb) => ipcRenderer.on('chat:done', () => cb()),
  onStopped: (cb) => ipcRenderer.on('chat:stopped', () => cb()),
  onError: (cb) => ipcRenderer.on('chat:error', (_, err) => cb(err)),
  removeListeners: () => {
    ipcRenderer.removeAllListeners('chat:chunk')
    ipcRenderer.removeAllListeners('chat:done')
    ipcRenderer.removeAllListeners('chat:stopped')
    ipcRenderer.removeAllListeners('chat:error')
  },
  hideWindow: () => ipcRenderer.send('window:hide'),
  setAlwaysOnTop: (flag) => ipcRenderer.send('window:alwaysOnTop', flag)
})
