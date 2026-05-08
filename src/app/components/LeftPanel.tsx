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
      <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-4 border-b">
          <TabsList className="grid w-full grid-cols-2">
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
      <Card className="m-4 border-destructive/30 bg-destructive/5">
        <CardContent className="p-4">
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
