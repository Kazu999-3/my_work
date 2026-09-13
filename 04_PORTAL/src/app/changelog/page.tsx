import { redirect } from 'next/navigation';

export default function ChangelogPage() {
  redirect('/guide?tab=updates');
}
