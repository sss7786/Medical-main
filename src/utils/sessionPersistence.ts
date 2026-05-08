import type { ChatMessage } from '@/api/client';
import type { ReportBundle } from '@/types/report';

export const MEDBRIEF_STORAGE_KEY = 'medbrief_session_v1';

export interface MedBriefPersistV1 {
  version: 1;
  sessionId: string;
  apiMessages: ChatMessage[];
  formHints: string[];
  report: ReportBundle | null;
  /** 与上次成功「刷新报告」时一致的 fingerprint；用于提示报告可能过期 */
  lastSyncFingerprint: string;
}

export function fingerprintData(
  apiMessages: ChatMessage[],
  formHints: string[],
): string {
  return JSON.stringify({ m: apiMessages, h: formHints });
}

export function loadMedBrief(): MedBriefPersistV1 | null {
  try {
    const raw = localStorage.getItem(MEDBRIEF_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as MedBriefPersistV1;
    if (o?.version !== 1 || typeof o.sessionId !== 'string') return null;
    return {
      version: 1,
      sessionId: o.sessionId,
      apiMessages: Array.isArray(o.apiMessages) ? o.apiMessages : [],
      formHints: Array.isArray(o.formHints) ? o.formHints : [],
      report: o.report ?? null,
      lastSyncFingerprint:
        typeof o.lastSyncFingerprint === 'string' ? o.lastSyncFingerprint : '',
    };
  } catch {
    return null;
  }
}

export function saveMedBrief(data: MedBriefPersistV1): void {
  try {
    localStorage.setItem(MEDBRIEF_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* 存储配额或隐私模式 */
  }
}

/** 移除本机「当前草稿」持久化；不影响后端历史列表中的会话条目。 */
export function clearMedBrief(): void {
  try {
    localStorage.removeItem(MEDBRIEF_STORAGE_KEY);
  } catch {
    /* private mode */
  }
}
