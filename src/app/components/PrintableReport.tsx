import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity } from 'lucide-react';
import { SymptomTimeline } from './SymptomTimeline';
import { MedicationCards } from './MedicationCards';
import { QuestionsList } from './QuestionsList';
import { Checklist } from './Checklist';
import type { ReportBundle } from '@/types/report';

export interface PrintableReportProps {
  report: ReportBundle | null;
}

export const PrintableReport = forwardRef<HTMLDivElement, PrintableReportProps>(({ report }, ref) => {
  const { t } = useTranslation();
  const basic = report?.basic_info;
  const visit = basic?.visit_date || new Date().toISOString().slice(0, 10);

  return (
    <div ref={ref} className="print-container">
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }

          .print-container {
            background: white !important;
            color: black !important;
          }

          .no-print {
            display: none !important;
          }

          .print-header {
            display: flex !important;
          }

          .print-break {
            page-break-after: always;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }

        .print-header {
          display: none;
          align-items: center;
          gap: 12px;
          padding-bottom: 16px;
          border-bottom: 2px solid #2D5CFE;
          margin-bottom: 24px;
        }

        .print-logo {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #2D5CFE 0%, #5B82FF 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .print-section {
          margin-bottom: 24px;
          padding: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }

        .print-section h3 {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 12px;
          color: #2D5CFE;
        }

        .print-disclaimer {
          margin-top: 32px;
          padding: 16px;
          background: #f3f4f6;
          border-radius: 8px;
          text-align: center;
          border: 2px solid #2D5CFE;
        }

        .print-disclaimer p {
          margin: 8px 0;
          font-size: 12px;
        }

        .print-disclaimer .disclaimer-title {
          font-weight: 600;
          font-size: 14px;
          color: #DC2626;
        }
      `}</style>

      <div className="print-header">
        <div className="print-logo">
          <Activity style={{ width: 24, height: 24, color: 'white' }} />
        </div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            {t('print.title')}
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
            {t('print.generatedBy')}
          </p>
        </div>
      </div>

      <div className="print-section">
        <h3>{t('report.basicInfo')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
          <div>
            <strong>{t('report.name')}:</strong> <span>{basic?.patient_name_masked || '—'}</span>
          </div>
          <div>
            <strong>{t('report.gender')}:</strong> <span>{basic?.gender || '—'}</span>
          </div>
          <div>
            <strong>{t('report.age')}:</strong> <span>{basic?.age || '—'}</span>
          </div>
          <div>
            <strong>{t('print.date')}:</strong> <span>{visit}</span>
          </div>
        </div>
      </div>

      <div className="print-section">
        <h3>{t('timeline.title')}</h3>
        <SymptomTimeline events={report?.timeline_events} />
      </div>

      <div className="print-section">
        <h3>{t('medication.title')}</h3>
        <MedicationCards
          medications={report?.medications}
          allergies={report?.allergies}
          memoryNote={report?.memory_note}
        />
      </div>

      <div className="print-section">
        <h3>{t('questions.title')}</h3>
        <QuestionsList questions={report?.questions} />
      </div>

      <div className="print-section">
        <h3>{t('checklist.title')}</h3>
        <Checklist items={report?.checklist} />
      </div>

      <div className="print-disclaimer">
        <p className="disclaimer-title">{t('disclaimer.footer')}</p>
        <p>{t('disclaimer.description')}</p>
      </div>
    </div>
  );
});

PrintableReport.displayName = 'PrintableReport';
