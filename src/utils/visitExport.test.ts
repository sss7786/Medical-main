import { describe, expect, it } from 'vitest';
import { buildVisitExportBundle, visitExportToMarkdown } from './visitExport';
import type { VisitExportMarkdownLabels } from './visitExport';

const labels: VisitExportMarkdownLabels = {
  docTitle: 'T',
  exportedAt: 'ea',
  scenario: 'sc',
  sessionId: 'sid',
  locale: 'lo',
  sectionChat: 'chat',
  sectionHints: 'hints',
  sectionReport: 'rep',
  emptyChat: 'ec',
  emptyHints: 'eh',
  noReport: 'nr',
  basicInfo: 'bi',
  colField: 'cf',
  colValue: 'cv',
  name: 'n',
  gender: 'g',
  age: 'a',
  visitDate: 'vd',
  department: 'dep',
  primary: 'p',
  secondary: 's',
  reason: 'r',
  timeline: 'tl',
  medications: 'med',
  allergies: 'al',
  questions: 'q',
  checklist: 'cl',
  reportGenerated: 'rg',
  footer: 'foot',
  roleUser: 'u',
  roleAssistant: 'as',
};

describe('visitExport', () => {
  it('buildVisitExportBundle preserves structure', () => {
    const b = buildVisitExportBundle({
      sessionId: 'abc',
      scenarioId: 'pediatrics',
      scenarioLabel: '儿科',
      messages: [{ role: 'user', content: '发烧' }],
      formHints: ['[症状] 发热'],
      report: null,
      locale: 'zh',
      disclaimer: 'd',
    });
    expect(b.version).toBe(1);
    expect(b.scenario_id).toBe('pediatrics');
    expect(b.messages).toHaveLength(1);
    expect(b.form_hints).toEqual(['[症状] 发热']);
  });

  it('visitExportToMarkdown includes user content', () => {
    const b = buildVisitExportBundle({
      sessionId: 'x',
      scenarioId: 'general',
      scenarioLabel: 'G',
      messages: [{ role: 'user', content: '头痛' }],
      formHints: [],
      report: null,
      locale: 'zh',
      disclaimer: 'disc',
    });
    const md = visitExportToMarkdown(b, labels);
    expect(md).toContain('头痛');
    expect(md).toContain('disc');
  });
});
