import React, { useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';

/** Explicit development preview; iframe gives every screen a real phone viewport. */
export const PCPreviewSimulator: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const enabled = import.meta.env.DEV && window.self === window.top && new URLSearchParams(window.location.search).get('preview') === 'phone';
  const [preview, setPreview] = useState(enabled);
  if (preview) return <div className="simulator-mode-active"><div className="simulator-top-bar"><span className="simulator-title">Development · Phone preview</span><button className="btn-secondary" onClick={() => setPreview(false)}><Monitor size={16} />Workspace</button></div><div className="phone-wrapper"><iframe className="phone-preview-frame" src="/?frame=phone" title="Jobtic responsive phone preview" /></div></div>;
  return <div className="app-container">{children}{enabled && <button className="btn-secondary preview-toggle" onClick={() => setPreview(true)}><Smartphone size={16} />Phone preview</button>}</div>;
};
export default PCPreviewSimulator;
