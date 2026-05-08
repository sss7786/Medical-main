import { useTranslation } from 'react-i18next';
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { ClipboardList } from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";
import type { ChecklistItem as ChecklistRow } from '@/types/report';

interface ChecklistProps {
  items?: ChecklistRow[];
}

const builtin: ChecklistRow[] = [
  { id: '1', item: '身份证或医保卡', required: true },
  { id: '2', item: '既往病历本', required: true },
  { id: '3', item: '近期化验单/检查报告', required: true },
  { id: '4', item: '正在服用的药物（带实物或拍照）', required: true },
  { id: '5', item: '过敏史记录', required: true },
  { id: '6', item: '家族病史记录', required: false },
  { id: '7', item: '症状日记（如有）', required: false },
];

export function Checklist({ items }: ChecklistProps) {
  const { t } = useTranslation();
  const list = items && items.length > 0 ? items : builtin;
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setCheckedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const requiredCount = list.filter((item) => item.required).length;
  const checkedRequiredCount = list
    .filter((item) => item.required && checkedItems.has(item.id)).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          {t('checklist.title')}
        </h3>
        <div className="text-xs text-muted-foreground">
          {t('checklist.required') || '必备'} {checkedRequiredCount}/{requiredCount}
        </div>
      </div>

      <div className="space-y-2">
        {list.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
              checkedItems.has(item.id)
                ? 'bg-primary/5 border-primary/20'
                : 'bg-card hover:bg-muted/30'
            }`}
          >
            <Checkbox
              id={item.id}
              checked={checkedItems.has(item.id)}
              onCheckedChange={() => toggleItem(item.id)}
            />
            <label
              htmlFor={item.id}
              className="flex-1 text-sm cursor-pointer leading-relaxed"
            >
              {item.item}
            </label>
            {item.required && (
              <Badge variant="outline" className="text-xs border-primary/30 text-primary shrink-0">
                {t('checklist.required') || '必备'}
              </Badge>
            )}
          </motion.div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${requiredCount ? (checkedRequiredCount / requiredCount) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs font-medium text-primary">
            {requiredCount ? Math.round((checkedRequiredCount / requiredCount) * 100) : 0}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {checkedRequiredCount === requiredCount
            ? t('checklist.allReady') || '✓ 必备物品已备齐！'
            : (t('checklist.remaining') || `还有 ${requiredCount - checkedRequiredCount} 项必备物品需准备`).replace(
                '{count}',
                String(requiredCount - checkedRequiredCount),
              )}
        </p>
      </div>
    </div>
  );
}
