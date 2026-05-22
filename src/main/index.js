const { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, nativeImage, screen } = require('electron')
const path = require('path')
const fs = require('fs')

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) } catch { return {} }
}
function saveConfig(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...loadConfig(), ...data }, null, 2))
}

function boundsIntersect(a, b) {
  return a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
}

function getSavedWindowBounds() {
  const { windowBounds } = loadConfig()
  if (!windowBounds) return null

  const { x, y, width, height } = windowBounds
  if (![x, y, width, height].every(Number.isFinite)) return null
  if (width < 400 || height < 360) return null

  const visibleOnDisplay = screen.getAllDisplays().some((display) =>
    boundsIntersect(windowBounds, display.workArea)
  )
  return visibleOnDisplay ? windowBounds : null
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

app.on('second-instance', () => showWindow())

let win, tray
const activeChats = new Map()

function saveWindowBounds() {
  if (!win || win.isDestroyed() || win.isMinimized()) return
  saveConfig({ windowBounds: win.getBounds() })
}

function createWindow() {
  const savedBounds = getSavedWindowBounds()
  win = new BrowserWindow({
    width: savedBounds?.width || 620,
    height: savedBounds?.height || 520,
    ...(savedBounds ? { x: savedBounds.x, y: savedBounds.y } : {}),
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

  let saveBoundsTimer
  const scheduleSaveWindowBounds = () => {
    clearTimeout(saveBoundsTimer)
    saveBoundsTimer = setTimeout(saveWindowBounds, 250)
  }
  win.on('move', scheduleSaveWindowBounds)
  win.on('resize', scheduleSaveWindowBounds)
  win.on('close', saveWindowBounds)

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(app.getAppPath(), 'dist/renderer/index.html'))
    win.once('ready-to-show', () => {
      win.on('blur', () => { if (!win.isAlwaysOnTop()) win.hide() })
    })
  }
}

function showWindow() {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function toggleWindow() {
  if (!win) return
  if (win.isVisible()) {
    saveWindowBounds()
    win.hide()
  } else {
    showWindow()
  }
}

function createTray() {
  const iconPath = path.join(app.getAppPath(), 'assets', 'icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('CandyPie')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open', click: showWindow },
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
  ipcMain.on('window:hide', () => { saveWindowBounds(); win.hide() })
  ipcMain.on('window:alwaysOnTop', (_, flag) => win.setAlwaysOnTop(flag))
  ipcMain.on('chat:stop', (event) => {
    const controller = activeChats.get(event.sender.id)
    if (controller) controller.abort()
  })

  ipcMain.on('chat:send', async (event, { message, config, history = [] }) => {
    const { apiUrl, apiKey, modelName, systemPrompt, reasoningEnabled } = config
    const sender = event.sender
    const senderId = sender.id
    activeChats.get(senderId)?.abort()

    const controller = new AbortController()
    activeChats.set(senderId, controller)
    const sendToRenderer = (channel, data) => {
      if (!sender.isDestroyed() && activeChats.get(senderId) === controller) {
        sender.send(channel, data)
      }
    }

    try {
      const res = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: modelName || 'gpt-3.5-turbo',
          stream: true,
          ...(reasoningEnabled === false ? { reasoning_effort: 'none' } : {}),
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            ...history,
            { role: 'user', content: message }
          ]
        })
      })
      if (!res.ok) {
        const text = await res.text()
        sendToRenderer('chat:error', `API error ${res.status}: ${text.slice(0, 200)}`)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (controller.signal.aborted) {
            const abortError = new Error('Aborted')
            abortError.name = 'AbortError'
            throw abortError
          }
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') { sendToRenderer('chat:done'); return }
          try {
            const chunk = JSON.parse(data)
            const text = chunk.choices?.[0]?.delta?.content
            if (text) sendToRenderer('chat:chunk', text)
          } catch {}
        }
      }
      sendToRenderer('chat:done')
    } catch (e) {
      if (e.name === 'AbortError') {
        sendToRenderer('chat:stopped')
      } else {
        sendToRenderer('chat:error', e.message)
      }
    } finally {
      if (activeChats.get(senderId) === controller) activeChats.delete(senderId)
    }
  })
})

app.on('will-quit', () => {
  for (const controller of activeChats.values()) controller.abort()
  activeChats.clear()
  globalShortcut.unregisterAll()
})
app.on('window-all-closed', (e) => e.preventDefault())
