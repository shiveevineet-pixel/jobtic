import { confirmAction } from '../services/confirmAction';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Moon, Sun, Play, Trash2, Lightbulb } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useSpeech } from '../hooks/useSpeech';
import { useDialogFocus } from '../hooks/useDialogFocus';

export const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void; onClearHistory: () => void }> = ({ isOpen, onClose, onClearHistory }) => {
  const { settings, updateSettings } = useSettings();
  const { updateProfileName, user } = useAuth();
  const { voices, speakText, stopSpeaking } = useSpeech();
  const [testingVoice, setTestingVoice] = useState(false);
  const [localName, setLocalName] = useState(settings.userName);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const dialogRef = useDialogFocus(isOpen, onClose);
  useEffect(() => { setLocalName(settings.userName); }, [settings.userName]);
  useEffect(() => { if (!isOpen) { stopSpeaking(); setTestingVoice(false); setMessage(''); } }, [isOpen, stopSpeaking]);
  const english = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
  const displayVoices = english.length ? english : voices;
  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!localName.trim()) { setMessage('Please enter a name.'); return; }
    setSaving(true);
    try { await updateProfileName(localName.trim()); updateSettings({ userName: localName.trim() }); setMessage('Name updated.'); }
    catch { setMessage('Could not update your name. Please try again.'); }
    finally { setSaving(false); }
  };
  const testVoice = () => {
    setTestingVoice(true);
    speakText('Hello. Let’s take your next interview one question at a time.', { voiceEnabled: true, rate: settings.voiceRate, pitch: settings.voicePitch, voiceName: settings.voiceName }, () => setTestingVoice(false));
  };
  if (!isOpen) return null;
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div ref={dialogRef} className="modal-content" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><div><span className="eyebrow">Make yourself comfortable</span><h3 id="settings-title">Settings & preferences</h3></div><button className="modal-close-btn" onClick={onClose} aria-label="Close settings"><X size={20} /></button></div>
        <section className="settings-group"><h4>Your profile</h4><form onSubmit={saveName} className="form-group"><label htmlFor="settings-name">Display name</label><div className="field-grid"><input id="settings-name" value={localName} onChange={e => setLocalName(e.target.value)} placeholder="Your name" required maxLength={80} /><button className="btn-secondary" disabled={saving}>{saving ? 'Saving…' : 'Save name'}</button></div></form>{message && <p className="caption" role="status">{message}</p>}</section>
        <section className="settings-group"><h4>Appearance</h4><div className="setting-row"><div className="setting-label"><span className="setting-title">{settings.theme === 'dark' ? 'Obsidian studio' : 'Ivory studio'}</span><span className="setting-desc">Pure black & white, for day or evening.</span></div><button className="icon-btn" onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })} aria-label="Toggle theme">{settings.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button></div></section>
        <section className="settings-group"><h4>Interview voice</h4><div className="setting-row"><div className="setting-label"><span className="setting-title">Read questions aloud</span><span className="setting-desc">Text stays available in every session.</span></div><label className="switch"><input type="checkbox" aria-label="Read questions aloud" checked={settings.voiceEnabled} onChange={e => updateSettings({ voiceEnabled: e.target.checked })} /><span className="slider" /></label></div>
          {settings.voiceEnabled && <><div className="form-group"><label htmlFor="settings-voice">Interviewer voice</label><select id="settings-voice" value={settings.voiceName} onChange={e => updateSettings({ voiceName: e.target.value })}><option value="">Device default</option>{displayVoices.map(v => <option key={v.name} value={v.name}>{v.friendlyName || v.name}</option>)}</select></div><div className="field-grid"><div className="form-group"><label htmlFor="voice-speed">Speed · {settings.voiceRate.toFixed(1)}×</label><input id="voice-speed" type="range" min="0.7" max="1.4" step="0.1" value={settings.voiceRate} onChange={e => updateSettings({ voiceRate: Number(e.target.value) })} /></div><div className="form-group"><label htmlFor="voice-pitch">Pitch · {settings.voicePitch.toFixed(1)}</label><input id="voice-pitch" type="range" min="0.7" max="1.3" step="0.1" value={settings.voicePitch} onChange={e => updateSettings({ voicePitch: Number(e.target.value) })} /></div></div><button className="btn-secondary" onClick={testingVoice ? () => { stopSpeaking(); setTestingVoice(false); } : testVoice}><Play size={16} />{testingVoice ? 'Stop preview' : 'Preview voice'}</button></>}
          <details className="context-details"><summary><span><Lightbulb size={14} /> Voice troubleshooting</span></summary><p className="caption">On Android, install or select a text-to-speech voice in your phone’s settings. Allow microphone access for transcription. If speech recognition isn’t supported, switch to typing in your practice room.</p></details>
        </section>
        <section className="settings-group"><h4>{user ? 'Your account history' : 'Guest history on this device'}</h4><p className="caption">{user ? 'Clearing removes your account’s saved interviews from this device and the cloud after syncing. Other accounts are not affected.' : 'Clearing removes only guest interviews on this device.'} It does not delete your account.</p><button className="btn-danger" onClick={async () => { if (await confirmAction('Permanently clear your interview history? Cloud deletion will sync when connected. Other accounts are not affected.')) { onClearHistory(); setMessage('History deletion requested. Check the workspace sync status.'); } }}><Trash2 size={16} />Clear interview history</button></section>
      </div>
    </div>, document.body
  );
};
