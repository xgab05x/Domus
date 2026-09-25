import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEscape } from "@/hooks/useEscape";

export default function Modal({ open, onClose, title, subtitle, icon, children, footer, width = "max-w-2xl", testid = "modal" }) {
  useEscape(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" data-testid={testid}>
      <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative glass-strong rounded-[28px] w-full ${width} max-h-[90vh] overflow-hidden flex flex-col fade-in`}>
        <div className="flex items-start justify-between gap-3 px-6 py-4 divider border-t-0 border-b">
          <div className="flex items-center gap-3 min-w-0">
            {icon && <div className="icon-btn icon-on w-10 h-10 shrink-0">{icon}</div>}
            <div className="min-w-0">
              <h3 className="font-display text-lg font-semibold leading-tight truncate">{title}</h3>
              {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button data-testid={`${testid}-close`} onClick={onClose} className="btn-ghost w-9 h-9 rounded-full flex items-center justify-center shrink-0" aria-label="Chiudi">
            <X size={17} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-6 py-4 divider flex items-center justify-end gap-2 flex-wrap">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
