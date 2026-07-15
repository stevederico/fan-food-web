import { useNavigate } from 'react-router';
import Header from '@stevederico/skateboard-ui/Header';
import { useListData } from '@stevederico/skateboard-ui/Utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@stevederico/skateboard-ui/shadcn/ui/card';
import { Button } from '@stevederico/skateboard-ui/shadcn/ui/button';
import { Badge } from '@stevederico/skateboard-ui/shadcn/ui/badge';
import { Skeleton } from '@stevederico/skateboard-ui/shadcn/ui/skeleton';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@stevederico/skateboard-ui/shadcn/ui/empty';

/** Venue summary from GET /api/venues. */
interface Venue {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  city: string;
  state: string;
  address: string;
  capacity: number | null;
  deliveryMode: 'premium' | 'all' | 'pickup_only';
}

/**
 * Label for a venue's delivery mode.
 *
 * @param mode - Delivery mode
 * @returns Human label
 */
function deliveryLabel(mode: Venue['deliveryMode']): string {
  if (mode === 'all') return 'In-seat delivery';
  if (mode === 'premium') return 'Premium in-seat';
  return 'Pickup only';
}

/**
 * Choose a ballpark to order from.
 *
 * @component
 * @returns Venue list view
 */
export default function VenuesView() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useListData<Venue>('/venues');
  const venues = Array.isArray(data) ? data : [];

  if (loading) {
    return (
      <>
        <Header title="Order Food" />
        <div className="flex flex-1 flex-col gap-3 p-4 md:p-6" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header title="Order Food" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <p className="text-copy-md text-destructive">{error}</p>
          <Button type="button" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </>
    );
  }

  if (venues.length === 0) {
    return (
      <>
        <Header title="Order Food" />
        <div className="flex flex-1 items-center justify-center p-6">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No venues yet</EmptyTitle>
              <EmptyDescription>Ballparks will show up here when they go live.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Order Food" buttonTitle="My Orders" onButtonTitleClick={() => navigate('/app/orders')} />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <p className="text-copy-md text-muted-foreground">
          Fan view — pick your ballpark, then order to your seat.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {venues.map((venue) => (
            <li key={venue.id}>
              <Card className="h-full">
                <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <CardTitle className="text-heading-sm">{venue.name}</CardTitle>
                    <p className="text-copy-sm text-muted-foreground">
                      {venue.city}, {venue.state}
                    </p>
                  </div>
                  <Badge variant="secondary">{deliveryLabel(venue.deliveryMode)}</Badge>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <p className="text-copy-sm text-muted-foreground line-clamp-2">{venue.address}</p>
                  <Button type="button" size="sm" onClick={() => navigate(`/app/venues/${venue.slug}`)}>
                    Menu
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
