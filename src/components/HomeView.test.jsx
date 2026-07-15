import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import MenuView from './MenuView';

const navigate = vi.fn();
const refetch = vi.fn();

vi.mock('react-router', () => ({
  useNavigate: () => navigate,
}));

vi.mock('@stevederico/skateboard-ui/Header', () => ({
  default: ({ title, buttonTitle }) => (
    <header data-testid="header">
      {title}
      {buttonTitle ? <span>{buttonTitle}</span> : null}
    </header>
  ),
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
  Button: ({ children, ...props }) => <button type="button" {...props}>{children}</button>,
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

describe('MenuView', () => {
  beforeEach(() => {
    navigate.mockReset();
    refetch.mockReset();
  });

  it('renders menu items from the API', () => {
    useListData.mockReturnValue({
      data: [{ id: 'hot-dog', name: 'Hot Dog', price: 4.25 }],
      loading: false,
      error: null,
      refetch,
    });

    render(<MenuView />);

    expect(screen.getByTestId('header')).toHaveTextContent('Menu');
    expect(screen.getByText('Hot Dog')).toBeInTheDocument();
    expect(screen.getByText('$4.25')).toBeInTheDocument();
  });
});
