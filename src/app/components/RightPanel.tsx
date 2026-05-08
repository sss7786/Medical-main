import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MedicationCards } from "./MedicationCards";
import { QuestionsList } from "./QuestionsList";
import { Checklist } from "./Checklist";
import { SeverityIndicator } from "./SeverityIndicator";
import { DepartmentCard } from "./DepartmentCard";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { FileText, Calendar, RefreshCw, AlertCircle, Pencil, Check, X } from "lucide-react";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { getOverallSeverity } from '../../utils/severityAssessment';
import type { ReportBundle, BasicInfo, TimelineEvent, MedicationItem } from '@/types/report';
import { toast } from 'sonner';
import { cn } from "./ui/utils";
import { motion } from 'motion/react';

interface RightPanelProps {
  report: ReportBundle | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onReportChange?: (updated: ReportBundle) => void;
  canRefresh?: boolean;
  sheetLayout?: boolean;
  staleReportHint?: boolean;
  synthesizeError?: string | null;
  onDismissSynthesizeError?: () => void;
}

// ── 行内可编辑字段 ────────────────────────────────────────────────────────────
function EditableField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    onSave(draft.trim());
    setEditing(false);
    toast.success(`${label} 已更新`);
  };
  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 col-span-1">
        <span className="text-muted-foreground text-sm shrink-0">{label}:</span>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-6 text-xs px-1 py-0 flex-1 min-w-0"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cancel();
          }}
        />
        <button onClick={commit} className="p-0.5 text-green-600 hover:text-green-700 shrink-0">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={cancel} className="p-0.5 text-muted-foreground hover:text-foreground shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 group col-span-1 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <span className="ml-1">{value || '—'}</span>
      <button
        onClick={() => { setDraft(value); setEditing(true); }}
        className="rounded p-1 text-muted-foreground opacity-100 transition-opacity hover:text-foreground md:opacity-0 md:group-hover:opacity-100"
        title={`编辑${label}`}
        type="button"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── 可编辑时间线 ──────────────────────────────────────────────────────────────
function EditableTimeline({
  events,
  onChangeEvents,
}: {
  events: TimelineEvent[];
  onChangeEvents: (evs: TimelineEvent[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const startEdit = (ev: TimelineEvent) => {
    setEditingId(ev.id);
    setDraft(ev.description);
  };

  const commitEdit = (id: string) => {
    onChangeEvents(events.map((e) => (e.id === id ? { ...e, description: draft } : e)));
    setEditingId(null);
    toast.success('时间线条目已更新');
  };

  if (events.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">症状时间线</h3>
          <Badge variant="outline" className="text-xs">自我报告</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          暂无时间线条目。请先通过左侧对话补充症状与时间，再点击右上角「刷新报告」。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">症状时间线</h3>
        <span className="text-xs text-muted-foreground flex items-center gap-1 border border-dashed border-muted-foreground/30 rounded px-1.5 py-0.5">
          <Pencil className="w-2.5 h-2.5" />点击描述可编辑
        </span>
      </div>
      <div className="space-y-4">
        {events.map((event, index) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 }}
            className="flex gap-3 group relative"
          >
            {index < events.length - 1 && (
              <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-border" />
            )}
            <div className={cn(
              'relative z-10 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 shrink-0',
              event.severity === 'high'
                ? 'bg-destructive/10 ring-2 ring-destructive/20'
                : event.severity === 'medium'
                  ? 'bg-amber-500/10 ring-2 ring-amber-500/20'
                  : 'bg-primary/10 ring-2 ring-primary/20',
            )}>
              <div className={cn(
                'w-2.5 h-2.5 rounded-full',
                event.severity === 'high' ? 'bg-destructive'
                  : event.severity === 'medium' ? 'bg-amber-500'
                    : 'bg-primary',
              )} />
            </div>

            <div className="flex-1 pb-4 hover:bg-muted/30 -ml-2 pl-2 pr-3 py-1 rounded-lg transition-colors">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-medium text-sm">{event.day}</span>
                <span className="text-xs text-muted-foreground">{event.date}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs ml-auto',
                    event.severity === 'high' && 'border-destructive/50 text-destructive',
                    event.severity === 'medium' && 'border-amber-500/50 text-amber-600',
                  )}
                >
                  {event.severity === 'high' ? '重度' : event.severity === 'medium' ? '中度' : '轻度'}
                </Badge>
              </div>

              {editingId === event.id ? (
                <div className="flex items-start gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="flex-1 text-sm border rounded px-2 py-1 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    rows={2}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Escape') setEditingId(null); }}
                  />
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => commitEdit(event.id)} className="p-1 text-green-600 hover:text-green-700 rounded">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground hover:text-foreground rounded">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  className="text-sm text-foreground/80 leading-relaxed cursor-pointer hover:text-foreground transition-colors flex items-start gap-1"
                  onClick={() => startEdit(event)}
                  title="点击编辑"
                >
                  <span className="flex-1">{event.description}</span>
                  <Pencil className="w-3 h-3 mt-0.5 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
export function RightPanel({
  report,
  refreshing = false,
  onRefresh,
  onReportChange,
  canRefresh = false,
  sheetLayout = false,
  staleReportHint = false,
  synthesizeError = null,
  onDismissSynthesizeError,
}: RightPanelProps) {
  const { t } = useTranslation();

  const basic = report?.basic_info;
  const timeline = report?.timeline_events ?? [];
  const symptomsForSeverity = timeline.map((e) => ({
    symptom: e.description,
    duration: e.day,
    intensity: e.severity === 'high' ? 7 : e.severity === 'medium' ? 4 : 2,
  }));

  const overallSeverity = getOverallSeverity(
    symptomsForSeverity.length ? symptomsForSeverity : [{ symptom: '（尚未同步）', intensity: 1 }],
  );

  const generated = report?.generated_at || new Date().toLocaleString('zh-CN', { hour12: false });

  const triggerRefresh = () => {
    if (!canRefresh) {
      toast.warning('请先在左侧对话、上传 PDF，或在「分步表单」中点击「快速选择」记录问诊要点。');
      return;
    }
    onRefresh?.();
  };

  const patchBasic = (field: keyof BasicInfo, value: string) => {
    if (!report) return;
    onReportChange?.({ ...report, basic_info: { ...report.basic_info, [field]: value } });
  };

  const patchTimeline = (evs: TimelineEvent[]) => {
    if (!report) return;
    onReportChange?.({ ...report, timeline_events: evs });
  };

  const patchMeds = (meds: MedicationItem[]) => {
    if (!report) return;
    onReportChange?.({ ...report, medications: meds });
  };

  const patchAllergies = (algs: string[]) => {
    if (!report) return;
    onReportChange?.({ ...report, allergies: algs });
  };

  return (
    <ScrollArea className="h-full">
      <div className={cn('max-w-4xl space-y-5 p-4 sm:space-y-6 sm:p-6', sheetLayout && 'max-w-none pt-2 pb-[max(2rem,calc(env(safe-area-inset-bottom,0px)+1rem))]')}>

        {/* 标题行 */}
        <div className="space-y-2">
          <div className={cn('flex flex-wrap items-center justify-between gap-2', sheetLayout && 'pr-12')}>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-semibold">{t('report.title')}</h2>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-2"
                  disabled={refreshing}
                  onClick={triggerRefresh}
                  title={t('report.refreshTooltip')}
                  aria-label={`${t('report.refreshFull')} · ${t('report.refreshTooltip')}`}
                >
                  <RefreshCw className={`size-4 shrink-0 sm:size-4 ${refreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{t('report.refreshFull')}</span>
                  <span className="sm:hidden">{t('report.refreshShort')}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="hidden max-w-xs md:block">
                {t('report.refreshTooltip')}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>{t('report.generatedTime')}: {generated}</span>
            </div>
            <Badge variant="secondary">{refreshing ? '正在更新…' : t('report.updating')}</Badge>
            {report && (
              <Badge variant="outline" className="text-xs gap-1">
                <Pencil className="w-2.5 h-2.5" />{t('report.editHintBadge')}
              </Badge>
            )}
          </div>
        </div>

        {/* 合成失败（弱网 / 服务异常） */}
        {synthesizeError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 break-words">
              {t('report.synthesizeBanner')}
              <span className="mt-0.5 block text-xs font-normal opacity-90">{synthesizeError}</span>
            </span>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8"
                disabled={refreshing || !canRefresh}
                onClick={triggerRefresh}
              >
                <RefreshCw className={`mr-1 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                {t('report.retrySynthesize')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2"
                onClick={() => onDismissSynthesizeError?.()}
              >
                {t('report.dismissBanner')}
              </Button>
            </div>
          </div>
        ) : null}

        {/* 过期提示 */}
        {staleReportHint && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1 min-w-[200px]">{t('report.staleHint')}</span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shrink-0"
              onClick={triggerRefresh}
              disabled={refreshing || !canRefresh}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              {t('report.refreshShort')}
            </Button>
          </div>
        )}

        <Separator />

        {!report && (
          <p className="text-sm text-muted-foreground">
            右侧报告由后端根据左侧对话、PDF 摘录与「分步表单」中的要点生成。任选一种方式填写后，点击「刷新报告」。未配置大模型 API Key 时仍可使用离线规则合成。
          </p>
        )}

        {/* 严重度 */}
        <SeverityIndicator assessment={overallSeverity} showDetails={true} />

        {/* 科室推荐 */}
        <DepartmentCard recommendation={report?.department_recommendation} />

        {/* 基本信息（可编辑） */}
        <Card>
          <CardHeader className="pb-3">
            <h3 className="font-semibold">{t('report.basicInfo')}</h3>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {report ? (
              <>
                <EditableField label={t('report.name')} value={basic?.patient_name_masked || ''} onSave={(v) => patchBasic('patient_name_masked', v)} />
                <EditableField label={t('report.gender')} value={basic?.gender || ''} onSave={(v) => patchBasic('gender', v)} />
                <EditableField label={t('report.age')} value={basic?.age || ''} onSave={(v) => patchBasic('age', v)} />
                <EditableField label={t('report.visitDate')} value={basic?.visit_date || new Date().toISOString().slice(0, 10)} onSave={(v) => patchBasic('visit_date', v)} />
              </>
            ) : (
              <>
                <div className="text-sm"><span className="text-muted-foreground">{t('report.name')}:</span><span className="ml-2">—</span></div>
                <div className="text-sm"><span className="text-muted-foreground">{t('report.gender')}:</span><span className="ml-2">—</span></div>
                <div className="text-sm"><span className="text-muted-foreground">{t('report.age')}:</span><span className="ml-2">—</span></div>
                <div className="text-sm"><span className="text-muted-foreground">{t('report.visitDate')}:</span><span className="ml-2">—</span></div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 时间线（可编辑） */}
        <Card>
          <CardContent className="p-6">
            <EditableTimeline events={timeline} onChangeEvents={patchTimeline} />
          </CardContent>
        </Card>

        {/* 用药/过敏（可编辑） */}
        <Card>
          <CardContent className="p-6">
            <MedicationCards
              medications={report?.medications}
              allergies={report?.allergies}
              memoryNote={report?.memory_note}
              onChangeMeds={patchMeds}
              onChangeAllergies={patchAllergies}
            />
          </CardContent>
        </Card>

        {/* 问题清单 */}
        <Card>
          <CardContent className="p-6">
            <QuestionsList questions={report?.questions} />
          </CardContent>
        </Card>

        {/* 就诊清单 */}
        <Card>
          <CardContent className="p-6">
            <Checklist items={report?.checklist} />
          </CardContent>
        </Card>

        {/* 免责声明 */}
        <div className="pt-4 pb-8 border-t">
          <div className="bg-muted/30 rounded-lg p-4 text-center space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t('disclaimer.footer')}</p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              {t('disclaimer.description')}
            </p>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
