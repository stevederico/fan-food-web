import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
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

/** Venue record. */
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

/** Menu item. */
interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string | null;
  active: boolean;
}

/** Section. */
interface VenueSection {
  id: string;
  code: string;
  level: string;
  zone: string;
  deliveryEligible: boolean;
  rowMin: string | null;
  rowMax: string | null;
}

/**
 * Admin: edit one venue, add menu items and sections.
 *
 * @component
 * @returns Admin venue detail view
 */
export default function AdminVenueDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();

  const [venue, setVenue] = useState<Venue | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [sections, setSections] = useState<VenueSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryMode, setDeliveryMode] = useState('premium');
  const [active, setActive] = useState(true);

  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategory, setItemCategory] = useState('Classics');

  const [secCode, setSecCode] = useState('');
  const [secLevel, setSecLevel] = useState('field');
  const [secZone, setSecZone] = useState('field_box');
  const [secDelivery, setSecDelivery] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const venues = (await apiRequest('/admin/venues')) as Venue[];
      const v = (Array.isArray(venues) ? venues : []).find((x) => x.id === id) ?? null;
      if (!v) {
        setError('Venue not found');
        setVenue(null);
        return;
      }
      setVenue(v);
      setName(v.name);
      setCity(v.city);
      setState(v.state);
      setAddress(v.address);
      setDeliveryMode(v.deliveryMode);
      setActive(v.active);

      const menuData = (await apiRequest(`/admin/venues/${id}/menu`)) as MenuItem[];
      setMenu(Array.isArray(menuData) ? menuData : []);

      const secData = (await apiRequest(`/venues/${v.slug}/sections`)) as VenueSection[];
      setSections(Array.isArray(secData) ? secData : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isAdmin) void load();
    else setLoading(false);
  }, [isAdmin, load]);

  if (!isAdmin) {
    return (
      <>
        <Header title="Admin" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <p className="text-copy-md text-muted-foreground">Admin access required.</p>
          <Button type="button" onClick={() => navigate('/app/home')}>
            Fan view
          </Button>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Header title="Admin" />
        <div className="flex flex-1 flex-col gap-3 p-4 md:p-6" aria-busy="true">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </>
    );
  }

  if (error || !venue) {
    return (
      <>
        <Header title="Admin" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <p className="text-copy-md text-destructive">{error ?? 'Not found'}</p>
          <Button type="button" onClick={() => navigate('/app/admin')}>
            Back
          </Button>
        </div>
      </>
    );
  }

  /**
   * Persist venue fields.
   *
   * @param e - Submit event
   */
  async function handleSaveVenue(e: FormEvent): Promise<void> {
    e.preventDefault();
    setSaveMsg(null);
    try {
      const updated = (await apiRequest(`/admin/venues/${venue!.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          city: city.trim(),
          state: state.trim(),
          address: address.trim(),
          deliveryMode,
          active,
        }),
      })) as Venue;
      setVenue(updated);
      setSaveMsg('Venue saved');
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Save failed');
    }
  }

  /**
   * Add menu item.
   *
   * @param e - Submit event
   */
  async function handleAddMenu(e: FormEvent): Promise<void> {
    e.preventDefault();
    try {
      await apiRequest(`/admin/venues/${venue!.id}/menu`, {
        method: 'POST',
        body: JSON.stringify({
          name: itemName.trim(),
          price: Number(itemPrice),
          category: itemCategory.trim() || 'Other',
        }),
      });
      setItemName('');
      setItemPrice('');
      await load();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Add menu failed');
    }
  }

  /**
   * Soft-deactivate a menu item.
   *
   * @param itemId - Menu item id
   */
  async function handleDeactivateMenu(itemId: string): Promise<void> {
    try {
      await apiRequest(`/admin/menu/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify({ active: false }),
      });
      await load();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Update failed');
    }
  }

  /**
   * Add a section.
   *
   * @param e - Submit event
   */
  async function handleAddSection(e: FormEvent): Promise<void> {
    e.preventDefault();
    try {
      await apiRequest(`/admin/venues/${venue!.id}/sections`, {
        method: 'POST',
        body: JSON.stringify({
          code: secCode.trim(),
          level: secLevel,
          zone: secZone,
          deliveryEligible: secDelivery,
        }),
      });
      setSecCode('');
      setSecDelivery(false);
      await load();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Add section failed');
    }
  }

  return (
    <>
      <Header
        title={venue.name}
        buttonTitle="All venues"
        onButtonTitleClick={() => navigate('/app/admin')}
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {saveMsg ? <p className="text-copy-sm text-muted-foreground">{saveMsg}</p> : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-heading-md">Venue details</CardTitle>
            <p className="text-copy-sm text-muted-foreground">/{venue.slug}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveVenue} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </Field>
                <Field>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} required />
                </Field>
                <Field>
                  <Label htmlFor="state">State</Label>
                  <Input id="state" value={state} onChange={(e) => setState(e.target.value)} required />
                </Field>
                <Field>
                  <Label htmlFor="delivery">Delivery mode</Label>
                  <Select value={deliveryMode} onValueChange={setDeliveryMode}>
                    <SelectTrigger id="delivery" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="premium">Premium sections only</SelectItem>
                      <SelectItem value="all">All seats</SelectItem>
                      <SelectItem value="pickup_only">Pickup only</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required />
              </Field>
              <Field>
                <Label htmlFor="active">Status</Label>
                <Select
                  value={active ? 'active' : 'inactive'}
                  onValueChange={(v) => setActive(v === 'active')}
                >
                  <SelectTrigger id="active" className="w-full max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active (fans can order)</SelectItem>
                    <SelectItem value="inactive">Inactive (hidden from fans)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">Save venue</Button>
                <Button type="button" variant="outline" onClick={() => navigate(`/app/venues/${venue.slug}`)}>
                  Open fan menu
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-heading-md">Menu ({menu.filter((m) => m.active).length} active)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form onSubmit={handleAddMenu} className="grid gap-3 sm:grid-cols-4 sm:items-end">
              <Field>
                <Label htmlFor="item-name">Item</Label>
                <Input
                  id="item-name"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <Label htmlFor="item-price">Price</Label>
                <Input
                  id="item-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <Label htmlFor="item-cat">Category</Label>
                <Input
                  id="item-cat"
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value)}
                />
              </Field>
              <Button type="submit">Add item</Button>
            </form>
            <ul className="flex flex-col gap-2">
              {menu.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="text-label-md">
                      {item.name}{' '}
                      <span className="text-muted-foreground">
                        ${item.price.toFixed(2)} · {item.category}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={item.active ? 'default' : 'secondary'}>
                      {item.active ? 'Active' : 'Off'}
                    </Badge>
                    {item.active ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void handleDeactivateMenu(item.id)}
                      >
                        Deactivate
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-heading-md">Sections ({sections.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form onSubmit={handleAddSection} className="grid gap-3 sm:grid-cols-5 sm:items-end">
              <Field>
                <Label htmlFor="sec-code">Code</Label>
                <Input
                  id="sec-code"
                  value={secCode}
                  onChange={(e) => setSecCode(e.target.value)}
                  placeholder="122"
                  required
                />
              </Field>
              <Field>
                <Label htmlFor="sec-level">Level</Label>
                <Select value={secLevel} onValueChange={setSecLevel}>
                  <SelectTrigger id="sec-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="field">field</SelectItem>
                    <SelectItem value="club">club</SelectItem>
                    <SelectItem value="view">view</SelectItem>
                    <SelectItem value="suite">suite</SelectItem>
                    <SelectItem value="other">other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <Label htmlFor="sec-zone">Zone</Label>
                <Select value={secZone} onValueChange={setSecZone}>
                  <SelectTrigger id="sec-zone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="field_box">field_box</SelectItem>
                    <SelectItem value="field_club">field_club</SelectItem>
                    <SelectItem value="bleachers">bleachers</SelectItem>
                    <SelectItem value="arcade">arcade</SelectItem>
                    <SelectItem value="club">club</SelectItem>
                    <SelectItem value="view_box">view_box</SelectItem>
                    <SelectItem value="view_reserve">view_reserve</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <Label htmlFor="sec-del">Delivery</Label>
                <Select
                  value={secDelivery ? 'yes' : 'no'}
                  onValueChange={(v) => setSecDelivery(v === 'yes')}
                >
                  <SelectTrigger id="sec-del">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">In-seat yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Button type="submit">Add section</Button>
            </form>
            <ul className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {sections.map((s) => (
                <li key={s.id} className="text-copy-sm text-muted-foreground">
                  <span className="text-foreground font-medium">{s.code}</span> · {s.level} ·{' '}
                  {s.zone}
                  {s.deliveryEligible ? ' · 🚚' : ''}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
