import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Mic, Upload, Send, Bot, User, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { postChatStream, postExtractPdf, type ChatMessage as ApiChatMessage } from "@/api/client";
import { toast } from "sonner";
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/config';
import { EmergencyModal } from "./EmergencyModal";
import { computeChatProgressStep, getProgressSteps, type ConsultScenarioId } from "@/utils/consultScenarios";

type SpeechRecCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: Event) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognitionCtor(): SpeechRecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecCtor; webkitSpeechRecognition?: SpeechRecCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// ── TTS 播报 ──────────────────────────────────────────────────────────────────
function speakText(text: string, lang: string): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text.slice(0, 300));
  utter.lang = lang.startsWith('en') ? 'en-US' : 'zh-CN';
  utter.rate = 1.0;
  utter.pitch = 1.0;
  window.speechSynthesis.speak(utter);
  return utter;
}

interface UiMessage {
  id: string;
  type: 'agent' | 'user';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  sessionId: string;
  scenarioId: ConsultScenarioId;
  initialMessages: ApiChatMessage[];
  onTranscriptChange: (msgs: ApiChatMessage[]) => void;
}

function toApiMessages(messages: UiMessage[]): ApiChatMessage[] {
  return messages
    .filter((m) => m.type === 'agent' || m.type === 'user')
    .map((m) => ({
      role: m.type === 'agent' ? ('assistant' as const) : ('user' as const),
      content: m.content,
    }));
}

function mapApiToUi(msgs: ApiChatMessage[], scenarioId: ConsultScenarioId): UiMessage[] {
  if (!msgs.length) {
    return [
      {
        id: 'welcome',
        type: 'agent',
        content: i18n.t(`chat.welcomeByScenario.${scenarioId}`),
        timestamp: new Date(),
      },
    ];
  }
  return msgs.map((m, i) => ({
    id: `r-${i}-${m.role}`,
    type: m.role === 'assistant' ? 'agent' : 'user',
    content: m.content,
    timestamp: new Date(),
  }));
}

export function ChatInterface({ sessionId, scenarioId, initialMessages, onTranscriptChange }: ChatInterfaceProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<UiMessage[]>(() => mapApiToUi(initialMessages, scenarioId));
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef(messages);
  const [isTyping, setIsTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void; abort: () => void } | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  useEffect(() => {
    setSpeechSupported(!!getSpeechRecognitionCtor());
    setTtsSupported(typeof window !== 'undefined' && !!window.speechSynthesis);
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    onTranscriptChange(toApiMessages(messages));
  }, [messages, onTranscriptChange]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // 不要用 initialMessages 持续回灌：父组件 apiMessages 会随子组件 onTranscriptChange 更新，
  // 流式阶段若依赖 initialMessages 会反复 setMessages，导致助手回复拆成多条气泡。

  useEffect(() => {
    const onLang = () => {
      setMessages((prev) =>
        prev.length === 1 && prev[0].id === 'welcome' && prev[0].type === 'agent'
          ? [{ ...prev[0], content: i18n.t(`chat.welcomeByScenario.${scenarioId}`) }]
          : prev,
      );
    };
    i18n.on('languageChanged', onLang);
    return () => { i18n.off('languageChanged', onLang); };
  }, [scenarioId]);

  useEffect(() => {
    setMessages((prev) => {
      const onlyWelcome =
        prev.length === 1 && prev[0].id === 'welcome' && prev[0].type === 'agent';
      if (onlyWelcome) {
        return [{ ...prev[0], content: t(`chat.welcomeByScenario.${scenarioId}`) }];
      }
      return prev;
    });
  }, [scenarioId, t]);

  const stopSpeech = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    recognitionRef.current = null;
    setListening(false);
  }, []);

  // 问诊进度：合并用户+助手全文（从首条用户算起），随流式回复实时变化
  const progressStep = useMemo(
    () => computeChatProgressStep(toApiMessages(messages), scenarioId),
    [messages, scenarioId],
  );
  const progressDefs = getProgressSteps(scenarioId);
  const progressSegments = progressDefs.slice(0, -1);

  const appendStreamingAgentReply = async (merged: UiMessage[]) => {
    const agentMsgId = `agent-${Date.now()}`;
    let acc = '';
    let firstChunk = true;
    let isEmergency = false;

    await postChatStream(
      { session_id: sessionId, messages: toApiMessages(merged) },
      {
        onMeta(meta) {
          if (meta.emergency_detected) {
            isEmergency = true;
            setEmergencyOpen(true);
          } else if (meta.demo_mode) {
            toast.message('演示模式', {
              description: '未配置 OPENAI_API_KEY，使用本地流式演示。请配置后端 .env 启用大模型。',
            });
          }
        },
        onDelta(text) {
          if (firstChunk) {
            firstChunk = false;
            setIsTyping(false);
          }
          acc += text;
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === agentMsgId);
            const next = exists
              ? prev.map((m) => (m.id === agentMsgId ? { ...m, content: acc } : m))
              : [
                  ...prev,
                  { id: agentMsgId, type: 'agent' as const, content: acc, timestamp: new Date() },
                ];
            messagesRef.current = next;
            return next;
          });
        },
      },
    );

    // TTS 播报最终回复
    if (ttsEnabled && acc && !isEmergency) {
      speakText(acc, i18n.language || 'zh');
    }
  };

  const toggleSpeech = () => {
    if (!speechSupported) { toast.message(t('chat.voiceUnsupported')); return; }
    if (isTyping) { toast.message(t('chat.voiceWait')); return; }
    if (listening) { stopSpeech(); return; }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = i18n.language?.startsWith('en') ? 'en-US' : 'zh-CN';
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev: Event) => {
      const r = ev as unknown as {
        resultIndex: number;
        results: { length: number; [i: number]: { 0: { transcript: string }; isFinal: boolean } };
      };
      let text = '';
      for (let i = r.resultIndex; i < r.results.length; i++) {
        if (r.results[i].isFinal) text += r.results[i][0].transcript;
      }
      text = text.trim();
      if (text) setInput((prev) => (prev ? `${prev.trimEnd()} ${text}` : text));
    };
    rec.onerror = () => { toast.error(t('chat.voiceError')); recognitionRef.current = null; setListening(false); };
    rec.onend = () => { recognitionRef.current = null; setListening(false); };
    recognitionRef.current = rec as unknown as { stop: () => void; abort: () => void };
    setListening(true);
    try { rec.start(); } catch { toast.error(t('chat.voiceError')); recognitionRef.current = null; setListening(false); }
  };

  useEffect(() => {
    return () => { try { recognitionRef.current?.abort(); } catch { /* noop */ } };
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    if (listening) stopSpeech();

    const content = input.trim();
    const userMessage: UiMessage = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date(),
    };

    const merged = [...messagesRef.current, userMessage];
    messagesRef.current = merged;
    setMessages(merged);
    setInput('');
    setIsTyping(true);

    try {
      await appendStreamingAgentReply(merged);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('对话失败：' + msg);
      const agentMessage: UiMessage = {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        content:
          `请求失败：${msg}\n\n` +
          '请检查：① `server` 目录已运行 `uvicorn main:app --reload --host 127.0.0.1 --port 8000`；② 浏览器地址为 Vite 给出的地址（如 http://localhost:5173）；③ 终端里访问 http://127.0.0.1:8000/api/health 应有 JSON。',
        timestamp: new Date(),
      };
      setMessages((prev) => {
        const next = [...prev, agentMessage];
        messagesRef.current = next;
        return next;
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) { toast.error('请上传 PDF 文件'); return; }
    setIsTyping(true);
    try {
      const { text, pages } = await postExtractPdf(file);
      const snippet = text.slice(0, 4000);
      const appended = `我上传了化验/检查 PDF（约 ${pages} 页），摘录如下，请仅作为整理参考：\n---\n${snippet}\n---`;
      const userMessage: UiMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: appended,
        timestamp: new Date(),
      };
      const merged = [...messagesRef.current, userMessage];
      messagesRef.current = merged;
      setMessages(merged);
      try { await appendStreamingAgentReply(merged); }
      catch (err) { toast.error('对话失败：' + (err instanceof Error ? err.message : String(err))); }
      finally { setIsTyping(false); }
    } catch (err) {
      toast.error('PDF 解析失败：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 进度条 */}
      <div className="px-4 pt-3 pb-2 border-b bg-muted/20">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground font-medium">{t('chat.progressHeading')}</span>
          <span className="text-xs text-primary font-semibold">
            {progressStep}/{progressSegments.length} {t('chat.progressStepSuffix')}
          </span>
        </div>
        <div className="flex gap-1">
          {progressSegments.map((def, i) => (
            <div key={def.labelKey} className="flex-1 flex flex-col items-center gap-0.5">
              <div className={`h-1.5 w-full rounded-full transition-all duration-500 ${
                i < progressStep ? 'bg-primary' : i === progressStep ? 'bg-primary/40' : 'bg-muted'
              }`} />
              <span className={`text-[9px] hidden sm:block truncate max-w-full text-center ${
                i < progressStep ? 'text-primary font-medium' : 'text-muted-foreground'
              }`}>
                {t(def.labelKey)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex gap-3 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.type === 'agent' ? 'bg-primary/10' : 'bg-muted'
              }`}>
                {message.type === 'agent' ? (
                  <Bot className="w-4 h-4 text-primary" />
                ) : (
                  <User className="w-4 h-4 text-foreground" />
                )}
              </div>
              <div className={`flex-1 max-w-[85%] ${message.type === 'user' ? 'flex justify-end' : ''}`}>
                <div className={`rounded-2xl px-4 py-2.5 group relative ${
                  message.type === 'agent'
                    ? 'bg-card border shadow-sm'
                    : 'bg-primary text-primary-foreground'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
                  {/* TTS 播报按钮（仅 agent 消息） */}
                  {message.type === 'agent' && ttsSupported && (
                    <button
                      onClick={() => speakText(message.content, i18n.language || 'zh')}
                      className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background border rounded-full p-1 shadow-sm text-muted-foreground hover:text-primary"
                      title="朗读此消息"
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-card border rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handlePickFile} />

      {/* 输入栏 */}
      <div className="p-4 border-t bg-card/50 backdrop-blur-sm">
        <div className="flex gap-2">
          {/* 语音输入 */}
          <Button
            variant="outline"
            size="icon"
            className={`rounded-full shrink-0 ${listening ? 'border-destructive text-destructive animate-pulse' : ''}`}
            title={listening ? t('chat.voiceListening') : t('chat.voiceInput')}
            type="button"
            disabled={isTyping}
            aria-pressed={listening}
            onClick={toggleSpeech}
          >
            <Mic className="w-4 h-4" />
          </Button>

          {/* PDF 上传 */}
          <Button
            variant="outline"
            size="icon"
            className="rounded-full shrink-0"
            title="上传化验单 PDF"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4" />
          </Button>

          {/* TTS 开关 */}
          {ttsSupported && (
            <Button
              variant="outline"
              size="icon"
              className={`rounded-full shrink-0 ${ttsEnabled ? 'border-primary text-primary' : ''}`}
              title={ttsEnabled ? '关闭语音播报' : '开启语音播报（朗读AI回复）'}
              type="button"
              onClick={() => {
                if (ttsEnabled) window.speechSynthesis?.cancel();
                setTtsEnabled(!ttsEnabled);
                toast.message(ttsEnabled ? '语音播报已关闭' : '语音播报已开启，AI 回复将自动朗读');
              }}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
          )}

          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={t('chat.placeholder') || '描述症状与持续时间…'}
            className="flex-1 rounded-full bg-background"
          />

          <Button
            onClick={() => { void handleSend(); }}
            size="icon"
            className="rounded-full shrink-0 bg-primary hover:bg-primary/90"
            disabled={isTyping}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 危急弹窗 */}
      <EmergencyModal open={emergencyOpen} onClose={() => setEmergencyOpen(false)} />
    </div>
  );
}
