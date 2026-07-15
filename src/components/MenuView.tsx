import { useNavigate, useParams } from 'react-router';
import { useEffect, useState } from 'react';
import Header from '@stevederico/skateboard-ui/Header';
import { apiRequest, useListData } from '@stevederico/skateboard-ui/Utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@stevederico/skateboard-ui/shadcn/ui/card';
import { Button } from '@stevederico/skateboard-ui/shadcn/ui/button';
import { Badge } from '@stevederico/skateboard-ui/shadcn/ui/badge';
import { Skeleton } from '@stevederico/skateboard-ui/shadcn/ui/skeleton';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@stevederico/skateboard-ui/shadcn/ui/empty';

/** Menu item from GET /api/venues/:slug/menu. */
interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string | null;
}

/** Venue from GET /api/venues/:slug. */
interface Venue {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  deliveryMode: string;
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
 * Venue concession menu — order to a seat at this ballpark.
 *
 * @component
 * @returns Menu grid for a venue
 */
export default function MenuView() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [venueError, setVenueError] = useState<string | null>(null);

  const menuPath = slug ? `/venues/${slug}/menu` : '';
  const { data, loading, error, refetch } = useListData<MenuItem>(menuPath || '/venues');
  const items = slug && Array.isArray(data) ? data : [];

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const v = (await apiRequest(`/venues/${slug}`)) as Venue;
        if (!cancelled) setVenue(v);
      } catch (e) {
        if (!cancelled) setVenueError(e instanceof Error ? e.message : 'Venue not found');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug) {
    return (
      <>
        <Header title="Menu" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <p className="text-copy-md text-muted-foreground">Choose a venue first.</p>
          <Button type="button" onClick={() => navigate('/app/home')}>
            Venues
          </Button>
        </div>
      </>
    );
  }

  if (venueError) {
    return (
      <>
        <Header title="Menu" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <p className="text-copy-md text-destructive">{venueError}</p>
          <Button type="button" onClick={() => navigate('/app/home')}>
            Venues
          </Button>
        </div>
      </>
    );
  }

  if (loading || !venue) {
    return (
      <>
        <Header title="Menu" />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6" aria-busy="true">
          <Skeleton className="h-5 w-48" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header title={venue.name} />
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
        <Header title={venue.name} />
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
      <Header
        title={venue.name}
        buttonTitle="My Orders"
        onButtonTitleClick={() => navigate('/app/orders')}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/app/home')}>
            ← Venues
          </Button>
          <p className="text-copy-md text-muted-foreground">
            {venue.city}, {venue.state}
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-heading-sm">{item.name}</CardTitle>
                    <Badge variant="outline">{item.category}</Badge>
                  </div>
                  {item.description ? (
                    <p className="text-copy-sm text-muted-foreground">{item.description}</p>
                  ) : null}
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <span className="text-label-md text-muted-foreground">{formatPrice(item.price)}</span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      navigate(
                        `/app/venues/${slug}/order?item=${encodeURIComponent(item.id)}&name=${encodeURIComponent(item.name)}&price=${item.price}`
                      )
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
