import type { ReportBundle, SessionInfo, SessionDetail } from '@/types/report';
import { coerceReport } from '@/utils/reportMap';

/**
 * 开发环境用相对路径 `/api`，由 Vite 代理到本机 8000（见 vite.config.ts）。
 */
function apiPrefix(): string {
  let fromEnv = import.meta.env.VITE_API_BASE?.trim().replace(/\/$/, '');
  if (fromEnv) {
    if (fromEnv.endsWith('/api')) {
      fromEnv = fromEnv.slice(0, -4);
    }
    return `${fromEnv}/api`;
  }
  if (import.meta.env.DEV) return '/api';
  return '/api';
}

const getApiPrefix = () => apiPrefix();

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  reply: string;
  emergency_detected: boolean;
  demo_mode?: boolean;
}

async function parseJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function postChat(payload: {
  messages: ChatMessage[];
  session_id: string;
}): Promise<ChatResponse> {
  const res = await fetch(`${getApiPrefix()}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data?.detail || data?.message || `chat failed: ${res.status}`);
  }
  return data as ChatResponse;
}

export interface ChatStreamMeta {
  emergency_detected: boolean;
  demo_mode: boolean;
}

/**
 * NDJSON 流：每行 JSON，type 为 meta | delta | done
 */
export async function postChatStream(
  payload: { messages: ChatMessage[]; session_id: string },
  handlers: {
    onMeta: (m: ChatStreamMeta) => void;
    onDelta: (text: string) => void;
  },
): Promise<void> {
  const res = await fetch(`${getApiPrefix()}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/x-ndjson, application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = !res.ok ? await parseJson(res) : null;
  if (!res.ok) {
    throw new Error(data?.detail || data?.message || `chat stream failed: ${res.status}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    for (;;) {
      const nl = buf.indexOf('\n');
      if (nl < 0) break;
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let o: {
        type: string;
        text?: string;
        emergency_detected?: boolean;
        demo_mode?: boolean;
      };
      try {
        o = JSON.parse(line);
      } catch {
        continue;
      }
      if (o.type === 'meta') {
        handlers.onMeta({
          emergency_detected: !!o.emergency_detected,
          demo_mode: !!o.demo_mode,
        });
      } else if (o.type === 'delta' && o.text) {
        handlers.onDelta(o.text);
      } else if (o.type === 'done') {
        return;
      }
    }
  }
}

export async function getHealth(): Promise<Record<string, unknown>> {
  const res = await fetch(`${getApiPrefix()}/health`);
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data?.detail || `health failed: ${res.status}`);
  }
  return (data ?? {}) as Record<string, unknown>;
}

export async function postSynthesize(payload: {
  messages: ChatMessage[];
  session_id: string;
  form_hints?: string[];
}): Promise<ReportBundle> {
  const res = await fetch(`${getApiPrefix()}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data?.detail || data?.message || `synthesize failed: ${res.status}`);
  }
  return coerceReport(data as Record<string, unknown>);
}

export async function postExtractPdf(file: File): Promise<{ text: string; pages: number }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${getApiPrefix()}/extract-pdf`, {
    method: 'POST',
    body: fd,
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data?.detail || `extract failed: ${res.status}`);
  }
  return data as { text: string; pages: number };
}

// ── 历史会话 API ──────────────────────────────────────────────────────────────

export async function fetchSessions(): Promise<SessionInfo[]> {
  const res = await fetch(`${getApiPrefix()}/sessions`);
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.detail || 'fetch sessions failed');
  return (data ?? []) as SessionInfo[];
}

export async function fetchSession(sessionId: string): Promise<SessionDetail> {
  const res = await fetch(`${getApiPrefix()}/sessions/${sessionId}`);
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.detail || 'fetch session failed');
  return data as SessionDetail;
}

export async function saveSession(payload: {
  session_id: string;
  title: string;
  messages: ChatMessage[];
  form_hints: string[];
  report: ReportBundle | null;
}): Promise<void> {
  const res = await fetch(`${getApiPrefix()}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await parseJson(res);
    throw new Error(data?.detail || 'save session failed');
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`${getApiPrefix()}/sessions/${sessionId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await parseJson(res);
    throw new Error(data?.detail || 'delete session failed');
  }
}
