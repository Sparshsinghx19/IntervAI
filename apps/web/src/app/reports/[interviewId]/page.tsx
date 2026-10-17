import type { Metadata } from 'next';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { ReportDetail } from '@/components/reports/ReportDetail';

export const metadata: Metadata = {
  title: 'Interview Report — IntervAI',
};

export default async function ReportDetailPage({ params }: { params: Promise<{ interviewId: string }> }) {
  const { interviewId } = await params;
  return (
    <RequireAuth>
      <ReportDetail interviewId={interviewId} />
    </RequireAuth>
  );
}
