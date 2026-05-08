/** 接诊场景模板（影响欢迎语、对话进度关键词、分步表单快速选项） */

export type ConsultScenarioId = 'general' | 'pediatrics' | 'chronic';

export const SCENARIO_STORAGE_KEY = 'medbrief_scenario_v1';

export const DEFAULT_SCENARIO: ConsultScenarioId = 'general';

export const SCENARIO_IDS: ConsultScenarioId[] = ['general', 'pediatrics', 'chronic'];

export function normalizeScenario(raw: string | null | undefined): ConsultScenarioId {
  if (raw === 'pediatrics' || raw === 'chronic' || raw === 'general') return raw;
  return DEFAULT_SCENARIO;
}

export function readStoredScenario(): ConsultScenarioId {
  try {
    return normalizeScenario(localStorage.getItem(SCENARIO_STORAGE_KEY));
  } catch {
    return DEFAULT_SCENARIO;
  }
}

export function writeStoredScenario(id: ConsultScenarioId): void {
  try {
    localStorage.setItem(SCENARIO_STORAGE_KEY, id);
  } catch {
    /* private mode */
  }
}

export type ChatProgressStepDef = { labelKey: string; keywords: string[] };

/** 末项为「信息完整」占位，keywords 为空 */
export const CHAT_PROGRESS_BY_SCENARIO: Record<ConsultScenarioId, ChatProgressStepDef[]> = {
  general: [
    { labelKey: 'chat.progress.symptoms', keywords: ['症状', '不舒服', '疼', '痛', '发烧', '咳嗽', '难受', '头晕', '恶心', '肚子', '腹', '泻', '吐', '闷', '胀', '乏力', '哪里', '哪个位置'] },
    { labelKey: 'chat.progress.timeline', keywords: ['天', '周', '小时', '分钟', '开始', '多久', '持续', '逐渐', '一直', '昨天', '昨晚', '前天', '刚才', '最近', '之前'] },
    { labelKey: 'chat.progress.meds', keywords: ['药', '吃了', '服用', '处方', '非处方', 'OTC', '维生素'] },
    { labelKey: 'chat.progress.history', keywords: ['过敏', '慢性病', '高血压', '糖尿病', '心脏', '手术', '既往'] },
    { labelKey: 'chat.progress.done', keywords: [] },
  ],
  pediatrics: [
    { labelKey: 'chat.progressPed.symptoms', keywords: ['孩子', '宝宝', '患儿', '发烧', '咳嗽', '吐', '拉', '哭闹', '皮疹', '精神'] },
    { labelKey: 'chat.progressPed.timeline', keywords: ['天', '小时', '昨晚', '今早', '多久', '开始', '接种', '体温'] },
    { labelKey: 'chat.progressPed.meds', keywords: ['退烧药', '美林', '泰诺林', '儿童', '剂量', '毫升', '止咳', '益生菌'] },
    { labelKey: 'chat.progressPed.history', keywords: ['过敏', '疫苗', '既往', '出生', '早产', '湿疹', '哮喘'] },
    { labelKey: 'chat.progress.done', keywords: [] },
  ],
  chronic: [
    { labelKey: 'chat.progressChr.symptoms', keywords: ['复查', '指标', '血压', '血糖', '头晕', '乏力', '水肿', '胸闷', '体重'] },
    { labelKey: 'chat.progressChr.timeline', keywords: ['上次', '本周', '最近', '加重', '缓解', '多久', '调整'] },
    { labelKey: 'chat.progressChr.meds', keywords: ['药', '依从', '漏服', '加量', '减量', '胰岛素', '降压药'] },
    { labelKey: 'chat.progressChr.history', keywords: ['合并', '并发症', '肾', '眼', '高血脂', '手术', '住院'] },
    { labelKey: 'chat.progress.done', keywords: [] },
  ],
};

export function getProgressSteps(scenarioId: ConsultScenarioId): ChatProgressStepDef[] {
  return CHAT_PROGRESS_BY_SCENARIO[scenarioId];
}

/**
 * 从「首条用户消息」起拼接用户+助手全文做关键词匹配，使进度条随对话（含流式助手回复）实时更新；
 * 排除仅有欢迎语时尚未问诊的阶段。
 */
export function computeChatProgressStep(
  messages: ReadonlyArray<{ role: string; content: string }>,
  scenarioId: ConsultScenarioId,
): number {
  const firstUserIdx = messages.findIndex((m) => m.role === 'user');
  if (firstUserIdx < 0) return 0;
  const corpus = messages
    .slice(firstUserIdx)
    .map((m) => m.content)
    .join('\n');
  const steps = getProgressSteps(scenarioId);
  let step = 0;
  for (let i = 0; i < steps.length - 1; i++) {
    const kws = steps[i].keywords;
    if (kws.length === 0 || kws.some((k) => corpus.includes(k))) {
      step = i + 1;
    }
  }
  return Math.min(step, steps.length - 1);
}
