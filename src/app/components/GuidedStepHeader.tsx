import { useState } from "react";
import { Check } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { ConsultScenarioId } from "@/utils/consultScenarios";

/** 分步顺序（标签由 i18n `form.guided.*` 提供） */
export const GUIDED_STEPS_META = [
  { id: 1, key: "symptoms" },
  { id: 2, key: "timeline" },
  { id: 3, key: "medications" },
  { id: 4, key: "allergies" },
] as const;

type StepKey = (typeof GUIDED_STEPS_META)[number]["key"];

interface GuidedStepHeaderProps {
  scenarioId: ConsultScenarioId;
  currentStep: number;
  onStepChange: (step: number) => void;
  onSuggestionPicked: (stepLabel: string, suggestion: string) => void;
  onAdvanceFromSuggestion?: () => void;
  onFormHint?: (hint: string) => void;
}

function quickSuggestionsFor(
  t: (k: string, o?: { returnObjects?: boolean }) => unknown,
  scenarioId: ConsultScenarioId,
  stepKey: string,
): string[] {
  const raw = t(`scenarios.quickPick.${scenarioId}.${stepKey}`, { returnObjects: true });
  return Array.isArray(raw) ? (raw as string[]) : [];
}

export function GuidedStepHeader({
  scenarioId,
  currentStep,
  onStepChange,
  onSuggestionPicked,
  onAdvanceFromSuggestion,
  onFormHint,
}: GuidedStepHeaderProps) {
  const { t } = useTranslation();
  const [bioName, setBioName] = useState("");
  const [bioGender, setBioGender] = useState("");
  const [bioAge, setBioAge] = useState("");
  const stepMeta = GUIDED_STEPS_META[currentStep - 1];
  const stepKey = (stepMeta?.key ?? "symptoms") as StepKey;
  const suggestions = quickSuggestionsFor(t, scenarioId, stepKey);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {GUIDED_STEPS_META.map((step, index) => {
          const label = t(`form.guided.${step.key}`);
          return (
            <div key={step.id} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => onStepChange(step.id)}
                className="flex flex-col items-center gap-1 group"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    currentStep >= step.id
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>
                <span
                  className={`text-xs font-medium transition-colors ${
                    currentStep === step.id ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </button>
              {index < GUIDED_STEPS_META.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 transition-all ${
                    currentStep > step.id ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <motion.div
        key={`${scenarioId}-${currentStep}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <p className="text-sm font-medium text-muted-foreground">{t("form.quickPickLabel")}</p>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full h-auto py-1.5 px-3 font-normal hover:bg-primary/10 hover:border-primary hover:text-primary"
              onClick={() => {
                const label = t(`form.guided.${stepKey}`);
                onSuggestionPicked(label, suggestion);
                toast.message(t("form.pickedToastTitle"), {
                  description: t("form.pickedToastBody", { label, suggestion }),
                  duration: 3500,
                });
                onAdvanceFromSuggestion?.();
              }}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      </motion.div>

      {onFormHint && (
        <div className="space-y-2 pt-1 border-t border-border/60">
          <p className="text-sm font-medium text-muted-foreground">{t("form.basicOptional")}</p>
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              placeholder={t("report.name")}
              value={bioName}
              onChange={(e) => setBioName(e.target.value)}
              className="h-8 text-xs max-w-[120px]"
            />
            <Input
              placeholder={t("report.gender")}
              value={bioGender}
              onChange={(e) => setBioGender(e.target.value)}
              className="h-8 text-xs max-w-[88px]"
            />
            <Input
              placeholder={t("report.age")}
              value={bioAge}
              onChange={(e) => setBioAge(e.target.value)}
              className="h-8 text-xs max-w-[88px]"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 text-xs"
              disabled={!bioName.trim() && !bioGender.trim() && !bioAge.trim()}
              onClick={() => {
                const parts: string[] = [];
                if (bioName.trim()) parts.push(`${t("report.name")}:${bioName.trim()}`);
                if (bioGender.trim()) parts.push(`${t("report.gender")}:${bioGender.trim()}`);
                if (bioAge.trim()) parts.push(`${t("report.age")}:${bioAge.trim()}`);
                onFormHint(`[基本信息] ${parts.join(" ")}`);
                toast.message(t("form.bioPickedTitle"), {
                  description: t("form.bioPickedBody"),
                  duration: 3500,
                });
              }}
            >
              {t("form.writeBioHint")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
