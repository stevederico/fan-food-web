/**
 * Application entry point using Skateboard Application Shell Architecture
 *
 * FanFood: multi-venue in-seat ordering with admin portal + fan view.
 *
 * @see {@link https://github.com/stevederico/skateboard|Skateboard Docs}
 */
import './assets/styles.css';
import { lazy, Suspense } from 'react';
import { createSkateboardApp } from '@stevederico/skateboard-ui/App';
import type { AppRoute } from '@stevederico/skateboard-ui/App';
import Layout from '@stevederico/skateboard-ui/Layout';
import CommandMenu from './components/CommandMenu';
import HomeViewSkeleton from './components/HomeViewSkeleton';
import constants from './constants.json';

const VenuesView = lazy(() => import('./components/VenuesView'));
const MenuView = lazy(() => import('./components/MenuView'));
const OrderView = lazy(() => import('./components/OrderView'));
const MyOrdersView = lazy(() => import('./components/MyOrdersView'));
const OrderDetailView = lazy(() => import('./components/OrderDetailView'));
const AdminVenuesView = lazy(() => import('./components/AdminVenuesView'));
const AdminVenueDetailView = lazy(() => import('./components/AdminVenueDetailView'));

/**
 * App layout with global command menu overlay.
 *
 * @returns Layout with command menu
 */
export function AppLayout() {
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
  {
    path: 'admin',
    element: (
      <Suspense fallback={<HomeViewSkeleton />}>
        <AdminVenuesView />
      </Suspense>
    ),
  },
  {
    path: 'admin/venues/:id',
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
