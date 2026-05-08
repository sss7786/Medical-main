import { useTranslation } from 'react-i18next';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { SeverityAssessment } from '../../utils/severityAssessment';

interface SeverityIndicatorProps {
  assessment: SeverityAssessment;
  showDetails?: boolean;
}

export function SeverityIndicator({ assessment, showDetails = false }: SeverityIndicatorProps) {
  const { t } = useTranslation();

  const getIcon = () => {
    switch (assessment.level) {
      case 'critical':
      case 'severe':
        return <AlertCircle className="w-4 h-4" />;
      case 'moderate':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  if (!showDetails) {
    return (
      <Badge
        style={{ backgroundColor: `${assessment.color}20`, color: assessment.color }}
        className="border-0"
      >
        {getIcon()}
        <span className="ml-1">{t(`timeline.levels.${assessment.level}`)}</span>
      </Badge>
    );
  }

  return (
    <Card className="border-0 shadow-sm" style={{ borderLeft: `4px solid ${assessment.color}` }}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${assessment.color}15` }}
          >
            <div style={{ color: assessment.color }}>
              {getIcon()}
            </div>
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">{t('severity.title')}</h4>
              <Badge
                style={{ backgroundColor: `${assessment.color}20`, color: assessment.color }}
                className="border-0"
              >
                {t(`timeline.levels.${assessment.level}`)}
              </Badge>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t('severity.score')}:</span>
                <span className="font-medium">{assessment.score}/100</span>
              </div>

              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full transition-all duration-500 rounded-full"
                  style={{
                    width: `${assessment.score}%`,
                    backgroundColor: assessment.color
                  }}
                />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              <span className="font-medium">{t('severity.recommendation')}:</span> {assessment.recommendation}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
