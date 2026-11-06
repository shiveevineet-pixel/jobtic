import { useDialogFocus } from '../hooks/useDialogFocus';

export default function ConfirmDialog({ message, onResolve }: { message: string; onResolve: (value: boolean) => void }) {
  const ref = useDialogFocus(true, () => onResolve(false));
  return <div className="modal-overlay" onClick={() => onResolve(false)}><div className="modal-content confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message" ref={ref} tabIndex={-1} onClick={event => event.stopPropagation()}><span className="eyebrow">Before you continue</span><h3 id="confirmation-title">Just a quick check.</h3><p id="confirmation-message">{message}</p><div className="action-bar"><button className="btn-secondary" onClick={() => onResolve(false)}>Cancel</button><button className="btn-primary" onClick={() => onResolve(true)}>Continue</button></div></div></div>;
}
