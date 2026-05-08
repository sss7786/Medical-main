import { useState } from "react";
import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '@/api/client';
import { ChatInterface } from "./ChatInterface";
import { StepForm } from "./StepForm";
import { Card, CardContent } from "./ui/card";
import { AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

import type { ConsultScenarioId } from '@/utils/consultScenarios';

interface LeftPanelProps {
  sessionId: string;
  scenarioId: ConsultScenarioId;
  initialChatMessages: ChatMessage[];
  onTranscriptChange: (msgs: ChatMessage[]) => void;
  onFormHint?: (hint: string) => void;
}

export function LeftPanel({
  sessionId,
  scenarioId,
  initialChatMessages,
  onTranscriptChange,
  onFormHint,
}: LeftPanelProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(1);

  const advanceStepAfterPick = () => {
    if (currentStep < 4) {
      setTimeout(() => {
        setCurrentStep((s) => Math.min(4, s + 1));
      }, 400);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="chat" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b px-3 pb-2 pt-3 sm:px-4 sm:pt-4">
          <TabsList className="grid w-full max-w-full grid-cols-2">
            <TabsTrigger value="chat">{t('tabs.chat')}</TabsTrigger>
            <TabsTrigger value="form">{t('tabs.form')}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="flex-1 m-0 overflow-hidden min-h-0">
          <ChatInterface
            sessionId={sessionId}
            scenarioId={scenarioId}
            initialMessages={initialChatMessages}
            onTranscriptChange={onTranscriptChange}
          />
        </TabsContent>

        <TabsContent value="form" className="flex-1 m-0 overflow-y-auto min-h-0">
          <StepForm
            scenarioId={scenarioId}
            currentStep={currentStep}
            onStepChange={setCurrentStep}
            onSuggestionPicked={(stepLabel, suggestion) => {
              onFormHint?.(`[${stepLabel}] ${suggestion}`);
            }}
            onAdvanceFromSuggestion={advanceStepAfterPick}
            onFormHint={onFormHint}
          />
        </TabsContent>
      </Tabs>

      {/* Emergency Warning */}
      <Card className="mx-3 mb-3 shrink-0 border-destructive/30 bg-destructive/5 sm:mx-4 sm:mb-4">
        <CardContent className="p-3 sm:p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1 text-destructive">{t('disclaimer.title')}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t('disclaimer.emergency')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
