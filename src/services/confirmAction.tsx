import { createRoot } from 'react-dom/client';
import ConfirmDialog from '../components/ConfirmDialog';

let showing = false;
/** A single accessible confirmation surface, with safe default focus on Cancel. */
export function confirmAction(message: string): Promise<boolean> {
  if (showing) return Promise.resolve(false);
  showing = true;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  return new Promise(resolve => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      queueMicrotask(() => { root.unmount(); host.remove(); showing = false; resolve(value); });
    };
    root.render(<ConfirmDialog message={message} onResolve={finish} />);
  });
}
