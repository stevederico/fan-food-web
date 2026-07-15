<div align="center">
  <p align="center" style="margin-top: 40px; margin-bottom: 5px;">
    <img src="public/icons/icon.png" width="60" height="60" alt="FanFood Logo">
  </p>
  <h1 align="center" style="border-bottom: none; margin-bottom: 0;">FanFood</h1>
  <h3 align="center" style="margin-top: 0; font-weight: normal;">
    multi-venue stadium concession ordering — react, hono, sqlite, skateboard
  </h3>
</div>

<br />

<div align="center">
  <img src="public/screenshots/order.png" width="75%" alt="FanFood — place an order to your seat at Oracle Park">
</div>

<br />

## Quick Start

```bash
git clone https://github.com/stevederico/fan-food-web.git
cd fan-food-web
bun install          # or: npm run install-all
bun run front        # http://localhost:5173
# other terminal:
cd backend && bun run dev   # http://localhost:8000
```

Sign up, then:

- **Fan:** Order Food → pick a venue → menu → section/row/seat → place order  
- **Admin:** Manage → create/edit venues, menu items, sections  

> `npm run start` can fail under Bun’s workspace launcher; run `front` and `backend` `dev` separately as above.

<br />

## What It Is

In-seat (and pickup) concession ordering for sports venues. Inspired by the original [fan-food iOS app](https://github.com/stevederico/fan-food) (Oracle Park / formerly AT&T Park). Supports **many venues** in one database.

| Role | Routes | What you do |
|------|--------|-------------|
| **Fan** | `/app/home`, `/app/venues/:slug`, `/app/orders` | Browse venues, order to seat, track orders |
| **Admin** | `/app/manage`, `/app/manage/venues/:id` | Add venues, menu items, sections, delivery rules |

Oracle Park ships seeded (sections 101–336 zones, real-ish menu, premium in-seat delivery on Field Club 107–124).

<br />

## Features

### Ordering
- **Multi-venue** menus and seating from SQLite  
- **Section picker** with level/zone and delivery eligibility  
- **Server-side prices** — never trust client amounts  
- **Cash / Card** payment type (card details not stored in demo)  
- **Order history** with confirmation numbers  

### Admin portal
- Create and edit venues (active/inactive, delivery mode)  
- Add/deactivate menu items  
- Add sections (code, level, zone, in-seat flag)  

### Platform (Skateboard)
- **JWT auth** (HttpOnly cookies, scrypt passwords)  
- **CSRF** protection on mutating routes  
- **Stripe** subscription plumbing (optional)  
- **skateboard-ui** shell, dark mode, responsive layout  

<br />

## Configuration

### Frontend — `src/constants.json`

```json
{
  "appName": "FanFood",
  "tagline": "Order stadium food to your seat",
  "pages": [
    { "title": "Order Food", "url": "home", "icon": "utensils" },
    { "title": "My Orders", "url": "orders", "icon": "receipt" },
    { "title": "Manage", "url": "manage", "icon": "settings" }
  ]
}
```

### Backend — `backend/config.json`

```json
{
  "staticDir": "../dist",
  "database": {
    "db": "FanFood",
    "dbType": "sqlite",
    "connectionString": "./databases/FanFood.db"
  }
}
```

### Environment — `backend/.env`

```bash
JWT_SECRET=long-random-string
# FanFood admins (comma-separated). Empty in non-production = every signed-in user is admin.
# ADMIN_EMAILS=you@example.com
STRIPE_KEY=              # optional
STRIPE_ENDPOINT_SECRET=  # optional
FREE_USAGE_LIMIT=20
ENV=development
PORT=8000
```

Copy from `backend/.env.example` if needed.

<br />

## API (FanFood)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/venues` | — | Active venues (fan) |
| GET | `/api/venues/:slug` | — | Venue detail |
| GET | `/api/venues/:slug/menu` | — | Menu items |
| GET | `/api/venues/:slug/sections` | — | Seating sections |
| GET | `/api/orders` | user | Your orders |
| GET | `/api/orders/:id` | user | Order detail |
| POST | `/api/orders` | user + CSRF | Place order |
| GET | `/api/admin/venues` | admin | All venues |
| POST | `/api/admin/venues` | admin + CSRF | Create venue |
| PUT | `/api/admin/venues/:id` | admin + CSRF | Update venue |
| GET | `/api/admin/venues/:id/menu` | admin | Menu incl. inactive |
| POST | `/api/admin/venues/:id/menu` | admin + CSRF | Add menu item |
| PUT | `/api/admin/menu/:id` | admin + CSRF | Update menu item |
| POST | `/api/admin/venues/:id/sections` | admin + CSRF | Add section |
| PUT | `/api/admin/sections/:id` | admin + CSRF | Update section |

Plus Skateboard auth/billing: `/api/signup`, `/api/signin`, `/api/me`, `/api/checkout`, etc. Full boilerplate reference: [docs/GUIDE.md](docs/GUIDE.md). Product detail: [docs/FANFOOD.md](docs/FANFOOD.md).

<br />

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19 | UI |
| **skateboard-ui** | 4.14 | Shell, components, theming |
| **Vite** | 8 | Frontend build / dev |
| **Tailwind CSS** | 4 | Styling |
| **React Router** | 7 | Routing |
| **Hono** | 4 | API server |
| **SQLite** | node:sqlite | Venues, menus, sections, orders |
| **TypeScript** | strict | Frontend + backend |
| **Node.js** | 24+ | Runtime |
| **Stripe** | 18 | Optional subscriptions |

<br />

## Architecture

**Skateboard Application Shell** + FanFood domain in SQLite.

1. **Shell** (`@stevederico/skateboard-ui`) — auth, layout, routing, `apiRequest`  
2. **Fan views** — `VenuesView`, `MenuView`, `OrderView`, `MyOrdersView`, `OrderDetailView`  
3. **Admin views** — `AdminVenuesView`, `AdminVenueDetailView`  
4. **Domain** — `backend/lib/fanfood.ts` (schema, seed, mappers) + routes in `backend/server.ts`  

```
Fan:   Venues → Menu → Order (section) → Confirm → My Orders
Admin: Venues list → Create / Edit → Menu + Sections
```

Delivery modes per venue: `premium` (section-flagged only), `all`, `pickup_only`.

<br />

## Development

```bash
bun run typecheck
bun run test:frontend
cd backend && node --experimental-test-module-mocks --test-concurrency=1 --test server.test.ts
```

**Agent guidance:** [AGENTS.md](AGENTS.md) (symlinked as `CLAUDE.md`).

<br />

## Deployment

See [docs/GUIDE.md#deployment](docs/GUIDE.md#deployment). Production needs `JWT_SECRET`, `ADMIN_EMAILS`, and your host’s static + Node process (or Docker via root `Dockerfile`).

<br />

## Related

- [fan-food](https://github.com/stevederico/fan-food) — original iOS Objective-C app  
- [skateboard](https://github.com/stevederico/skateboard) — boilerplate  
- [skateboard-ui](https://github.com/stevederico/skateboard-ui) — UI package  
- [create-skateboard-app](https://github.com/stevederico/create-skateboard-app) — scaffolder  

<br />

## License

MIT — see [LICENSE](LICENSE).

<br />

---

<div align="center">
  <p>
    Made with <a href="https://github.com/stevederico/skateboard">Skateboard</a> — a React boilerplate with auth and payments
  </p>
  <p>
    Built by <a href="https://github.com/stevederico">Steve Derico</a>
  </p>
</div>
