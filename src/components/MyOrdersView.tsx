import { useNavigate } from 'react-router';
import Header from '@stevederico/skateboard-ui/Header';
import { useListData } from '@stevederico/skateboard-ui/Utilities';
import { Button } from '@stevederico/skateboard-ui/shadcn/ui/button';
import { Card, CardContent } from '@stevederico/skateboard-ui/shadcn/ui/card';
import { Badge } from '@stevederico/skateboard-ui/shadcn/ui/badge';
import { Skeleton } from '@stevederico/skateboard-ui/shadcn/ui/skeleton';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from '@stevederico/skateboard-ui/shadcn/ui/empty';

/** Order summary from GET /api/orders. */
interface FoodOrder {
  id: string;
  foodType: string;
  qty: number;
  totalPrice: number;
  status: string;
  section: string;
  row: string;
  seat: string;
  createdAt: number;
}

/**
 * Format a dollar amount.
 *
 * @param amount - Price in dollars
 * @returns Currency string
 */
function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

/**
 * Format an epoch ms timestamp.
 *
 * @param ms - Created-at epoch
 * @returns Short date string
 */
function formatWhen(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms));
}

/**
 * Past concession orders for the signed-in fan.
 *
 * @component
 * @returns Orders list view
 */
export default function MyOrdersView() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useListData('/orders') as {
    data: FoodOrder[] | null;
    loading: boolean;
    error: string | null;
    refetch: () => void;
  };

  const orders = Array.isArray(data) ? data : [];

  if (loading) {
    return (
      <>
        <Header title="My Orders" />
        <div className="flex flex-1 flex-col gap-3 p-4 md:p-6" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header title="My Orders" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <p className="text-copy-md text-destructive">{error}</p>
          <Button type="button" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </>
    );
  }

  if (orders.length === 0) {
    return (
      <>
        <Header title="My Orders" />
        <div className="flex flex-1 items-center justify-center p-6">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No orders yet</EmptyTitle>
              <EmptyDescription>Grab something from the menu — we&apos;ll bring it to your seat.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" onClick={() => navigate('/app/home')}>
                Browse Menu
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="My Orders" buttonTitle="Menu" onButtonTitleClick={() => navigate('/app/home')} />
      <div className="flex flex-1 flex-col gap-3 p-4 md:p-6">
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id}>
              <button
                type="button"
                className="w-full text-left"
                onClick={() => navigate(`/app/orders/${order.id}`)}
              >
                <Card className="transition-colors hover:bg-accent/40">
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="text-label-lg truncate">
                        {order.qty}× {order.foodType}
                      </span>
                      <span className="text-copy-sm text-muted-foreground">
                        Sec {order.section} · Row {order.row} · Seat {order.seat} · {formatWhen(order.createdAt)}
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-label-md">{formatPrice(order.totalPrice)}</span>
                      <Badge variant="secondary">{order.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
