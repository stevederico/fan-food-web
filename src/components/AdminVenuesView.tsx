import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import Header from '@stevederico/skateboard-ui/Header';
import { apiRequest } from '@stevederico/skateboard-ui/Utilities';
import { Button } from '@stevederico/skateboard-ui/shadcn/ui/button';
import { Input } from '@stevederico/skateboard-ui/shadcn/ui/input';
import { Label } from '@stevederico/skateboard-ui/shadcn/ui/label';
import { Field } from '@stevederico/skateboard-ui/shadcn/ui/field';
import { Card, CardContent, CardHeader, CardTitle } from '@stevederico/skateboard-ui/shadcn/ui/card';
import { Badge } from '@stevederico/skateboard-ui/shadcn/ui/badge';
import { Skeleton } from '@stevederico/skateboard-ui/shadcn/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@stevederico/skateboard-ui/shadcn/ui/select';
import { useIsAdmin } from '../lib/admin';

/** Venue from admin API. */
interface Venue {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  address: string;
  deliveryMode: string;
  active: boolean;
  capacity: number | null;
}

/**
 * Admin portal: list venues and create new ones.
 *
 * @component
 * @returns Admin venues view
 */
export default function AdminVenuesView() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryMode, setDeliveryMode] = useState('premium');
  const [capacity, setCapacity] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await apiRequest('/admin/venues')) as Venue[];
      setVenues(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load venues');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
    else setLoading(false);
  }, [isAdmin, load]);

  if (!isAdmin) {
    return (
      <>
        <Header title="Admin" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <p className="text-copy-md text-muted-foreground">
            Admin access required. Set your email in <code className="text-label-sm">ADMIN_EMAILS</code>{' '}
            (or leave empty in local dev).
          </p>
          <Button type="button" onClick={() => navigate('/app/home')}>
            Fan view
          </Button>
        </div>
      </>
    );
  }

  /**
   * Create a venue from the form.
   *
   * @param e - Submit event
   */
  async function handleCreate(e: FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const created = (await apiRequest('/admin/venues', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          city: city.trim(),
          state: state.trim(),
          address: address.trim(),
          deliveryMode,
          capacity: capacity.trim() ? Number(capacity) : null,
        }),
      })) as Venue;
      setName('');
      setCity('');
      setState('');
      setAddress('');
      setCapacity('');
      setDeliveryMode('premium');
      navigate(`/app/admin/venues/${created.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create venue');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Header title="Admin · Venues" buttonTitle="Fan view" onButtonTitleClick={() => navigate('/app/home')} />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-heading-md">Add venue</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <Label htmlFor="v-name">Name</Label>
                  <Input
                    id="v-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Oracle Park"
                    required
                  />
                </Field>
                <Field>
                  <Label htmlFor="v-city">City</Label>
                  <Input
                    id="v-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="San Francisco"
                    required
                  />
                </Field>
                <Field>
                  <Label htmlFor="v-state">State</Label>
                  <Input
                    id="v-state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="CA"
                    required
                  />
                </Field>
                <Field>
                  <Label htmlFor="v-capacity">Capacity (optional)</Label>
                  <Input
                    id="v-capacity"
                    type="number"
                    min={0}
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="41000"
                  />
                </Field>
              </div>
              <Field>
                <Label htmlFor="v-address">Address</Label>
                <Input
                  id="v-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="24 Willie Mays Plaza"
                  required
                />
              </Field>
              <Field>
                <Label htmlFor="v-delivery">Delivery mode</Label>
                <Select value={deliveryMode} onValueChange={setDeliveryMode}>
                  <SelectTrigger id="v-delivery" className="w-full max-w-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="premium">Premium sections only</SelectItem>
                    <SelectItem value="all">All seats</SelectItem>
                    <SelectItem value="pickup_only">Pickup only</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {formError ? (
                <p className="text-copy-sm text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}
              <Button type="submit" disabled={submitting} className="w-fit">
                {submitting ? 'Creating…' : 'Create venue'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          <h2 className="text-heading-sm">All venues</h2>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : error ? (
            <div className="flex flex-col gap-2">
              <p className="text-copy-md text-destructive">{error}</p>
              <Button type="button" variant="outline" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          ) : venues.length === 0 ? (
            <p className="text-copy-md text-muted-foreground">No venues yet — create one above.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {venues.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => navigate(`/app/admin/venues/${v.id}`)}
                  >
                    <Card className="transition-colors hover:bg-accent/40">
                      <CardContent className="flex items-center justify-between gap-3 py-4">
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="text-label-lg">{v.name}</span>
                          <span className="text-copy-sm text-muted-foreground">
                            {v.city}, {v.state} · /{v.slug}
                          </span>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Badge variant={v.active ? 'default' : 'secondary'}>
                            {v.active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant="outline">{v.deliveryMode.replace(/_/g, ' ')}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
