import type { Metadata } from 'next';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { ReportsHistory } from '@/components/reports/ReportsHistory';

export const metadata: Metadata = {
  title: 'My Interview Reports — IntervAI',
};

export default function ReportsPage() {
  return (
    <RequireAuth>
      <ReportsHistory />
    </RequireAuth>
  );
}
