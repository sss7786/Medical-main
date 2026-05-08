import { ApiStatusIndicator } from "./ApiStatusIndicator";
import { Button } from "./ui/button";
import {
  Download,
  Moon,
  Sun,
  Activity,
  Printer,
  Share2,
  Languages,
  History,
  Trash2,
  LayoutTemplate,
  FileJson,
  FileText,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useReactToPrint } from "react-to-print";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { toast } from "sonner";
import { SCENARIO_IDS, normalizeScenario, type ConsultScenarioId } from "@/utils/consultScenarios";
import { cn } from "./ui/utils";

function ToolbarSep({ className }: { className?: string }) {
  return <div className={cn("hidden h-6 w-px shrink-0 bg-border/70 sm:block", className)} aria-hidden />;
}

interface HeaderProps {
  printRef?: React.RefObject<HTMLDivElement | null>;
  onOpenHistory?: () => void;
  onClearLocalSession?: () => void;
  scenarioId?: ConsultScenarioId;
  onScenarioChange?: (id: ConsultScenarioId) => void;
  onExportJson?: () => void;
  onExportMarkdown?: () => void;
}

export function Header({
  printRef,
  onOpenHistory,
  onClearLocalSession,
  scenarioId,
  onScenarioChange,
  onExportJson,
  onExportMarkdown,
}: HeaderProps) {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [moreExportOpen, setMoreExportOpen] = useState(false);

  const uiLang: "zh" | "en" = (i18n.language || "zh").toLowerCase().startsWith("en") ? "en" : "zh";

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `MedBrief_Report_${new Date().toISOString().split("T")[0]}`,
    onAfterPrint: () => {
      toast.success(t("print.success") || "打印任务已发送");
    },
  });

  const runPrint = () => {
    void handlePrint();
  };

  const runPrintWithPdfHint = () => {
    try {
      if (!localStorage.getItem("medbrief_print_pdf_hint")) {
        toast.info(t("header.printPdfTipTitle"), {
          description: t("header.printPdfTipBody"),
          duration: 7500,
        });
        localStorage.setItem("medbrief_print_pdf_hint", "1");
      }
    } catch {
      /* private mode */
    }
    void handlePrint();
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: t("app.name"), text: t("print.title"), url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success(t("share.copied"));
      }
    } catch {
      toast.error(t("share.error"));
    }
  };

  const applyLanguage = (lng: "zh" | "en") => {
    if (lng === uiLang) return;
    void i18n.changeLanguage(lng).then(() => {
      try {
        localStorage.setItem("language", lng);
      } catch {
        /* private mode */
      }
      toast.success(lng === "zh" ? "已切换至中文" : "Switched to English");
    });
  };

  const selectShell =
    "flex h-9 max-w-[min(100%,13rem)] shrink-0 items-center gap-1.5 rounded-lg border border-input bg-background px-2 shadow-sm";

  const selectField =
    "h-full min-w-0 flex-1 cursor-pointer border-0 bg-transparent py-1 text-xs font-medium text-foreground outline-none focus:ring-0";

  return (
    <header className="sticky top-0 z-50 flex min-h-14 flex-col border-b bg-card/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-sm sm:min-h-16">
      <div className="flex max-w-[100vw] flex-wrap items-center justify-between gap-x-1 gap-y-2 px-2 py-2 sm:flex-nowrap sm:gap-x-2 sm:px-5 sm:py-0 lg:px-6">
        {/* 品牌 */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial sm:gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2D5CFE] to-[#5B82FF] shadow-lg shadow-primary/20 sm:h-10 sm:w-10">
            <Activity className="h-[18px] w-[18px] text-white sm:h-5 sm:w-5" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{t("app.name")}</h1>
            <p className="truncate text-[11px] text-muted-foreground sm:text-xs">{t("app.subtitle")}</p>
          </div>
        </div>

        {/* 工具条：分组 + 原生下拉（语言 / 场景）避免扩展与 Radix 抢事件 */}
        <nav
          className="flex w-full flex-wrap items-center justify-end gap-x-1 gap-y-1.5 sm:w-auto sm:flex-nowrap sm:gap-x-1.5"
          aria-label="App toolbar"
        >
          <div className="hidden sm:contents">
            <ApiStatusIndicator />
            <ToolbarSep />
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenHistory?.()}
            className="h-9 w-9 shrink-0 rounded-full"
            title={t("header.history")}
            aria-label={t("header.history")}
          >
            <History className="h-4 w-4" />
          </Button>

          {onClearLocalSession ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
                  title={t("header.clearSession")}
                  aria-label={t("header.clearSession")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="z-[400]">
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("header.clearSessionTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("header.clearSessionDescription")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("header.clearSessionCancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={onClearLocalSession}
                  >
                    {t("header.clearSessionConfirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}

          <ToolbarSep className="max-sm:hidden" />

          {onScenarioChange ? (
            <div className={selectShell} title={t("scenarios.pickerTitle")}>
              <LayoutTemplate className="pointer-events-none h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <label htmlFor="medbrief-scenario" className="sr-only">
                {t("scenarios.pickerTitle")}
              </label>
              <select
                id="medbrief-scenario"
                aria-label={t("scenarios.pickerTitle")}
                className={selectField}
                value={scenarioId ?? "general"}
                onChange={(e) => {
                  onScenarioChange(normalizeScenario(e.target.value));
                }}
              >
                {SCENARIO_IDS.map((id) => (
                  <option key={id} value={id}>
                    {t(`scenarios.${id}`)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className={selectShell} title={t("header.languageSwitch")}>
            <Languages className="pointer-events-none h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <label htmlFor="medbrief-lang" className="sr-only">
              {t("header.languageSwitch")}
            </label>
            <select
              id="medbrief-lang"
              aria-label={t("header.languageSwitch")}
              className={selectField}
              value={uiLang}
              onChange={(e) => {
                applyLanguage(e.target.value === "en" ? "en" : "zh");
              }}
            >
              <option value="zh">{t("header.langZh")}</option>
              <option value="en">{t("header.langEn")}</option>
            </select>
          </div>

          <div className="hidden sm:contents">
            <ToolbarSep />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9 shrink-0 rounded-full"
            title={theme === "light" ? t("header.themeDark") : t("header.themeLight")}
            aria-label={theme === "light" ? t("header.themeDark") : t("header.themeLight")}
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            className="h-9 w-9 shrink-0 rounded-full"
            title={t("header.share")}
            aria-label={t("header.share")}
          >
            <Share2 className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => runPrint()}
            className="h-9 w-9 shrink-0 rounded-full"
            title={t("header.printReport")}
            aria-label={t("header.printReport")}
          >
            <Printer className="h-4 w-4" />
          </Button>

          {onExportJson && onExportMarkdown ? (
            <div className="flex shrink-0 rounded-md shadow-lg shadow-primary/20">
              <Button
                type="button"
                onClick={() => runPrintWithPdfHint()}
                className="h-9 shrink-0 gap-0 rounded-l-md rounded-r-none bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90 sm:h-10 sm:px-4 sm:text-sm"
              >
                <Download className="mr-1.5 h-4 w-4 sm:mr-2" />
                <span className="whitespace-nowrap">{t("header.exportPdf")}</span>
              </Button>
              <Popover
                open={moreExportOpen}
                onOpenChange={setMoreExportOpen}
                modal={false}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="default"
                    className="h-9 min-w-9 shrink-0 rounded-l-none rounded-r-md border-l border-primary-foreground/25 bg-primary px-2 text-primary-foreground hover:bg-primary/90 sm:h-10"
                    aria-label={t("header.moreExports")}
                    title={t("header.moreExports")}
                    aria-expanded={moreExportOpen}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  side="bottom"
                  sideOffset={6}
                  className="z-[500] w-[min(100vw-1rem,13rem)] min-w-[11rem] p-1"
                >
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                      onClick={() => {
                        onExportJson();
                        setMoreExportOpen(false);
                      }}
                    >
                      <FileJson className="h-4 w-4 shrink-0 opacity-70" />
                      {t("export.json")}
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                      onClick={() => {
                        onExportMarkdown();
                        setMoreExportOpen(false);
                      }}
                    >
                      <FileText className="h-4 w-4 shrink-0 opacity-70" />
                      {t("export.markdown")}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <Button
              type="button"
              onClick={() => runPrintWithPdfHint()}
              className="h-9 shrink-0 bg-primary px-3 text-xs shadow-lg shadow-primary/20 hover:bg-primary/90 sm:h-10 sm:px-4 sm:text-sm"
              title={t("header.exportPdf")}
            >
              <Download className="mr-1.5 h-4 w-4 sm:mr-2" />
              <span className="whitespace-nowrap">{t("header.exportPdf")}</span>
            </Button>
          )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:hidden"
                aria-label={t("header.moreMenuAria")}
                title={t("header.moreMenu")}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="z-[520] max-h-[min(70dvh,calc(100vh-3rem))] w-[min(calc(100vw-1rem),18rem)] overflow-y-auto"
            >
              <DropdownMenuItem
                onSelect={() => {
                  window.open(`${window.location.origin}/api/health`, "_blank", "noopener,noreferrer");
                }}
              >
                <Activity className="h-4 w-4 opacity-70" />
                {t("header.viewApiHealth")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => toggleTheme()}>
                {theme === "light" ? (
                  <Moon className="h-4 w-4 opacity-70" />
                ) : (
                  <Sun className="h-4 w-4 opacity-70" />
                )}
                {theme === "light" ? t("header.themeDark") : t("header.themeLight")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleShare()}>
                <Share2 className="h-4 w-4 opacity-70" />
                {t("header.share")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => runPrint()}>
                <Printer className="h-4 w-4 opacity-70" />
                {t("header.print")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => runPrintWithPdfHint()}>
                <Download className="h-4 w-4 opacity-70" />
                {t("header.exportPdf")}
              </DropdownMenuItem>
              {onExportJson ? (
                <DropdownMenuItem onSelect={() => onExportJson()}>
                  <FileJson className="h-4 w-4 opacity-70" />
                  {t("export.json")}
                </DropdownMenuItem>
              ) : null}
              {onExportMarkdown ? (
                <DropdownMenuItem onSelect={() => onExportMarkdown()}>
                  <FileText className="h-4 w-4 opacity-70" />
                  {t("export.markdown")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </header>
  );
}
