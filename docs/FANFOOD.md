# FanFood product guide

Stadium concession ordering for many venues. This doc is app-specific; Skateboard shell/auth/deploy details live in [GUIDE.md](GUIDE.md).

## Roles

### Fan

1. Open **Order Food** (`/app/home`)
2. Choose a venue
3. Pick a menu item
4. Enter **section** (from venue seating list), **row**, **seat**
5. Choose Cash or Card and place order
6. See confirmation; track under **My Orders**

Status is `Ordered` when the section is delivery-eligible, otherwise `Pickup`.

### Admin

Requires `isAdmin` on the user (`ADMIN_EMAILS` in `backend/.env`).

- **Empty `ADMIN_EMAILS` in non-production** → all signed-in users are admins (local DX)
- **Production** with empty list → no admins
- Comma-separated emails, or `*` for everyone

Portal: **Admin** (`/app/admin`)

- Create venue (name, city, state, address, delivery mode, optional capacity)
- Open venue: edit metadata, active/inactive
- Add menu items; deactivate items
- Add sections (code, level, zone, delivery flag)

## Data model (SQLite)

Tables created by `backend/lib/fanfood.ts` → `ensureFanFoodSchema`:

### Venues

| Column | Notes |
|--------|--------|
| id | UUID |
| slug | unique URL key |
| name, short_name | display |
| city, state, address | location |
| capacity | optional |
| timezone | default `America/Los_Angeles` |
| delivery_mode | `premium` \| `all` \| `pickup_only` |
| active | 0/1 — inactive hidden from fan list |
| created_at | ms epoch |

### VenueSections

| Column | Notes |
|--------|--------|
| venue_id + code | unique per venue |
| level | field, club, view, suite, other |
| zone | field_club, bleachers, arcade, … |
| row_min / row_max | hints for UX |
| delivery_eligible | 1 = in-seat when venue mode is `premium` |
| notes | free text |
| sort_order | listing order |

### MenuItems

| Column | Notes |
|--------|--------|
| venue_id | FK |
| name, price | price authoritative on server |
| category, description | optional display |
| active | fan menu only shows active |
| sort_order | listing order |

### Orders

| Column | Notes |
|--------|--------|
| user_id | owner |
| venue_id, venue_name | denormalized name for history |
| menu_item_id, food_type | item snapshot name |
| qty, total_price | total from server price × qty |
| section, row, seat | seat location |
| level, zone, delivery_eligible | from section at order time |
| payment_type | Cash \| Card |
| status | Ordered \| Pickup (extensible) |
| confirm_number | e.g. `FF-A1B2C3` |
| created_at | ms epoch |

## Seed: Oracle Park

On first empty `Venues` table:

- Slug `oracle-park`
- Delivery mode `premium`
- Sections 101–152 field, 202–234 club, 302–336 view
- Field Club **107–124** marked delivery-eligible
- Menu includes garlic fries, crab sandwich, poke, birria grilled cheese, etc.

Delete `backend/databases/FanFood.db*` to re-seed (wipes all app data).

## Delivery rules

```
venue.deliveryMode === 'all'          → always in-seat
venue.deliveryMode === 'pickup_only'  → never in-seat
venue.deliveryMode === 'premium'      → section.deliveryEligible
```

Matches real-world Oracle Park style: Uber Eats in-seat for premium clubs; everyone else walk-up/pickup.

## Key files

| Path | Role |
|------|------|
| `backend/lib/fanfood.ts` | Schema, seed, mappers, admin helpers |
| `backend/server.ts` | Fan + admin HTTP routes |
| `src/components/VenuesView.tsx` | Fan venue list |
| `src/components/MenuView.tsx` | Fan menu |
| `src/components/OrderView.tsx` | Fan checkout |
| `src/components/MyOrdersView.tsx` | Fan history |
| `src/components/OrderDetailView.tsx` | Fan receipt |
| `src/components/AdminVenuesView.tsx` | Admin list + create |
| `src/components/AdminVenueDetailView.tsx` | Admin edit venue |
| `src/lib/admin.ts` | `useIsAdmin()` |
| `src/main.tsx` | Routes |
| `src/constants.json` | Nav + branding |

## Adding another venue (admin UI)

1. Admin → **Add venue**
2. Open venue → add menu items
3. Add sections (or bulk-seed via SQL later)
4. Set **Active** so fans see it

## Related

- Original iOS app: https://github.com/stevederico/fan-food  
- Repo: https://github.com/stevederico/fan-food-web  
