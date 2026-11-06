import { getHistoryClient } from './supabaseClient';
import { HistoryTransport } from './historyRepository';
import { InterviewSession } from './storageService';

export const cloudHistory: HistoryTransport = {
  async list(owner) {
    const client = await getHistoryClient(owner);
    const sessions: InterviewSession[] = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await client.from('interview_sessions').select('payload').eq('user_id', owner)
        .order('created_at', { ascending: false }).order('id').range(offset, offset + 99);
      if (error) throw error;
      sessions.push(...(data || []).map(row => row.payload as InterviewSession));
      if (!data || data.length < 100) return sessions;
    }
  },
  async upsert(owner, session) {
    const client = await getHistoryClient(owner);
    const { error } = await client.from('interview_sessions').upsert({ user_id: owner, id: session.id, payload: session }, { onConflict: 'user_id,id' });
    if (error) throw error;
  },
  async remove(owner, id) {
    const client = await getHistoryClient(owner);
    let query = client.from('interview_sessions').delete().eq('user_id', owner);
    if (id) query = query.eq('id', id);
    const { error } = await query;
    if (error) throw error;
  }
};
