import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import Header from '@stevederico/skateboard-ui/Header';
import { apiRequest } from '@stevederico/skateboard-ui/Utilities';
import { Button } from '@stevederico/skateboard-ui/shadcn/ui/button';
import { Input } from '@stevederico/skateboard-ui/shadcn/ui/input';
import { Label } from '@stevederico/skateboard-ui/shadcn/ui/label';
import { Field } from '@stevederico/skateboard-ui/shadcn/ui/field';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@stevederico/skateboard-ui/shadcn/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@stevederico/skateboard-ui/shadcn/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@stevederico/skateboard-ui/shadcn/ui/select';
import { Badge } from '@stevederico/skateboard-ui/shadcn/ui/badge';
import { Skeleton } from '@stevederico/skateboard-ui/shadcn/ui/skeleton';

/** Section from GET /api/venues/:slug/sections. */
interface VenueSection {
  id: string;
  code: string;
  level: string;
  zone: string;
  rowMin: string | null;
  rowMax: string | null;
  deliveryEligible: boolean;
  notes: string | null;
}

/** Created order from POST /api/orders. */
interface FoodOrder {
  id: string;
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
 * Place an order for a venue menu item with seat location.
 *
 * @component
 * @returns Order form view
 */
export default function OrderView() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const menuItemId = searchParams.get('item') ?? '';
  const foodName = searchParams.get('name') ?? '';
  const unitPrice = Number(searchParams.get('price') ?? '0');

  const [sections, setSections] = useState<VenueSection[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [sectionCode, setSectionCode] = useState('');
  const [row, setRow] = useState('');
  const [seat, setSeat] = useState('');
  const [qty, setQty] = useState(1);
  const [paymentType, setPaymentType] = useState<'Cash' | 'Card'>('Cash');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const total = useMemo(() => Math.round(unitPrice * qty * 100) / 100, [unitPrice, qty]);
  const selectedSection = sections.find((s) => s.code === sectionCode) ?? null;

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const data = (await apiRequest(`/venues/${slug}/sections`)) as VenueSection[];
        if (!cancelled) setSections(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setSections([]);
      } finally {
        if (!cancelled) setSectionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug || !menuItemId || !foodName || !Number.isFinite(unitPrice) || unitPrice <= 0) {
    return (
      <>
        <Header title="Order" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <p className="text-copy-md text-muted-foreground">Pick an item from a venue menu first.</p>
          <Button type="button" onClick={() => navigate('/app/home')}>
            Venues
          </Button>
        </div>
      </>
    );
  }

  /**
   * Validate form fields before submit.
   *
   * @returns Field error map
   */
  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!sectionCode) next.section = 'Section is required';
    if (!row.trim()) next.row = 'Row is required';
    if (!seat.trim()) next.seat = 'Seat is required';
    if (qty < 1 || qty > 20) next.qty = 'Quantity must be 1–20';
    return next;
  }

  /**
   * Submit order to the API.
   *
   * @param e - Form submit event
   */
  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    const next = validate();
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const order = (await apiRequest('/orders', {
        method: 'POST',
        body: JSON.stringify({
          venueSlug: slug,
          menuItemId,
          qty,
          section: sectionCode,
          row: row.trim(),
          seat: seat.trim(),
          paymentType,
        }),
      })) as FoodOrder;
      navigate(`/app/orders/${order.id}`);
    } catch (err) {
      console.error(err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Header title={foodName} />
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <Card className="mx-auto w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-heading-md">Deliver to your seat</CardTitle>
            <p className="text-copy-md text-muted-foreground capitalize">{slug?.replace(/-/g, ' ')}</p>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="flex flex-col gap-4">
              <Field>
                <Label htmlFor="section">Section</Label>
                {sectionsLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <Select
                    value={sectionCode}
                    onValueChange={(v) => {
                      setSectionCode(v);
                      setErrors((prev) => ({ ...prev, section: '' }));
                    }}
                  >
                    <SelectTrigger id="section" className="w-full">
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map((s) => (
                        <SelectItem key={s.id} value={s.code}>
                          {s.code} · {s.level} · {s.zone.replace(/_/g, ' ')}
                          {s.deliveryEligible ? ' · delivery' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {errors.section ? (
                  <p className="text-copy-sm text-destructive">{errors.section}</p>
                ) : null}
                {selectedSection ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{selectedSection.level}</Badge>
                      <Badge variant="secondary">{selectedSection.zone.replace(/_/g, ' ')}</Badge>
                      {selectedSection.deliveryEligible ? (
                        <Badge>In-seat delivery</Badge>
                      ) : (
                        <Badge variant="outline">Pickup / walk-up</Badge>
                      )}
                    </div>
                    {selectedSection.rowMin && selectedSection.rowMax ? (
                      <p className="text-copy-sm text-muted-foreground">
                        Typical rows {selectedSection.rowMin}–{selectedSection.rowMax}. Seat 1 faces the
                        lower-numbered section.
                      </p>
                    ) : null}
                    {selectedSection.notes ? (
                      <p className="text-copy-sm text-muted-foreground">{selectedSection.notes}</p>
                    ) : null}
                  </div>
                ) : null}
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <Label htmlFor="row">Row</Label>
                  <Input
                    id="row"
                    value={row}
                    placeholder={selectedSection?.rowMin ?? 'e.g. A or 12'}
                    onChange={(e) => {
                      setRow(e.target.value);
                      setErrors((prev) => ({ ...prev, row: '' }));
                    }}
                    autoComplete="off"
                    required
                  />
                  {errors.row ? <p className="text-copy-sm text-destructive">{errors.row}</p> : null}
                </Field>
                <Field>
                  <Label htmlFor="seat">Seat</Label>
                  <Input
                    id="seat"
                    value={seat}
                    placeholder="e.g. 8"
                    onChange={(e) => {
                      setSeat(e.target.value);
                      setErrors((prev) => ({ ...prev, seat: '' }));
                    }}
                    autoComplete="off"
                    required
                  />
                  {errors.seat ? <p className="text-copy-sm text-destructive">{errors.seat}</p> : null}
                </Field>
              </div>

              <Field>
                <Label htmlFor="qty">Quantity</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Decrease quantity"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                  >
                    −
                  </Button>
                  <Input
                    id="qty"
                    type="number"
                    min={1}
                    max={20}
                    className="w-20 text-center"
                    value={qty}
                    onChange={(e) => setQty(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Increase quantity"
                    onClick={() => setQty((q) => Math.min(20, q + 1))}
                  >
                    +
                  </Button>
                </div>
              </Field>

              <Field>
                <Label id="payment-label">Payment</Label>
                <ToggleGroup
                  value={[paymentType]}
                  onValueChange={(values) => {
                    const next = values[0];
                    if (next === 'Cash' || next === 'Card') setPaymentType(next);
                  }}
                  aria-labelledby="payment-label"
                  className="justify-start"
                >
                  <ToggleGroupItem value="Cash" aria-label="Pay with cash">
                    Cash
                  </ToggleGroupItem>
                  <ToggleGroupItem value="Card" aria-label="Pay with card">
                    Card
                  </ToggleGroupItem>
                </ToggleGroup>
              </Field>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-label-lg">Total: {formatPrice(total)}</p>
              <div className="flex flex-col items-stretch gap-2 sm:items-end">
                {submitError ? (
                  <p className="text-copy-sm text-destructive" role="alert">
                    {submitError}
                  </p>
                ) : null}
                <Button type="submit" disabled={submitting || sectionsLoading}>
                  {submitting ? 'Placing…' : 'Place Order'}
                </Button>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </>
  );
}
