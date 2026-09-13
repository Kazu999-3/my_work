import { redirect } from 'next/navigation';

export default function PlayerIndexPage() {
  redirect('/leaderboard?tab=roster');
}
