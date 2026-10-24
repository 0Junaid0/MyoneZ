import { useQuery } from '@tanstack/react-query';
import { draftsApi } from '../api/drafts';

/** Number of drafts waiting for review. Use it for the Drafts tab badge (Member 4) and Home (Member 1). */
export function useDraftsWaiting(): number {
  const { data } = useQuery({ queryKey: ['drafts'], queryFn: () => draftsApi.list() });
  return (data ?? []).filter((d) => d.status === 'pending_review').length;
}
