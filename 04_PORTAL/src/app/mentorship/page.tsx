import { redirect } from 'next/navigation';

export default function MentorshipPage() {
  redirect('/mypage?tab=mentorship');
}
