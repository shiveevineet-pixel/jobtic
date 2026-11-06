import { InterviewSession, storageService } from './storageService';

export interface HistoryTransport {
  list: (owner: string) => Promise<InterviewSession[]>;
  upsert: (owner: string, session: InterviewSession) => Promise<void>;
  remove: (owner: string, id?: string) => Promise<void>;
}
type Pending = { clear?: string; changes: Record<string, { version: string; session: InterviewSession | null }> };
const accountSyncs = new Map<string, Promise<InterviewSession[]>>();

// A durable outbox belongs to one immutable account, never the current global user.
export function createHistoryRepository(owner: string | null, transport: HistoryTransport) {
  const scope = owner ? `user:${owner}` : 'guest';
  const key = `jobtic_history_outbox:${scope}`;
  let revision = 0;
  const read = (): Pending => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : { changes: {} };
  };
  const write = (pending: Pending) => localStorage.setItem(key, JSON.stringify(pending));
  const version = () => `${Date.now()}:${++revision}:${Math.random()}`;
  const flush = async () => {
    for (;;) {
      const pending = read();
      if (pending.clear) {
        await transport.remove(owner!);
        const latest = read();
        if (latest.clear === pending.clear) { delete latest.clear; write(latest); }
        continue;
      }
      const entry = Object.entries(pending.changes)[0];
      if (!entry) break;
      const [id, change] = entry;
      if (change.session) await transport.upsert(owner!, change.session);
      else await transport.remove(owner!, id);
      const latest = read();
      if (latest.changes[id]?.version === change.version) { delete latest.changes[id]; write(latest); }
    }
    const remote = await transport.list(owner!);
    const pending = read();
    const merged = new Map((pending.clear ? [] : remote).map(session => [session.id, session]));
    for (const [id, change] of Object.entries(pending.changes)) {
      if (change.session) merged.set(id, change.session); else merged.delete(id);
    }
    const sessions = [...merged.values()];
    storageService.replaceSessions(sessions, scope);
    return sessions;
  };
  return {
    list: () => storageService.getSessions(scope),
    pending: () => !!owner && (!!read().clear || Object.keys(read().changes).length > 0),
    save(session: InterviewSession) {
      if (owner) { const pending = read(); pending.changes[session.id] = { version: version(), session }; write(pending); }
      storageService.saveSession(session, scope);
    },
    remove(id: string) {
      if (owner) { const pending = read(); pending.changes[id] = { version: version(), session: null }; write(pending); }
      storageService.deleteSession(id, scope);
    },
    clear() {
      if (owner) write({ clear: version(), changes: {} });
      storageService.clearSessions(scope);
    },
    sync() {
      if (!owner) return Promise.resolve(storageService.getSessions(scope));
      if (!accountSyncs.has(owner)) accountSyncs.set(owner, flush().finally(() => { accountSyncs.delete(owner); }));
      return accountSyncs.get(owner)!;
    }
  };
}
