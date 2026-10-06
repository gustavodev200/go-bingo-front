import { NicknameForm } from '@/features/auth/nickname-form';
import { suggestNickname } from '@/lib/nickname';
import { safeNextPath } from '@/lib/safe-next';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function NicknamePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const fullName = (data.user?.user_metadata as { full_name?: string } | undefined)?.full_name;
  return <NicknameForm next={safeNextPath(next)} suggestion={suggestNickname(fullName)} />;
}
