export type SeverityLevel = 'mild' | 'moderate' | 'severe' | 'critical';

export interface SeverityAssessment {
  level: SeverityLevel;
  score: number;
  recommendation: string;
  color: string;
}

export interface SymptomData {
  symptom: string;
  duration?: string;
  intensity?: number;
  keywords?: string[];
}

const criticalKeywords = [
  '呼吸困难', '胸痛', '昏迷', '意识不清', '大出血', 'severe bleeding',
  'chest pain', 'difficulty breathing', 'unconscious', 'seizure', '抽搐'
];

const severeKeywords = [
  '高烧', '持续疼痛', '剧烈疼痛', '呕血', '便血', 'high fever',
  'severe pain', 'vomiting blood', 'blood in stool', '发热超过39'
];

const moderateKeywords = [
  '发烧', '头痛', '腹痛', '恶心', '呕吐', 'fever', 'headache',
  'abdominal pain', 'nausea', 'vomiting', '咳嗽加重'
];

export function assessSymptomSeverity(symptomData: SymptomData): SeverityAssessment {
  let score = 0;
  const symptomText = symptomData.symptom.toLowerCase();

  // 检查关键词
  if (criticalKeywords.some(keyword => symptomText.includes(keyword.toLowerCase()))) {
    score += 40;
  }

  if (severeKeywords.some(keyword => symptomText.includes(keyword.toLowerCase()))) {
    score += 25;
  }

  if (moderateKeywords.some(keyword => symptomText.includes(keyword.toLowerCase()))) {
    score += 15;
  }

  // 基于强度评分
  if (symptomData.intensity) {
    score += symptomData.intensity * 10;
  }

  // 基于持续时间
  if (symptomData.duration) {
    const durationText = symptomData.duration.toLowerCase();
    if (durationText.includes('周') || durationText.includes('week')) {
      score += 10;
    }
    if (durationText.includes('月') || durationText.includes('month')) {
      score += 15;
    }
    if (durationText.includes('年') || durationText.includes('year')) {
      score += 5;
    }
  }

  // 确定级别
  let level: SeverityLevel;
  let recommendation: string;
  let color: string;

  if (score >= 60) {
    level = 'critical';
    recommendation = '建议立即就医或拨打急救电话';
    color = '#DC2626';
  } else if (score >= 40) {
    level = 'severe';
    recommendation = '建议尽快就医，不宜拖延';
    color = '#EA580C';
  } else if (score >= 20) {
    level = 'moderate';
    recommendation = '建议近期就医检查';
    color = '#F59E0B';
  } else {
    level = 'mild';
    recommendation = '可观察症状变化，必要时就医';
    color = '#10B981';
  }

  return {
    level,
    score: Math.min(score, 100),
    recommendation,
    color
  };
}

export function getOverallSeverity(symptoms: SymptomData[]): SeverityAssessment {
  if (symptoms.length === 0) {
    return {
      level: 'mild',
      score: 0,
      recommendation: '暂无症状记录',
      color: '#10B981'
    };
  }

  const assessments = symptoms.map(assessSymptomSeverity);
  const maxScore = Math.max(...assessments.map(a => a.score));
  const avgScore = assessments.reduce((sum, a) => sum + a.score, 0) / assessments.length;

  const finalScore = Math.round((maxScore * 0.6 + avgScore * 0.4));

  let level: SeverityLevel;
  let recommendation: string;
  let color: string;

  if (finalScore >= 60) {
    level = 'critical';
    recommendation = '建议立即就医或拨打急救电话';
    color = '#DC2626';
  } else if (finalScore >= 40) {
    level = 'severe';
    recommendation = '建议尽快就医，不宜拖延';
    color = '#EA580C';
  } else if (finalScore >= 20) {
    level = 'moderate';
    recommendation = '建议近期就医检查';
    color = '#F59E0B';
  } else {
    level = 'mild';
    recommendation = '可观察症状变化，必要时就医';
    color = '#10B981';
  }

  return { level, score: finalScore, recommendation, color };
}
