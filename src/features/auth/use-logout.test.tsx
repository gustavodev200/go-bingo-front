import { renderHook } from '@testing-library/react';
import { useLogout } from './use-logout';

const replace = vi.fn();
const signOut = vi.fn().mockResolvedValue({ error: null });
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut } }) }));

it('signs out and goes to the login page', async () => {
  const { result } = renderHook(() => useLogout());
  await result.current();
  expect(signOut).toHaveBeenCalled();
  expect(replace).toHaveBeenCalledWith('/login');
});
