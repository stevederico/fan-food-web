/**
 * Application entry point using Skateboard Application Shell Architecture
 *
 * FanFood: multi-venue in-seat ordering with admin portal + fan view.
 *
 * @see {@link https://github.com/stevederico/skateboard|Skateboard Docs}
 */
import './assets/styles.css';
import { lazy, Suspense, useEffect } from 'react';
import { createSkateboardApp } from '@stevederico/skateboard-ui/App';
import type { AppRoute } from '@stevederico/skateboard-ui/App';
import Layout from '@stevederico/skateboard-ui/Layout';
import { getState } from '@stevederico/skateboard-ui/Context';
import { apiRequest } from '@stevederico/skateboard-ui/Utilities';
import CommandMenu from './components/CommandMenu';
import HomeViewSkeleton from './components/HomeViewSkeleton';
import constants from './constants.json';
import { useIsAdmin, type FanFoodUser } from './lib/isAdmin';

const VenuesView = lazy(() => import('./components/VenuesView'));
const MenuView = lazy(() => import('./components/MenuView'));
const OrderView = lazy(() => import('./components/OrderView'));
const MyOrdersView = lazy(() => import('./components/MyOrdersView'));
const OrderDetailView = lazy(() => import('./components/OrderDetailView'));
const AdminVenuesView = lazy(() => import('./components/AdminVenuesView'));
const AdminVenueDetailView = lazy(() => import('./components/AdminVenueDetailView'));

/** Snapshot of nav pages from constants (includes Manage). */
const ALL_PAGES = [...constants.pages];
/** Fan-visible nav (no Manage). */
const FAN_PAGES = ALL_PAGES.filter((p) => p.url !== 'manage');
/** Admin-only nav entry. */
const MANAGE_PAGE = ALL_PAGES.find((p) => p.url === 'manage');

/**
 * Sync sidebar/tab/command nav: Manage only when `user.isAdmin`.
 *
 * Mutates `state.constants.pages` before shell Sidebar/TabBar render.
 * Also refreshes `/api/me` so isAdmin is correct after deploy.
 *
 * @returns Layout with command menu
 */
export function AppLayout() {
  const isAdmin = useIsAdmin();
  const { state, dispatch } = getState();

  // Shell reads constants.pages for Sidebar + TabBar + CommandMenu
  state.constants.pages =
    isAdmin && MANAGE_PAGE ? [...FAN_PAGES, MANAGE_PAGE] : FAN_PAGES;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = (await apiRequest('/me')) as FanFoodUser;
        if (cancelled || !me) return;
        dispatch({ type: 'SET_USER', payload: me as never });
      } catch {
        // Not signed in or network error — leave stored user as-is
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return (
    <>
      <CommandMenu />
      <Layout />
    </>
  );
}

/**
 * Application route configuration.
 *
 * Fan: home, venues/:slug, order, orders.
 * Admin: admin, admin/venues/:id.
 */
export const appRoutes: AppRoute[] = [
  {
    path: 'home',
    element: (
      <Suspense fallback={<HomeViewSkeleton />}>
        <VenuesView />
      </Suspense>
    ),
  },
  {
    path: 'venues/:slug',
    element: (
      <Suspense fallback={<HomeViewSkeleton />}>
        <MenuView />
      </Suspense>
    ),
  },
  {
    path: 'venues/:slug/order',
    element: (
      <Suspense fallback={<HomeViewSkeleton />}>
        <OrderView />
      </Suspense>
    ),
  },
  {
    path: 'orders',
    element: (
      <Suspense fallback={<HomeViewSkeleton />}>
        <MyOrdersView />
      </Suspense>
    ),
  },
  {
    path: 'orders/:id',
    element: (
      <Suspense fallback={<HomeViewSkeleton />}>
        <OrderDetailView />
      </Suspense>
    ),
  },
  // Note: route must NOT be "admin" — Cloudflare Bot Fight blocks /admin paths (403).
  {
    path: 'manage',
    element: (
      <Suspense fallback={<HomeViewSkeleton />}>
        <AdminVenuesView />
      </Suspense>
    ),
  },
  {
    path: 'manage/venues/:id',
    element: (
      <Suspense fallback={<HomeViewSkeleton />}>
        <AdminVenueDetailView />
      </Suspense>
    ),
  },
];

createSkateboardApp({
  constants,
  appRoutes,
  defaultRoute: 'home',
  overrides: { layout: AppLayout },
});

setTimeout(() => import('./components/VenuesView'), 2000);
