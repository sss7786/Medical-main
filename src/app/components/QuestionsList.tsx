import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { Checkbox } from "./ui/checkbox";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { motion } from "motion/react";
import type { QuestionItem } from '@/types/report';

interface QuestionsListProps {
  questions?: QuestionItem[];
}

const defaults: QuestionItem[] = [
  { id: 'd1', question: '我目前的用药是否需要注意相互作用？', reason: '用药安全' },
];

export function QuestionsList({ questions }: QuestionsListProps) {
  const { t } = useTranslation();
  const list = questions && questions.length > 0 ? questions : defaults;
  const [checkedQuestions, setCheckedQuestions] = useState<Set<string>>(new Set());

  const toggleQuestion = (id: string) => {
    setCheckedQuestions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('questions.title')}</h3>
        <span className="text-xs text-muted-foreground">
          {t('questions.selected') || '已选'} {checkedQuestions.size}/{list.length}
        </span>
      </div>

      <div className="space-y-2">
        <TooltipProvider>
          {list.map((question, index) => (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <Checkbox
                id={question.id}
                checked={checkedQuestions.has(question.id)}
                onCheckedChange={() => toggleQuestion(question.id)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <label
                  htmlFor={question.id}
                  className="text-sm cursor-pointer leading-relaxed block"
                >
                  {question.question}
                </label>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <p className="text-xs font-medium mb-1">为什么要问这个？</p>
                  <p className="text-xs text-muted-foreground">{question.reason}</p>
                </TooltipContent>
              </Tooltip>
            </motion.div>
          ))}
        </TooltipProvider>
      </div>
      {!(questions && questions.length > 0) && (
        <p className="text-xs text-muted-foreground">
          （占位示例）请先「刷新报告」以根据对话生成个性化的提问清单。
        </p>
      )}
    </div>
  );
}
