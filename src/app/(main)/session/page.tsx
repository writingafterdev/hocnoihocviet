import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

// Session page — placeholder while new reading engine session flow is built
export default async function SessionPage() {
  const session = await getCurrentUser();

  if (!session) {
    redirect('/login');
  }

  redirect('/exercise');
}
