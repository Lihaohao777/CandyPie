const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (data) => ipcRenderer.invoke('config:save', data),
  sendMessage: (message, config, history) => ipcRenderer.send('chat:send', { message, config, history }),
  onChunk: (cb) => ipcRenderer.on('chat:chunk', (_, text) => cb(text)),
  onDone: (cb) => ipcRenderer.on('chat:done', () => cb()),
  onError: (cb) => ipcRenderer.on('chat:error', (_, err) => cb(err)),
  removeListeners: () => {
    ipcRenderer.removeAllListeners('chat:chunk')
    ipcRenderer.removeAllListeners('chat:done')
    ipcRenderer.removeAllListeners('chat:error')
  },
  hideWindow: () => ipcRenderer.send('window:hide')
})
