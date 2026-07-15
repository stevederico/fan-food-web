# Upgrading Skateboard boilerplate in FanFood

This app (`fan-food-web`) is a **Skateboard** scaffold with custom FanFood domain code.

## Safe to pull from upstream

Use `node scripts/update-skateboard.js` for boilerplate files on the updater allowlist.

## Do not overwrite without merging

App-owned FanFood logic lives outside pure boilerplate:

| Path | Notes |
|------|--------|
| `backend/lib/fanfood.ts` | Venues, sections, menu, seed — **app-owned** |
| `backend/server.ts` | Contains FanFood + admin routes — **3-way merge carefully** |
| `src/components/*` | Fan + admin views — **app-owned** |
| `src/lib/admin.ts` | Admin helper — **app-owned** |
| `src/constants.json` | App branding/nav — never take canonical wholesale |
| `src/main.tsx` | Custom routes — preserve |

After any boilerplate update:

1. Confirm FanFood routes still register (grep `/api/venues`, `/api/admin`)
2. `bun run typecheck`
3. Smoke: fan order + admin create venue

See also the generic upgrade flow in the Skateboard template’s UPGRADE notes, and [FANFOOD.md](FANFOOD.md).
