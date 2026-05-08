import type { ChatMessage } from '@/api/client';
import type { ReportBundle } from '@/types/report';
import type { ConsultScenarioId } from '@/utils/consultScenarios';

export const VISIT_EXPORT_VERSION = 1 as const;

export interface VisitExportBundle {
  version: typeof VISIT_EXPORT_VERSION;
  exported_at: string;
  locale: string;
  scenario_id: ConsultScenarioId;
  scenario_label: string;
  session_id: string;
  messages: Pick<ChatMessage, 'role' | 'content'>[];
  form_hints: string[];
  report: ReportBundle | null;
  disclaimer: string;
}

export function buildVisitExportBundle(params: {
  sessionId: string;
  scenarioId: ConsultScenarioId;
  scenarioLabel: string;
  messages: ChatMessage[];
  formHints: string[];
  report: ReportBundle | null;
  locale: string;
  disclaimer: string;
}): VisitExportBundle {
  return {
    version: VISIT_EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    locale: params.locale,
    scenario_id: params.scenarioId,
    scenario_label: params.scenarioLabel,
    session_id: params.sessionId,
    messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
    form_hints: [...params.formHints],
    report: params.report,
    disclaimer: params.disclaimer,
  };
}

export function visitExportToJson(bundle: VisitExportBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

function mdEscape(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r\n/g, '\n');
}

/** 患者可携带的 Markdown 摘要（非诊断证明，与报告免责声明一致） */
export function visitExportToMarkdown(bundle: VisitExportBundle, labels: VisitExportMarkdownLabels): string {
  const lines: string[] = [];
  lines.push(`# ${labels.docTitle}`);
  lines.push('');
  lines.push(`- **${labels.exportedAt}**: ${bundle.exported_at}`);
  lines.push(`- **${labels.scenario}**: ${bundle.scenario_label}`);
  lines.push(`- **${labels.sessionId}**: \`${bundle.session_id}\``);
  lines.push(`- **${labels.locale}**: ${bundle.locale}`);
  lines.push('');
  lines.push(`> ${bundle.disclaimer}`);
  lines.push('');

  lines.push(`## ${labels.sectionChat}`);
  lines.push('');
  if (!bundle.messages.length) {
    lines.push(labels.emptyChat);
  } else {
    for (const m of bundle.messages) {
      const who = m.role === 'user' ? labels.roleUser : m.role === 'assistant' ? labels.roleAssistant : m.role;
      lines.push(`### ${who}`);
      lines.push('');
      lines.push('```');
      lines.push(mdEscape(m.content));
      lines.push('```');
      lines.push('');
    }
  }

  lines.push(`## ${labels.sectionHints}`);
  lines.push('');
  if (!bundle.form_hints.length) {
    lines.push(labels.emptyHints);
  } else {
    for (const h of bundle.form_hints) {
      lines.push(`- ${mdEscape(h)}`);
    }
    lines.push('');
  }

  lines.push(`## ${labels.sectionReport}`);
  lines.push('');
  if (!bundle.report) {
    lines.push(labels.noReport);
  } else {
    const r = bundle.report;
    lines.push(`### ${labels.basicInfo}`);
    lines.push('');
    lines.push(`| ${labels.colField} | ${labels.colValue} |`);
    lines.push('| --- | --- |');
    lines.push(`| ${labels.name} | ${mdEscape(r.basic_info?.patient_name_masked ?? '—')} |`);
    lines.push(`| ${labels.gender} | ${mdEscape(r.basic_info?.gender ?? '—')} |`);
    lines.push(`| ${labels.age} | ${mdEscape(r.basic_info?.age ?? '—')} |`);
    lines.push(`| ${labels.visitDate} | ${mdEscape(r.basic_info?.visit_date ?? '—')} |`);
    lines.push('');

    if (r.department_recommendation?.primary) {
      lines.push(`### ${labels.department}`);
      lines.push('');
      lines.push(
        `- **${labels.primary}**: ${mdEscape(r.department_recommendation.primary)}`,
      );
      if (r.department_recommendation.secondary) {
        lines.push(`- **${labels.secondary}**: ${mdEscape(r.department_recommendation.secondary)}`);
      }
      if (r.department_recommendation.reason) {
        lines.push(`- **${labels.reason}**: ${mdEscape(r.department_recommendation.reason)}`);
      }
      lines.push('');
    }

    if (r.timeline_events?.length) {
      lines.push(`### ${labels.timeline}`);
      lines.push('');
      for (const ev of r.timeline_events) {
        lines.push(`- **${mdEscape(ev.day)}** (${mdEscape(ev.date)}): ${mdEscape(ev.description)}`);
      }
      lines.push('');
    }

    if (r.medications?.length) {
      lines.push(`### ${labels.medications}`);
      lines.push('');
      for (const med of r.medications) {
        lines.push(`- ${mdEscape(med.name)} — ${mdEscape(med.frequency)} / ${mdEscape(med.duration)}`);
      }
      lines.push('');
    }

    if (r.allergies?.length) {
      lines.push(`### ${labels.allergies}`);
      lines.push('');
      lines.push(r.allergies.map((a) => `- ${mdEscape(a)}`).join('\n'));
      lines.push('');
    }

    if (r.questions?.length) {
      lines.push(`### ${labels.questions}`);
      lines.push('');
      for (const q of r.questions) {
        lines.push(`- ${mdEscape(q.question)}`);
      }
      lines.push('');
    }

    if (r.checklist?.length) {
      lines.push(`### ${labels.checklist}`);
      lines.push('');
      for (const c of r.checklist) {
        const mark = c.required ? '☐*' : '☐';
        lines.push(`- ${mark} ${mdEscape(c.item)}`);
      }
      lines.push('');
    }

    if (r.generated_at) {
      lines.push(`*${labels.reportGenerated} ${mdEscape(r.generated_at)}*`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push(labels.footer);
  lines.push('');
  return lines.join('\n');
}

export interface VisitExportMarkdownLabels {
  docTitle: string;
  exportedAt: string;
  scenario: string;
  sessionId: string;
  locale: string;
  sectionChat: string;
  sectionHints: string;
  sectionReport: string;
  emptyChat: string;
  emptyHints: string;
  noReport: string;
  basicInfo: string;
  colField: string;
  colValue: string;
  name: string;
  gender: string;
  age: string;
  visitDate: string;
  department: string;
  primary: string;
  secondary: string;
  reason: string;
  timeline: string;
  medications: string;
  allergies: string;
  questions: string;
  checklist: string;
  reportGenerated: string;
  footer: string;
  roleUser: string;
  roleAssistant: string;
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
