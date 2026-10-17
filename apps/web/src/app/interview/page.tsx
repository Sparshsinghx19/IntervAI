import { InterviewSetup } from '@/components/interview/InterviewSetup';
import { RequireAuth } from '@/components/auth/RequireAuth';

export default function InterviewPage() {
  return (
    <RequireAuth>
      <InterviewSetup />
    </RequireAuth>
  );
}
