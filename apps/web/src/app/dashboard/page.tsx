import type { Metadata } from 'next';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { Dashboard } from '@/components/dashboard/Dashboard';

export const metadata: Metadata = {
  title: 'Dashboard — IntervAI',
};

export default function DashboardPage() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}
