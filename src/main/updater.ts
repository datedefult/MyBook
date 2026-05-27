import { app, ipcMain } from 'electron'

export function configureAutoUpdater(): void {
  // Auto-update disabled for local development
}

export async function checkForUpdates(): Promise<null> {
  return null
}

export function registerUpdateIpc(): void {
  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('app:get-data-path', () => app.getPath('userData'))
}

export function startUpdateCheck(): void {
  // Auto-update disabled for local development
}
