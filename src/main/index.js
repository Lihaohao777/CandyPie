const { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) } catch { return {} }
}
function saveConfig(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2))
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

app.on('second-instance', () => {
  if (win) { win.center(); win.show(); win.focus() }
})

let win, tray

function createWindow() {
  win = new BrowserWindow({
    width: 620,
    height: 520,
    minWidth: 400,
    minHeight: 360,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(app.getAppPath(), 'dist/renderer/index.html'))
    win.once('ready-to-show', () => {
      win.on('blur', () => win.hide())
    })
  }
}

function toggleWindow() {
  if (!win) return
  if (win.isVisible()) {
    win.hide()
  } else {
    win.center()
    win.show()
    win.focus()
  }
}

function createTray() {
  const iconPath = path.join(app.getAppPath(), 'assets', 'icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('CandyPie')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open', click: () => { win.center(); win.show(); win.focus() } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]))
  tray.on('click', toggleWindow)
}

app.whenReady().then(() => {
  createWindow()
  createTray()

  globalShortcut.register('Ctrl+Space', toggleWindow)

  ipcMain.handle('config:load', () => loadConfig())
  ipcMain.handle('config:save', (_, data) => { saveConfig(data); return true })
  ipcMain.on('window:hide', () => win.hide())

  ipcMain.on('chat:send', async (event, { message, config, history = [] }) => {
    const { apiUrl, apiKey, modelName, systemPrompt } = config
    try {
      const res = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: modelName || 'gpt-3.5-turbo',
          stream: true,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            ...history,
            { role: 'user', content: message }
          ]
        })
      })
      if (!res.ok) {
        const text = await res.text()
        event.sender.send('chat:error', `API error ${res.status}: ${text.slice(0, 200)}`)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') { event.sender.send('chat:done'); return }
          try {
            const chunk = JSON.parse(data)
            const text = chunk.choices?.[0]?.delta?.content
            if (text) event.sender.send('chat:chunk', text)
          } catch {}
        }
      }
      event.sender.send('chat:done')
    } catch (e) {
      event.sender.send('chat:error', e.message)
    }
  })
})

app.on('will-quit', () => globalShortcut.unregisterAll())
app.on('window-all-closed', (e) => e.preventDefault())
