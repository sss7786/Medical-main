import type { ReportBundle } from '@/types/report';

/** 后端字段名容错（模型偶发 PascalCase） */
export function coerceReport(payload: Record<string, unknown>): ReportBundle {
  const bi = (payload.basic_info as Record<string, string>) || {};
  const dept = payload.department_recommendation as Record<string, string> | undefined;
  return {
    basic_info: {
      patient_name_masked:
        bi.patient_name_masked ||
        bi.patientNameMasked ||
        (payload.basicInfo as Record<string, string>)?.patient_name_masked ||
        '—',
      gender: bi.gender || '—',
      age: bi.age || '—',
      visit_date: bi.visit_date || bi.visitDate || '',
    },
    timeline_events:
      (payload.timeline_events as ReportBundle['timeline_events']) ||
      (payload.timelineEvents as ReportBundle['timeline_events']) ||
      [],
    medications:
      (payload.medications as ReportBundle['medications']) ||
      [],
    allergies: ((payload.allergies as string[]) || []).filter(Boolean),
    questions:
      (payload.questions as ReportBundle['questions']) ||
      [],
    checklist:
      (payload.checklist as ReportBundle['checklist']) ||
      [],
    department_recommendation: dept
      ? {
          primary: dept.primary || '—',
          secondary: dept.secondary || '—',
          reason: dept.reason || '',
        }
      : undefined,
    generated_at:
      (payload.generated_at as string) ||
      (payload.generatedAt as string) ||
      '',
    memory_note:
      (payload.memory_note as string) ||
      (payload.memoryNote as string) ||
      '',
  };
}
