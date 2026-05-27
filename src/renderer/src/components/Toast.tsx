import { createContext, useCallback, useContext, useState, ReactNode } from 'react'
import { CheckCircle2, AlertCircle, X, Sparkles } from 'lucide-react'

type ToastType = 'success' | 'error' | 'optimization'

interface Toast {
  id: number
  type: ToastType
  exiting?: boolean
  message?: string
  content?: ReactNode
}

interface ToastContextValue {
  success: (message: string) => void
  error: (message: string) => void
  showOptimization: (original: string, optimized: string, onReplace: () => void) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 250)
  }, [])

  const add = useCallback((toast: Omit<Toast, 'id' | 'exiting'>) => {
    const id = nextId++
    setToasts((prev) => [...prev, { ...toast, id }])
    if (toast.type !== 'optimization') {
      setTimeout(() => remove(id), 2500)
    }
  }, [remove])

  const value: ToastContextValue = {
    success: useCallback((msg: string) => add({ type: 'success', message: msg }), [add]),
    error: useCallback((msg: string) => add({ type: 'error', message: msg }), [add]),
    showOptimization: useCallback((original: string, optimized: string, onReplace: () => void) => {
      const id = nextId++
      const content = (
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="font-medium text-slate-800 dark:text-slate-200">AI 优化结果</span>
            <button
              onClick={() => remove(id)}
              className="ml-auto p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-150"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-medium">原文</div>
              <div className="text-sm bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300 line-clamp-2 border border-slate-200 dark:border-slate-700">
                {original}
              </div>
            </div>
            <div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mb-1.5 font-medium">优化后</div>
              <div className="text-sm bg-blue-50 dark:bg-blue-950/30 rounded-lg px-3 py-2 text-blue-800 dark:text-blue-200 line-clamp-3 border border-blue-200 dark:border-blue-800/50">
                {optimized}
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-1">
            <button
              onClick={() => remove(id)}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all duration-150 font-medium"
            >
              取消
            </button>
            <button
              onClick={() => {
                onReplace()
                remove(id)
              }}
              className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all duration-150 font-medium shadow-sm hover:shadow-md"
            >
              替换
            </button>
          </div>
        </div>
      )
      setToasts((prev) => [...prev, { id, type: 'optimization', content }])
    }, [remove])
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${
              toast.exiting ? 'animate-toast-out' : 'animate-toast'
            } ${
              toast.type === 'optimization'
                ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg rounded-xl p-4'
                : `flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm ${
                    toast.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-200'
                      : 'bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-200'
                  }`
            }`}
          >
            {toast.type === 'optimization' ? (
              toast.content
            ) : (
              <>
                {toast.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                )}
                <span className="font-medium">{toast.message}</span>
                <button
                  onClick={() => remove(toast.id)}
                  className="ml-auto p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-150"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
