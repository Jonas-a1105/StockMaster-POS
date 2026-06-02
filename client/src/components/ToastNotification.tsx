import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { CheckCircle, AlertTriangle, Info, XCircle, X } from 'lucide-react';

// ── Types ──
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, default 4000
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

// ── Context ──
const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ── Provider Component ──
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [exiting, setExiting] = useState<Set<string>>(new Set());

  const removeToast = useCallback((id: string) => {
    setExiting(prev => new Set(prev).add(id));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      setExiting(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300); // Match CSS animation duration
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newToast: Toast = { ...toast, id, duration: toast.duration ?? 4000 };
    setToasts(prev => [...prev, newToast]);

    // Auto-dismiss
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => removeToast(id), newToast.duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} exiting={exiting} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

// ── Toast Container ──
function ToastContainer({ toasts, exiting, onRemove }: {
  toasts: Toast[];
  exiting: Set<string>;
  onRemove: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="alert" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          isExiting={exiting.has(toast.id)}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

// ── Individual Toast ──
function ToastItem({ toast, isExiting, onRemove }: {
  toast: Toast;
  isExiting: boolean;
  onRemove: (id: string) => void;
}) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return;
    const interval = 50;
    const step = (interval / toast.duration) * 100;
    const timer = setInterval(() => {
      setProgress(prev => {
        const next = prev - step;
        return next <= 0 ? 0 : next;
      });
    }, interval);
    return () => clearInterval(timer);
  }, [toast.duration]);

  const icons = {
    success: <CheckCircle size={18} />,
    error: <XCircle size={18} />,
    warning: <AlertTriangle size={18} />,
    info: <Info size={18} />,
  };

  const colorClasses: Record<ToastType, string> = {
    success: 'toast-success',
    error: 'toast-error',
    warning: 'toast-warning',
    info: 'toast-info',
  };

  return (
    <div className={`toast-item ${colorClasses[toast.type]} ${isExiting ? 'toast-exit' : 'toast-enter'}`}>
      <div className="toast-icon">{icons[toast.type]}</div>
      <div className="toast-content">
        <span className="toast-title">{toast.title}</span>
        {toast.message && <span className="toast-message">{toast.message}</span>}
      </div>
      <button className="toast-close" onClick={() => onRemove(toast.id)}>
        <X size={14} />
      </button>
      {toast.duration && toast.duration > 0 && (
        <div className="toast-progress-track">
          <div
            className="toast-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
