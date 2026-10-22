/**
 * Lightweight local learning history.
 * The Coze deployment has no per-user history table, so the new app keeps it in
 * localStorage (max 50 records) and stays compatible with the old UI fields.
 */
const STORAGE_KEY = 'linguamate.history.v1';
const MAX_RECORDS = 50;
const EVENT_NAME = 'linguamate:history-changed';

function hasStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function emitChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }
}

export function getHistoryRecords() {
  if (!hasStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((record) => record && typeof record === 'object');
  } catch {
    return [];
  }
}

export function addHistoryRecord(record) {
  if (!hasStorage()) return null;

  const item = {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
    ...record,
  };

  const next = [item, ...getHistoryRecords()].slice(0, MAX_RECORDS);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    emitChange();
  } catch (error) {
    console.warn('保存学习记录失败:', error);
    return null;
  }

  return item;
}

export function deleteHistoryRecord(id) {
  if (!hasStorage()) return;

  const next = getHistoryRecords().filter((record) => record.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  emitChange();
}

export function clearHistoryRecords() {
  if (!hasStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
  emitChange();
}

export const HISTORY_EVENT = EVENT_NAME;
