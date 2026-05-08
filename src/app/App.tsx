import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import '../i18n/config';
import i18n from '@/i18n/config';
import { Header } from "./components/Header";
import { LeftPanel } from "./components/LeftPanel";
import { RightPanel } from "./components/RightPanel";
import { PrintableReport } from "./components/PrintableReport";
import { HistoryPanel } from "./components/HistoryPanel";
import { Toaster } from "./components/ui/sonner";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "./components/ui/sheet";
import type { ChatMessage } from '@/api/client';
import type { ReportBundle } from '@/types/report';
import { postSynthesize, saveSession, fetchSession } from '@/api/client';
import { toast } from 'sonner';
import {
  clearMedBrief,
  fingerprintData,
  loadMedBrief,
  saveMedBrief,
} from '@/utils/sessionPersistence';
import {
  readStoredScenario,
  writeStoredScenario,
  type ConsultScenarioId,
} from '@/utils/consultScenarios';
import {
  buildVisitExportBundle,
  downloadTextFile,
  visitExportToJson,
  visitExportToMarkdown,
  type VisitExportMarkdownLabels,
} from '@/utils/visitExport';

function readInitialAppState() {
  const p = loadMedBrief();
  if (!p) {
    return {
      sessionId: crypto.randomUUID(),
      apiMessages: [] as ChatMessage[],
      formHints: [] as string[],
      report: null as ReportBundle | null,
      lastSyncFingerprint: '',
    };
  }
  const apiMessages = p.apiMessages ?? [];
  const formHints = p.formHints ?? [];
  return {
    sessionId: p.sessionId,
    apiMessages,
    formHints,
    report: p.report ?? null,
    lastSyncFingerprint:
      p.report && apiMessages.length > 0
        ? fingerprintData(apiMessages, formHints)
        : p.lastSyncFingerprint ?? '',
  };
}

/** 从 messages 自动生成会话标题 */
function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user')?.content;
  if (!first) return '新问诊';
  return first.slice(0, 18) + (first.length > 18 ? '…' : '');
}

export default function App() {
  const { t } = useTranslation();
  const initRef = useRef<ReturnType<typeof readInitialAppState> | null>(null);
  const getInit = () => {
    if (!initRef.current) initRef.current = readInitialAppState();
    return initRef.current;
  };

  const printRef = useRef<HTMLDivElement>(null);
  const [sessionId, setSessionId] = useState(() => getInit().sessionId);
  const [apiMessages, setApiMessages] = useState<ChatMessage[]>(() => getInit().apiMessages);
  const [formHints, setFormHints] = useState<string[]>(() => getInit().formHints);
  const [report, setReport] = useState<ReportBundle | null>(() => getInit().report);
  const [lastSyncFingerprint, setLastSyncFingerprint] = useState(() => getInit().lastSyncFingerprint);
  const [refreshing, setRefreshing] = useState(false);
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [scenarioId, setScenarioId] = useState<ConsultScenarioId>(() => readStoredScenario());

  useEffect(() => {
    writeStoredScenario(scenarioId);
  }, [scenarioId]);

  // 持久化到 localStorage（防抖）
  useEffect(() => {
    const id = window.setTimeout(() => {
      saveMedBrief({
        version: 1,
        sessionId,
        apiMessages,
        formHints,
        report,
        lastSyncFingerprint,
      });
    }, 450);
    return () => clearTimeout(id);
  }, [sessionId, apiMessages, formHints, report, lastSyncFingerprint]);

  // 持久化到后端 SQLite（500ms 防抖）
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (apiMessages.length === 0 && formHints.length === 0) return;
      saveSession({
        session_id: sessionId,
        title: deriveTitle(apiMessages),
        messages: apiMessages,
        form_hints: formHints,
        report,
      }).catch(() => { /* 后端未启动时静默失败 */ });
    }, 500);
    return () => clearTimeout(id);
  }, [sessionId, apiMessages, formHints, report]);

  const appendFormHint = useCallback((hint: string) => {
    setFormHints((prev) => [...prev, hint]);
  }, []);

  const setTranscript = useCallback((msgs: ChatMessage[]) => {
    setApiMessages(msgs);
  }, []);

  const canRefresh = useMemo(
    () =>
      apiMessages.some((m) => m.role === 'user' && m.content.trim().length > 0) ||
      formHints.length > 0,
    [apiMessages, formHints],
  );

  const dataFingerprint = useMemo(
    () => fingerprintData(apiMessages, formHints),
    [apiMessages, formHints],
  );

  const showStaleReportHint = canRefresh && dataFingerprint !== lastSyncFingerprint;

  const exportMdLabels: VisitExportMarkdownLabels = useMemo(
    () => ({
      docTitle: t('export.md.docTitle'),
      exportedAt: t('export.md.exportedAt'),
      scenario: t('export.md.scenario'),
      sessionId: t('export.md.sessionId'),
      locale: t('export.md.locale'),
      sectionChat: t('export.md.sectionChat'),
      sectionHints: t('export.md.sectionHints'),
      sectionReport: t('export.md.sectionReport'),
      emptyChat: t('export.md.emptyChat'),
      emptyHints: t('export.md.emptyHints'),
      noReport: t('export.md.noReport'),
      basicInfo: t('export.md.basicInfo'),
      colField: t('export.md.colField'),
      colValue: t('export.md.colValue'),
      name: t('export.md.name'),
      gender: t('export.md.gender'),
      age: t('export.md.age'),
      visitDate: t('export.md.visitDate'),
      department: t('export.md.department'),
      primary: t('export.md.primary'),
      secondary: t('export.md.secondary'),
      reason: t('export.md.reason'),
      timeline: t('export.md.timeline'),
      medications: t('export.md.medications'),
      allergies: t('export.md.allergies'),
      questions: t('export.md.questions'),
      checklist: t('export.md.checklist'),
      reportGenerated: t('export.md.reportGenerated'),
      footer: t('export.md.footer'),
      roleUser: t('export.md.roleUser'),
      roleAssistant: t('export.md.roleAssistant'),
    }),
    [t],
  );

  const runSynthesize = useCallback(async () => {
    if (!canRefresh) {
      toast.warning('请先在左侧对话、上传 PDF，或在「分步表单」里用「快速选择」至少记录一条要点。');
      return;
    }
    setRefreshing(true);
    try {
      const bundle = await postSynthesize({
        session_id: sessionId,
        messages: apiMessages,
        form_hints: formHints,
      });
      setReport(bundle);
      setLastSyncFingerprint(fingerprintData(apiMessages, formHints));
      toast.success('已从对话生成结构化报告');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('刷新失败：' + msg);
    } finally {
      setRefreshing(false);
    }
  }, [apiMessages, formHints, sessionId, canRefresh]);

  const resetToFreshSession = useCallback(() => {
    const newId = crypto.randomUUID();
    setSessionId(newId);
    setApiMessages([]);
    setFormHints([]);
    setReport(null);
    setLastSyncFingerprint('');
    initRef.current = null;
  }, []);

  /** 新建会话 */
  const handleNewSession = useCallback(() => {
    resetToFreshSession();
    toast.success('已新建问诊会话');
  }, [resetToFreshSession]);

  /** 一键清空：删除本机草稿并重置界面 */
  const handleClearLocalSession = useCallback(() => {
    clearMedBrief();
    resetToFreshSession();
    toast.success(t('header.clearSessionSuccess'));
  }, [resetToFreshSession, t]);

  const handleExportJson = useCallback(() => {
    const hasUser = apiMessages.some((m) => m.role === 'user' && m.content.trim().length > 0);
    const hasContent = hasUser || formHints.length > 0 || report != null;
    if (!hasContent) {
      toast.warning(t('export.empty'));
      return;
    }
    const bundle = buildVisitExportBundle({
      sessionId,
      scenarioId,
      scenarioLabel: t(`scenarios.${scenarioId}`),
      messages: apiMessages,
      formHints,
      report,
      locale: i18n.language || 'zh',
      disclaimer: t('disclaimer.description'),
    });
    const safe = sessionId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 12) || 'visit';
    downloadTextFile(
      `MedBrief_visit_${safe}.json`,
      visitExportToJson(bundle),
      'application/json;charset=utf-8',
    );
    toast.success(t('export.jsonSuccess'));
  }, [apiMessages, formHints, report, sessionId, scenarioId, t]);

  const handleExportMarkdown = useCallback(() => {
    const hasUser = apiMessages.some((m) => m.role === 'user' && m.content.trim().length > 0);
    const hasContent = hasUser || formHints.length > 0 || report != null;
    if (!hasContent) {
      toast.warning(t('export.empty'));
      return;
    }
    const bundle = buildVisitExportBundle({
      sessionId,
      scenarioId,
      scenarioLabel: t(`scenarios.${scenarioId}`),
      messages: apiMessages,
      formHints,
      report,
      locale: i18n.language || 'zh',
      disclaimer: t('disclaimer.description'),
    });
    const safe = sessionId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 12) || 'visit';
    downloadTextFile(
      `MedBrief_visit_${safe}.md`,
      visitExportToMarkdown(bundle, exportMdLabels),
      'text/markdown;charset=utf-8',
    );
    toast.success(t('export.markdownSuccess'));
  }, [apiMessages, exportMdLabels, formHints, report, sessionId, scenarioId, t]);

  /** 切换到历史会话 */
  const handleSelectSession = useCallback(async (sid: string) => {
    try {
      const detail = await fetchSession(sid);
      setSessionId(detail.id);
      setApiMessages(detail.messages as ChatMessage[]);
      setFormHints(detail.form_hints);
      setReport(detail.report);
      const fp = fingerprintData(detail.messages as ChatMessage[], detail.form_hints);
      setLastSyncFingerprint(detail.report ? fp : '');
      initRef.current = null;
      toast.success(`已切换到会话：${detail.title}`);
    } catch (e) {
      toast.error('加载会话失败：' + (e instanceof Error ? e.message : String(e)));
    }
  }, []);

  return (
    <div className="flex h-dvh max-h-dvh max-w-[100vw] flex-col overflow-hidden bg-background overflow-x-hidden">
      <Header
        printRef={printRef}
        onOpenHistory={() => setHistoryOpen(true)}
        onClearLocalSession={handleClearLocalSession}
        scenarioId={scenarioId}
        onScenarioChange={setScenarioId}
        onExportJson={handleExportJson}
        onExportMarkdown={handleExportMarkdown}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative flex min-h-0 w-full flex-col overflow-hidden border-r bg-card md:w-[40%]">
          <LeftPanel
            key={sessionId}
            sessionId={sessionId}
            scenarioId={scenarioId}
            initialChatMessages={apiMessages}
            onTranscriptChange={setTranscript}
            onFormHint={appendFormHint}
          />
        </div>

        <div className="hidden min-h-0 flex-1 overflow-hidden bg-background md:block">
          <RightPanel
            report={report}
            refreshing={refreshing}
            onRefresh={runSynthesize}
            onReportChange={setReport}
            canRefresh={canRefresh}
            staleReportHint={showStaleReportHint}
          />
        </div>
      </div>

      {/* 移动端报告 Sheet */}
      <Sheet open={reportSheetOpen} onOpenChange={setReportSheetOpen}>
        <SheetContent
          side="right"
          className="flex h-[100dvh] max-h-[100dvh] w-[100vw] max-w-full flex-col gap-0 border-l p-0 pt-[env(safe-area-inset-top,0px)] sm:h-full sm:max-h-none sm:max-w-xl [&>button]:right-[max(1rem,env(safe-area-inset-right))] [&>button]:top-[max(1rem,env(safe-area-inset-top))] [&>button]:z-[70]"
          aria-describedby={undefined}
        >
          <SheetTitle className="sr-only">{t("report.title")}</SheetTitle>
          <div className="min-h-0 flex-1 overflow-hidden">
            <RightPanel
              report={report}
              refreshing={refreshing}
              onRefresh={runSynthesize}
              onReportChange={setReport}
              canRefresh={canRefresh}
              sheetLayout
              staleReportHint={showStaleReportHint}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* 移动端浮动按钮（打开报告）：避开全面屏底部横条与安全区 */}
      {!reportSheetOpen ? (
      <button
        type="button"
        className="md:hidden fixed z-50 flex h-14 min-h-[44px] w-14 min-w-[44px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/30 transition-transform active:scale-95 hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100"
        style={{
          bottom: 'max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))',
          right: 'max(1.25rem, env(safe-area-inset-right, 0px))',
        }}
        aria-label={t("report.openSheet")}
        onClick={() => setReportSheetOpen(true)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </button>
      ) : null}

      {/* 隐藏打印区 */}
      <div className="hidden">
        <PrintableReport ref={printRef} report={report} />
      </div>

      {/* 历史会话侧边栏 */}
      <HistoryPanel
        open={historyOpen}
        currentSessionId={sessionId}
        onClose={() => setHistoryOpen(false)}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
      />

      <Toaster />
    </div>
  );
}
