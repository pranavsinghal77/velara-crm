import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type ToastTone = 'info' | 'success' | 'warning';

interface ToastProps {
  /** Falsy renders nothing, so a caller can pass its notice state directly. */
  message: string;
  tone?: ToastTone;
  /** Time on screen before it starts leaving. */
  durationMs?: number;
  /** Called once the exit animation has finished, to clear the message. */
  onDismiss: () => void;
}

const TONE: Record<ToastTone, { className: string; Icon: typeof Info }> = {
  info: { className: 'bg-slate-900 text-white border-slate-700', Icon: Info },
  success: { className: 'bg-emerald-600 text-white border-emerald-500', Icon: CheckCircle2 },
  warning: { className: 'bg-amber-500 text-white border-amber-400', Icon: AlertTriangle },
};

/**
 * A transient notice that animates in and back out.
 *
 * Two things it fixes beyond adding motion. The notices it replaces vanished
 * on a timer with no exit at all, so a message the reader had started on
 * simply blinked out of existence. And the one in the layout was an inline
 * banner, which pushed the entire page down as it appeared and yanked it back
 * up as it went; floating it means a status message no longer moves the
 * content someone is reading.
 *
 * Keyed on the message, so each new notice is a fresh mount that gets its own
 * full display time rather than inheriting whatever was left of the last one's
 * countdown.
 */
export default function Toast({ message, ...rest }: ToastProps) {
  if (!message) return null;

  return <ToastBody key={message} message={message} {...rest} />;
}

function ToastBody({ message, tone = 'info', durationMs = 2600, onDismiss }: ToastProps) {
  const [leaving, setLeaving] = useState(false);
  const { className, Icon } = TONE[tone];

  useEffect(() => {
    const startExit = setTimeout(() => setLeaving(true), durationMs);
    return () => clearTimeout(startExit);
  }, [durationMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      /*
        Unmounting is driven by the animation actually finishing rather than by
        a second timer set to the same length as the CSS. A duplicated duration
        is a duration that will eventually disagree with the stylesheet, and
        this way the exit also works at the near-zero duration that reduced
        motion forces.
      */
      onAnimationEnd={(e) => {
        if (leaving && e.target === e.currentTarget) onDismiss();
      }}
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-xs font-semibold shadow-xl shadow-slate-900/20 ${className} ${
        leaving ? 'toast-leave' : 'toast-enter'
      }`}
    >
      <Icon size={15} className="flex-shrink-0" />
      <span>{message}</span>
      <button
        type="button"
        onClick={() => setLeaving(true)}
        aria-label="Dismiss notification"
        className="ml-1 -mr-1 rounded p-0.5 opacity-70 hover:opacity-100 transition-opacity"
      >
        <X size={13} />
      </button>
    </div>
  );
}
