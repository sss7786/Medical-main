import { describe, expect, it } from 'vitest';
import { coerceReport } from './reportMap';

describe('coerceReport', () => {
  it('maps camelCase backend keys', () => {
    const r = coerceReport({
      basicInfo: { patient_name_masked: '张*' },
      timelineEvents: [],
      medications: [],
      allergies: [],
      questions: [],
      checklist: [],
    });
    expect(r.basic_info.patient_name_masked).toBe('张*');
    expect(r.timeline_events).toEqual([]);
  });

  it('fills defaults for missing basic_info', () => {
    const r = coerceReport({
      timeline_events: [],
      medications: [],
      allergies: [],
      questions: [],
      checklist: [],
    });
    expect(r.basic_info.gender).toBe('—');
  });
});
