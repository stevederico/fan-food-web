import { useNavigate } from 'react-router';
import Header from '@stevederico/skateboard-ui/Header';
import { useListData } from '@stevederico/skateboard-ui/Utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@stevederico/skateboard-ui/shadcn/ui/card';
import { Button } from '@stevederico/skateboard-ui/shadcn/ui/button';
import { Skeleton } from '@stevederico/skateboard-ui/shadcn/ui/skeleton';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@stevederico/skateboard-ui/shadcn/ui/empty';

/** Menu item from GET /api/menu. */
interface MenuItem {
  id: string;
  name: string;
  price: number;
}

const STADIUM = 'AT&T Park';

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
 * Concession menu — pick food to order to your seat.
 *
 * @component
 * @returns Menu grid view
 */
export default function MenuView() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useListData<MenuItem>('/menu');
  const items = Array.isArray(data) ? data : [];

  if (loading) {
    return (
      <>
        <Header title="Menu" />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6" aria-busy="true" aria-live="polite">
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header title="Menu" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <p className="text-copy-md text-destructive">{error}</p>
          <Button type="button" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <Header title="Menu" />
        <div className="flex flex-1 items-center justify-center p-6">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No menu items</EmptyTitle>
              <EmptyDescription>Check back when concessions open.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Menu" buttonTitle="My Orders" onButtonTitleClick={() => navigate('/app/orders')} />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <p className="text-copy-md text-muted-foreground">
          Order to your seat at <span className="font-medium text-foreground">{STADIUM}</span>
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-heading-sm">{item.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <span className="text-label-md text-muted-foreground">{formatPrice(item.price)}</span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      navigate(`/app/order?name=${encodeURIComponent(item.name)}&price=${item.price}`)
                    }
                  >
                    Order
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
