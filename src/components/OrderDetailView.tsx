import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import Header from '@stevederico/skateboard-ui/Header';
import { apiRequest } from '@stevederico/skateboard-ui/Utilities';
import { Button } from '@stevederico/skateboard-ui/shadcn/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@stevederico/skateboard-ui/shadcn/ui/card';
import { Badge } from '@stevederico/skateboard-ui/shadcn/ui/badge';
import { Skeleton } from '@stevederico/skateboard-ui/shadcn/ui/skeleton';

/** Full order from GET /api/orders/:id. */
interface FoodOrder {
  id: string;
  foodType: string;
  qty: number;
  totalPrice: number;
  stadium: string;
  section: string;
  row: string;
  seat: string;
  paymentType: string;
  status: string;
  confirmNumber: string;
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
 * Thank-you / order receipt detail.
 *
 * @component
 * @returns Order detail view
 */
export default function OrderDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<FoodOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Missing order id');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = (await apiRequest(`/orders/${id}`)) as FoodOrder;
        if (!cancelled) setOrder(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load order');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <>
        <Header title="Order" />
        <div className="flex flex-1 flex-col gap-3 p-4 md:p-6" aria-busy="true">
          <Skeleton className="mx-auto h-64 w-full max-w-lg rounded-lg" />
        </div>
      </>
    );
  }

  if (error || !order) {
    return (
      <>
        <Header title="Order" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <p className="text-copy-md text-destructive">{error ?? 'Order not found'}</p>
          <Button type="button" onClick={() => navigate('/app/orders')}>
            My Orders
          </Button>
        </div>
      </>
    );
  }

  const rows: { label: string; value: string }[] = [
    { label: 'Confirm #', value: order.confirmNumber },
    { label: 'Status', value: order.status },
    { label: 'Food', value: `${order.qty}× ${order.foodType}` },
    { label: 'Total', value: formatPrice(order.totalPrice) },
    { label: 'Stadium', value: order.stadium },
    { label: 'Section', value: order.section },
    { label: 'Row', value: order.row },
    { label: 'Seat', value: order.seat },
    { label: 'Payment', value: order.paymentType },
    {
      label: 'Placed',
      value: new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(order.createdAt)),
    },
  ];

  return (
    <>
      <Header title="Thank You" buttonTitle="Menu" onButtonTitleClick={() => navigate('/app/home')} />
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <Card className="mx-auto w-full max-w-lg">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-heading-md">Order confirmed</CardTitle>
            <Badge>{order.status}</Badge>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3">
              {rows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-border pb-2 last:border-0">
                  <dt className="text-copy-sm text-muted-foreground">{row.label}</dt>
                  <dd className="text-label-md text-right">{row.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => navigate('/app/orders')}>
                My Orders
              </Button>
              <Button type="button" onClick={() => navigate('/app/home')}>
                Order More
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
