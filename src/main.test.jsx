import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const createSkateboardApp = vi.fn();

vi.mock('./assets/styles.css', () => ({}));

vi.mock('@stevederico/skateboard-ui/App', () => ({
  createSkateboardApp: (...args) => createSkateboardApp(...args),
}));

vi.mock('@stevederico/skateboard-ui/Layout', () => ({
  default: () => <div data-testid="layout">Layout</div>,
}));

vi.mock('./components/HomeViewSkeleton', () => ({
  default: () => <div data-testid="home-view-skeleton">Loading</div>,
}));

vi.mock('./components/CommandMenu', () => ({
  default: () => <div data-testid="command-menu">Command Menu</div>,
}));

vi.mock('./components/VenuesView', () => ({
  default: () => <div data-testid="venues-view">Venues</div>,
}));

vi.mock('./components/MenuView', () => ({
  default: () => <div data-testid="menu-view">Menu</div>,
}));

vi.mock('./components/OrderView', () => ({
  default: () => <div data-testid="order-view">Order</div>,
}));

vi.mock('./components/MyOrdersView', () => ({
  default: () => <div data-testid="my-orders-view">Orders</div>,
}));

vi.mock('./components/OrderDetailView', () => ({
  default: () => <div data-testid="order-detail-view">Detail</div>,
}));

vi.mock('./constants.json', () => ({
  default: {
    appName: 'FanFood',
    pages: [],
  },
}));

describe('main app bootstrap', () => {
  beforeEach(() => {
    createSkateboardApp.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('boots createSkateboardApp with multi-venue routes', async () => {
    await import('./main.tsx');

    expect(createSkateboardApp).toHaveBeenCalledTimes(1);
    const config = createSkateboardApp.mock.calls[0][0];
    expect(config.defaultRoute).toBe('home');
    expect(config.appRoutes.map((r) => r.path)).toEqual([
      'home',
      'venues/:slug',
      'venues/:slug/order',
      'orders',
      'orders/:id',
    ]);
  });
});
