# Upgrading Skateboard boilerplate in FanFood

This app (`fan-food-web`) is a **Skateboard** scaffold with custom FanFood domain code.

## Safe to pull from upstream

Use `node scripts/update-skateboard.js` for boilerplate files on the updater allowlist.

## Do not overwrite without merging

App-owned FanFood logic lives outside pure boilerplate:

| Path | Notes |
|------|--------|
| `backend/src/db.rs` | FanFood `FANFOOD_SCHEMA` lives with the Users schema — merge, do not replace |
| `backend/src/fanfood.rs` | Seed, mappers, order rules — **app-owned** |
| `backend/src/routes.rs` | FanFood paths are registered before the `/api/` fallback |
| `src/components/*` | Fan + admin views — **app-owned** |
| `src/lib/isAdmin.ts` | Admin helper — **app-owned** |
| `src/constants.json` | App branding/nav — never take canonical wholesale |
| `src/main.tsx` | Custom routes — preserve |

After any boilerplate update:

1. Confirm FanFood routes still register (`/api/venues`, `/api/orders`, `/api/admin` in `backend/src/routes.rs`)
2. `npm run typecheck` and `cd backend && cargo test --locked`
3. Smoke: fan order + admin create venue

See also the generic upgrade flow in the Skateboard template’s UPGRADE notes, and [FANFOOD.md](FANFOOD.md).
