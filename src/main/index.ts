import { app, BrowserWindow, shell, Menu, Tray, nativeImage, globalShortcut, ipcMain, screen, session } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase, closeDatabase, getSetting, setSetting } from './db'
import { registerIpcHandlers } from './ipc'
import { tMain, type AppLanguage } from './i18n'
import { configureAutoUpdater, registerUpdateIpc, startUpdateCheck } from './updater'

// --- Constants ---
const QUICK_CREATE_WIDTH_RATIO = 0.5 // 50% of screen width
const QUICK_CREATE_INITIAL_HEIGHT = 180
const QUICK_CREATE_MIN_HEIGHT = 120
const QUICK_CREATE_MAX_HEIGHT = 600
const QUICK_CREATE_MIN_WIDTH = 400

let tray: Tray | null = null
let isQuitting = false
let mainWindow: BrowserWindow | null = null
let quickCreateWindow: BrowserWindow | null = null

// --- Helpers ---

function sendToRenderer(channel: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isVisible()) mainWindow.show()
    mainWindow.focus()
    mainWindow.webContents.send(channel)
  }
}

function createQuickCreateWindow(mode: 'log' | 'task'): void {
  // If window already exists, just update mode and show
  if (quickCreateWindow && !quickCreateWindow.isDestroyed()) {
    quickCreateWindow.webContents.send('quick-create:set-mode', mode)
    quickCreateWindow.show()
    quickCreateWindow.focus()
    return
  }

  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  // Calculate window size: 50% width, auto height
  const windowWidth = Math.floor(screenWidth * QUICK_CREATE_WIDTH_RATIO)
  const windowHeight = QUICK_CREATE_INITIAL_HEIGHT

  // Position: centered horizontally, at top of screen
  const x = Math.floor((screenWidth - windowWidth) / 2)
  const y = 0

  quickCreateWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: QUICK_CREATE_MIN_WIDTH,
    minHeight: QUICK_CREATE_MIN_HEIGHT,
    maxHeight: QUICK_CREATE_MAX_HEIGHT,
    x,
    y,
    resizable: true,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    frame: false,
    transparent: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
    }
  })

  // Remove menu bar and disable Alt key
  quickCreateWindow.setMenuBarVisibility(false)
  Menu.setApplicationMenu(null)

  quickCreateWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Alt' || input.key === 'AltGraph') {
      event.preventDefault()
    }
  })

  quickCreateWindow.on('ready-to-show', () => {
    quickCreateWindow?.show()
    quickCreateWindow?.focus()
    // Send initial mode after window is ready
    quickCreateWindow?.webContents.send('quick-create:set-mode', mode)
  })

  // Close window when it loses focus
  quickCreateWindow.on('blur', () => {
    if (quickCreateWindow && !quickCreateWindow.isDestroyed()) {
      quickCreateWindow.close()
    }
  })

  quickCreateWindow.on('closed', () => {
    quickCreateWindow = null
  })

  // Load the quick create HTML
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    quickCreateWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/quick-create.html`)
  } else {
    quickCreateWindow.loadFile(join(__dirname, '../renderer/quick-create.html'))
  }
}

function sendQuickCreate(channel: string): void {
  // Extract mode from channel (e.g., 'quick-create:log' -> 'log')
  const mode = channel.replace('quick-create:', '') as 'log' | 'task'
  createQuickCreateWindow(mode)
}

// --- Shortcuts ---

const DEFAULT_SHORTCUT_LOG = 'CmdOrCtrl+Shift+L'
const DEFAULT_SHORTCUT_TASK = 'CmdOrCtrl+Shift+T'

function getShortcuts(overrides: Partial<{ log: string; task: string }> = {}): { log: string; task: string } {
  const log = overrides.log ?? getSetting('shortcut_quick_log') ?? DEFAULT_SHORTCUT_LOG
  const task = overrides.task ?? getSetting('shortcut_quick_task') ?? DEFAULT_SHORTCUT_TASK
  return { log, task }
}

function registerShortcut(accelerator: string, channel: string, quickCreate = false): boolean {
  try {
    return globalShortcut.register(accelerator, () => {
      if (quickCreate) {
        sendQuickCreate(channel)
      } else {
        sendToRenderer(channel)
      }
    })
  } catch {
    return false
  }
}

export function reregisterGlobalShortcuts(
  overrides: Partial<{ log: string; task: string }> = {}
): { log: boolean; task: boolean } {
  globalShortcut.unregisterAll()
  const { log, task } = getShortcuts(overrides)

  return {
    log: registerShortcut(log, 'quick-create:log', true),
    task: registerShortcut(task, 'quick-create:task', true)
  }
}

// --- Application Menu ---

function buildMenu(): void {
  Menu.setApplicationMenu(null)
}

// --- Tray ---

function buildTrayMenu(): Electron.Menu {
  return Menu.buildFromTemplate([
    {
      label: tMain('showApp'),
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus() }
      }
    },
    { type: 'separator' },
    {
      label: tMain('quit'),
      click: () => app.quit()
    }
  ])
}

function createTray(): void {
  // In dev: resources/ is at project root. In production: extraResources copies it to app.getPath('exe')/../
  const iconPath = is.dev
    ? join(__dirname, '../../resources/tray-icon.png')
    : join(process.resourcesPath, 'tray-icon.png')
  let icon = nativeImage.createFromPath(iconPath)
  if (process.platform === 'darwin') {
    try {
      icon = nativeImage.createFromBuffer(readFileSync(iconPath), { scaleFactor: 2 })
    } catch {
      // Fall back to the regular path-loaded image below.
    }
  }
  if (icon.isEmpty()) {
    // Fallback: create a minimal 1x1 white pixel template image
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABdJREFUeNpj/P//PwMlgHHUgFEDAAIMAAABBgABsp3F1QAAAABJRU5ErkJggg=='
    )
  }
  if (process.platform !== 'darwin') {
    icon = icon.resize({ width: 18, height: 18 })
  }
  icon.setTemplateImage(true)
  tray = new Tray(icon)
  tray.setToolTip('MyWork')
  tray.setContextMenu(buildTrayMenu())

  // Click on tray icon shows/focuses the window
  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isVisible() && mainWindow.isFocused()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })
}

// --- Window ---

function createWindow(): void {
  const iconPath = is.dev
    ? join(__dirname, '../../resources/icon.png')
    : join(process.resourcesPath, 'icon.png')
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 400,
    minHeight: 500,
    show: false,
    title: 'MyWork',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  Menu.setApplicationMenu(null)
  mainWindow.setMenuBarVisibility(false)

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Alt' || input.key === 'AltGraph') {
      event.preventDefault()
    }
  })

  if (process.platform !== 'darwin') {
    mainWindow.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault()
        mainWindow?.hide()
      }
    })
  }

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url)
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        shell.openExternal(details.url)
      }
    } catch {
      // invalid URL, ignore
    }
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// --- IPC: shortcut update ---

function registerShortcutIpc(): void {
  ipcMain.handle('shortcut:update', (_event, key: 'shortcut_quick_log' | 'shortcut_quick_task', value: string) => {
    const overrides = key === 'shortcut_quick_log' ? { log: value } : { task: value }
    const results = reregisterGlobalShortcuts(overrides)
    const success = results.log && results.task

    if (!success) {
      reregisterGlobalShortcuts()
      return false
    }

    setSetting(key, value)
    buildMenu()
    if (tray) tray.setContextMenu(buildTrayMenu())
    return true
  })

  ipcMain.handle('app:language:update', (_event, language: AppLanguage) => {
    if (!['system', 'zh', 'en'].includes(language)) return
    setSetting('app_language', language)
    buildMenu()
    if (tray) tray.setContextMenu(buildTrayMenu())
  })

  // Handle quick create window close
  ipcMain.on('quick-create:close', () => {
    if (quickCreateWindow && !quickCreateWindow.isDestroyed()) {
      quickCreateWindow.close()
    }
  })

  // Handle dynamic window resize from renderer
  ipcMain.on('quick-create:resize', (_event, height: number) => {
    if (quickCreateWindow && !quickCreateWindow.isDestroyed()) {
      const currentSize = quickCreateWindow.getSize()
      const finalHeight = Math.min(Math.max(height, QUICK_CREATE_MIN_HEIGHT), QUICK_CREATE_MAX_HEIGHT)
      quickCreateWindow.setSize(currentSize[0], finalHeight, true)
    }
  })
}

// --- Bootstrap ---

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.mywork')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initDatabase()

  // Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https: http:"
        ]
      }
    })
  })

  configureAutoUpdater()
  registerIpcHandlers()
  registerShortcutIpc()
  registerUpdateIpc()
  buildMenu()
  createTray()
  createWindow()
  startUpdateCheck()

  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) createWindow()
  })

  const results = reregisterGlobalShortcuts()
  if (!results.log || !results.task) {
    console.warn('One or more global shortcuts could not be registered')
  }
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  closeDatabase()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
