import { Building2, ChevronRight } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import type { DepartmentRecommendation } from '@/types/report';

interface DepartmentCardProps {
  recommendation?: DepartmentRecommendation;
}

export function DepartmentCard({ recommendation }: DepartmentCardProps) {
  if (!recommendation || !recommendation.primary) return null;

  const isEmpty =
    recommendation.primary === '—' ||
    recommendation.primary === '' ||
    recommendation.primary === '综合内科/全科';

  return (
    <Card className={`border-l-4 ${isEmpty ? 'border-l-muted-foreground/30' : 'border-l-blue-500'} transition-all`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${isEmpty ? 'bg-muted' : 'bg-blue-500/10'}`}>
            <Building2 className={`w-5 h-5 ${isEmpty ? 'text-muted-foreground' : 'text-blue-600 dark:text-blue-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <h4 className="font-semibold text-sm">就诊科室推荐</h4>
              {!isEmpty && (
                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  AI 推荐
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`font-bold text-base ${isEmpty ? 'text-muted-foreground' : 'text-blue-700 dark:text-blue-300'}`}>
                {recommendation.primary || '—'}
              </span>
              {recommendation.secondary && recommendation.secondary !== '—' && (
                <>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground font-medium">
                    备选：{recommendation.secondary}
                  </span>
                </>
              )}
            </div>

            {recommendation.reason && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {recommendation.reason}
              </p>
            )}

            {isEmpty && (
              <p className="text-xs text-muted-foreground mt-1">
                请先在左侧补充症状详情并点击「刷新报告」，AI 将根据症状推荐就诊科室。
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
