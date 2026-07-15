import { getState } from '@stevederico/skateboard-ui/Context';

/** User shape from /api/me including admin flag. */
export interface FanFoodUser {
  _id?: string;
  email?: string;
  name?: string;
  isAdmin?: boolean;
}

/**
 * Read isAdmin from skateboard context user.
 *
 * @returns True when the signed-in user is an admin
 */
export function useIsAdmin(): boolean {
  const { state } = getState();
  const user = state.user as FanFoodUser | null | undefined;
  return Boolean(user?.isAdmin);
}
