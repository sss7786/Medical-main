import { useTranslation } from "react-i18next";
import { GuidedStepHeader } from "./GuidedStepHeader";
import type { ConsultScenarioId } from "@/utils/consultScenarios";

interface StepFormProps {
  scenarioId: ConsultScenarioId;
  currentStep: number;
  onStepChange: (step: number) => void;
  onSuggestionPicked: (stepLabel: string, suggestion: string) => void;
  onAdvanceFromSuggestion?: () => void;
  onFormHint?: (hint: string) => void;
}

export function StepForm({
  scenarioId,
  currentStep,
  onStepChange,
  onSuggestionPicked,
  onAdvanceFromSuggestion,
  onFormHint,
}: StepFormProps) {
  const { t } = useTranslation();
  const planner = t(`scenarios.formPlanner.${scenarioId}`);

  return (
    <div className="p-4 space-y-4">
      <GuidedStepHeader
        scenarioId={scenarioId}
        currentStep={currentStep}
        onStepChange={onStepChange}
        onSuggestionPicked={onSuggestionPicked}
        onAdvanceFromSuggestion={onAdvanceFromSuggestion}
        onFormHint={onFormHint}
      />

      <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
        <div className="flex items-start gap-2">
          <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 animate-pulse shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-foreground/80">{t("form.smartPlannerTitle")}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{planner}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
