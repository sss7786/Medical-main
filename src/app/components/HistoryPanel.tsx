import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History, Trash2, Plus, X, FileText, Clock, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { fetchSessions, deleteSession } from '@/api/client';
import type { SessionInfo } from '@/types/report';
import { toast } from 'sonner';
import { cn } from './ui/utils';

interface HistoryPanelProps {
  open: boolean;
  currentSessionId: string;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
}

function formatTime(str: string): string {
  if (!str) return '';
  const d = new Date(str.replace(' ', 'T'));
  if (isNaN(d.getTime())) return str;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  if (days === 1) return `昨天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  if (days < 7) return `${days}天前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function HistoryPanel({
  open,
  currentSessionId,
  onClose,
  onSelectSession,
  onNewSession,
}: HistoryPanelProps) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchSessions();
      setSessions(list);
    } catch {
      // 后端可能未启动，静默处理
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadSessions();
  }, [open, loadSessions]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('确定删除此会话记录？')) return;
    setDeletingId(id);
    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success('会话已删除');
      if (id === currentSessionId) {
        onNewSession();
      }
    } catch {
      toast.error('删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 蒙层 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* 侧边栏 */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 left-0 z-[110] w-80 bg-card border-r shadow-xl flex flex-col"
          >
            {/* 头部 */}
            <div className="h-16 border-b flex items-center justify-between px-4 bg-card/95 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-base">历史问诊记录</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 新建按钮 */}
            <div className="p-3 border-b">
              <Button
                className="w-full gap-2"
                onClick={() => { onNewSession(); onClose(); }}
              >
                <Plus className="w-4 h-4" />
                新建问诊会话
              </Button>
            </div>

            {/* 会话列表 */}
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {loading && (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    加载中…
                  </div>
                )}

                {!loading && sessions.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">暂无历史记录</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      完成问诊并刷新报告后会自动保存
                    </p>
                  </div>
                )}

                {!loading && sessions.map((session) => {
                  const isActive = session.id === currentSessionId;
                  const isDeleting = deletingId === session.id;
                  return (
                    <motion.button
                      key={session.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      onClick={() => { onSelectSession(session.id); onClose(); }}
                      disabled={isDeleting}
                      className={cn(
                        'w-full text-left rounded-lg px-3 py-2.5 group flex items-start gap-2.5 transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted/60 text-foreground',
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                        isActive ? 'bg-primary/20' : 'bg-muted',
                      )}>
                        <FileText className={cn('w-4 h-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-medium truncate', isActive && 'text-primary')}>
                          {session.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3 text-muted-foreground/60" />
                          <span className="text-xs text-muted-foreground/70">
                            {formatTime(session.updated_at)}
                          </span>
                          {session.has_report && (
                            <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-1.5 rounded-full">
                              有报告
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => handleDelete(e, session.id)}
                          className="p-1 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
                          aria-label="删除"
                          title="删除此会话"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </ScrollArea>

            {/* 底部说明 */}
            <div className="p-3 border-t">
              <p className="text-xs text-muted-foreground/60 text-center leading-relaxed">
                会话数据存储于本地服务器，仅供本机访问
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
