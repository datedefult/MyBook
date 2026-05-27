import { useState, useEffect } from 'react'
import { QuickCreate } from './components/QuickCreate'
import { ToastProvider } from './components/Toast'
import { useThemeStore } from './stores/themeStore'
import { useLanguageStore } from './stores/languageStore'

type QuickCreateMode = 'log' | 'task'

function QuickCreateContent(): JSX.Element {
  const [mode, setMode] = useState<QuickCreateMode>('log')
  const initTheme = useThemeStore((s) => s.init)
  const initLanguage = useLanguageStore((s) => s.init)

  useEffect(() => {
    initTheme()
    initLanguage()
  }, [])

  useEffect(() => {
    // Listen for mode changes from main process
    const unsubscribe = window.api.quickCreate.onSetMode((newMode) => {
      setMode(newMode)
    })

    return unsubscribe
  }, [])

  const handleClose = (): void => {
    window.api.quickCreate.close()
  }

  return (
    <div className="w-full bg-transparent">
      <QuickCreate initialMode={mode} onClose={handleClose} />
    </div>
  )
}

function QuickCreateApp(): JSX.Element {
  return (
    <ToastProvider>
      <QuickCreateContent />
    </ToastProvider>
  )
}

export default QuickCreateApp
