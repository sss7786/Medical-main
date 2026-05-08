import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getHealth } from "@/api/client";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";

export function ApiStatusIndicator() {
  const { t } = useTranslation();
  const [ok, setOk] = useState<boolean | null>(null);
  const [detail, setDetail] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const h = await getHealth();
        if (cancelled) return;
        setOk(true);
        const key = h.key_configured ? "ON" : "OFF";
        const model = String(h.model ?? "?");
        setDetail(
          `status: ${h.status}\nmodel: ${model}\nllm_key: ${key}\n` +
            `chat_stream: POST /api/chat/stream`,
        );
      } catch {
        if (!cancelled) {
          setOk(false);
          setDetail(t("status.healthUnreachable"));
        }
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 45000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [t]);

  const label =
    ok === null ? t("status.checking") : ok ? t("status.online") : t("status.offline");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="hidden sm:inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-muted-foreground hover:bg-muted/50 max-w-[200px]"
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${ok === null ? "bg-muted-foreground" : ok ? "bg-green-500" : "bg-destructive"}`}
            aria-hidden
          />
          <span className="truncate">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-sm text-xs font-mono whitespace-pre-wrap">
        {detail || label}
      </TooltipContent>
    </Tooltip>
  );
}
