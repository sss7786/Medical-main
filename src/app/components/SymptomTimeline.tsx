import { useTranslation } from 'react-i18next';
import { Badge } from "./ui/badge";
import { Circle } from "lucide-react";
import { motion } from "motion/react";
import { SeverityIndicator } from "./SeverityIndicator";
import { assessSymptomSeverity } from '../../utils/severityAssessment';
import type { TimelineEvent as TimelineEventProps } from '@/types/report';

interface SymptomTimelineProps {
  events?: TimelineEventProps[];
}

const defaultSeverity = (s?: string): 'low' | 'medium' | 'high' =>
  s === 'high' || s === 'medium' || s === 'low' ? s : 'low';

export function SymptomTimeline({ events = [] }: SymptomTimelineProps) {
  const { t } = useTranslation();
  const list = events ?? [];

  if (list.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{t('timeline.title')}</h3>
          <Badge variant="outline" className="text-xs">
            {t('timeline.selfReported') || '自我报告'}
          </Badge>
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
        <h3 className="font-semibold">{t('timeline.title')}</h3>
        <Badge variant="outline" className="text-xs">
          {t('timeline.selfReported') || '自我报告'}
        </Badge>
      </div>

      <div className="space-y-4">
        {list.map((event, index) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex gap-3 group relative"
          >
            {index < list.length - 1 && (
              <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-border group-last:hidden" />
            )}

            <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 transition-all ${
              event.severity === 'high'
                ? 'bg-destructive/10 ring-2 ring-destructive/20'
                : event.severity === 'medium'
                  ? 'bg-amber-500/10 ring-2 ring-amber-500/20'
                  : 'bg-primary/10 ring-2 ring-primary/20'
            }`}>
              <Circle className={`w-2.5 h-2.5 fill-current ${
                event.severity === 'high'
                  ? 'text-destructive'
                  : event.severity === 'medium'
                    ? 'text-amber-500'
                    : 'text-primary'
              }`} />
            </div>

            <div className="flex-1 pb-4 group hover:bg-muted/30 -ml-2 pl-2 pr-3 py-1 rounded-lg transition-colors">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-medium text-sm">{event.day}</span>
                <span className="text-xs text-muted-foreground">{event.date}</span>
                {event.severity && (
                  <SeverityIndicator
                    assessment={assessSymptomSeverity({
                      symptom: event.description,
                      intensity: defaultSeverity(event.severity) === 'high' ? 7 : defaultSeverity(event.severity) === 'medium' ? 4 : 2,
                    })}
                    showDetails={false}
                  />
                )}
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">{event.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
