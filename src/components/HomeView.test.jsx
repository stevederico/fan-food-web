import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import VenuesView from './VenuesView';

const navigate = vi.fn();
const refetch = vi.fn();

vi.mock('react-router', () => ({
  useNavigate: () => navigate,
}));

vi.mock('@stevederico/skateboard-ui/Header', () => ({
  default: ({ title }) => <header data-testid="header">{title}</header>,
}));

vi.mock('@stevederico/skateboard-ui/Utilities', () => ({
  useListData: vi.fn(),
}));

vi.mock('@stevederico/skateboard-ui/shadcn/ui/card', () => ({
  Card: ({ children }) => <div>{children}</div>,
  CardContent: ({ children }) => <div>{children}</div>,
  CardHeader: ({ children }) => <div>{children}</div>,
  CardTitle: ({ children }) => <h2>{children}</h2>,
}));

vi.mock('@stevederico/skateboard-ui/shadcn/ui/button', () => ({
  Button: ({ children, ...props }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@stevederico/skateboard-ui/shadcn/ui/badge', () => ({
  Badge: ({ children }) => <span>{children}</span>,
}));

vi.mock('@stevederico/skateboard-ui/shadcn/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

vi.mock('@stevederico/skateboard-ui/shadcn/ui/empty', () => ({
  Empty: ({ children }) => <div>{children}</div>,
  EmptyHeader: ({ children }) => <div>{children}</div>,
  EmptyTitle: ({ children }) => <h3>{children}</h3>,
  EmptyDescription: ({ children }) => <p>{children}</p>,
}));

import { useListData } from '@stevederico/skateboard-ui/Utilities';

describe('VenuesView', () => {
  beforeEach(() => {
    navigate.mockReset();
    refetch.mockReset();
  });

  it('renders venues from the API', () => {
    useListData.mockReturnValue({
      data: [
        {
          id: '1',
          slug: 'oracle-park',
          name: 'Oracle Park',
          shortName: 'Oracle Park',
          city: 'San Francisco',
          state: 'CA',
          address: '24 Willie Mays Plaza',
          capacity: 41265,
          deliveryMode: 'premium',
        },
      ],
      loading: false,
      error: null,
      refetch,
    });

    render(<VenuesView />);

    expect(screen.getByTestId('header')).toHaveTextContent('Order Food');
    expect(screen.getByText('Oracle Park')).toBeInTheDocument();
    expect(screen.getByText(/San Francisco/)).toBeInTheDocument();
  });
});
