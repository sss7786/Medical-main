/** 与后端 `/api/synthesize` 返回结构对齐 */

export interface BasicInfo {
  patient_name_masked: string;
  gender: string;
  age: string;
  visit_date: string;
}

export interface TimelineEvent {
  id: string;
  day: string;
  date: string;
  description: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface MedicationItem {
  id: string;
  name: string;
  frequency: string;
  duration: string;
  type: 'prescription' | 'otc';
}

export interface QuestionItem {
  id: string;
  question: string;
  reason: string;
}

export interface ChecklistItem {
  id: string;
  item: string;
  required: boolean;
}

export interface DepartmentRecommendation {
  primary: string;
  secondary: string;
  reason: string;
}

export interface ReportBundle {
  basic_info: BasicInfo;
  timeline_events: TimelineEvent[];
  medications: MedicationItem[];
  allergies: string[];
  questions: QuestionItem[];
  checklist: ChecklistItem[];
  department_recommendation?: DepartmentRecommendation;
  generated_at?: string;
  memory_note?: string;
}

/** 历史会话摘要（列表用） */
export interface SessionInfo {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  has_report: boolean;
}

/** 历史会话完整数据 */
export interface SessionDetail {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: Array<{ role: string; content: string }>;
  form_hints: string[];
  report: ReportBundle | null;
}
