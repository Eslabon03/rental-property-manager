# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Property rental management PWA optimized for mobile.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (local), Supabase (remote)
- **Supabase client**: @supabase/supabase-js
- **Frontend**: React + Vite + Tailwind CSS
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (properties, reservations, expenses)
│   └── rental-app/         # React + Vite frontend (PWA mobile-first)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

### Supabase Tables (remote - `propiedades`)
- **propiedades**: id, nombre, tipo (vacacional/mensual), pais, renta_fija_lps, instrucciones, esta_alquilada, ical_url, contrato_url, creado_en
- **reservas**: id, propiedad_id, fecha_inicio, fecha_fin, nombre_huesped, celular_huesped, canal_renta, monto (numeric), creado_en, creado_por, modificado_por, modificado_en, origen (manual/ical)

### Local PostgreSQL Tables
- **properties**: id, name, address, type, bedrooms, bathrooms, monthly_rent, status (available/occupied/maintenance), image_url, created_at
- **reservations**: id, property_id (FK), guest_name, check_in, check_out, total_amount, status (confirmed/pending/cancelled/completed), notes, created_at
- **expenses**: id, property_id (FK), category, description, amount, date, created_at

## Role-Based Access Control
- Roles determined by email: if email contains "limpieza" → role "limpieza", otherwise → "admin"
- Context: `artifacts/rental-app/src/lib/roles.tsx` (RoleProvider, useRole, getRoleFromEmail)
- Admin: full access to all 5 tabs (Inicio, Reservas, Gastos, Reportes, Ajustes)
- Limpieza: only Gastos and Ajustes; all other routes redirect to /gastos
- Limpieza users can only see/work with properties matching "Roatán" or "Las Palmas" (filtered via `filterPropiedadesPorRol`)
- Navigation items filtered in Layout.tsx based on role
- Routes protected in App.tsx with separate AdminRouter/LimpiezaRouter

## Supabase Integration
- Config file: `artifacts/rental-app/src/lib/supabase.ts`
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- The Inicio (Home) page reads properties directly from the Supabase `propiedades` table
- The Reservas page reads/writes from the Supabase `reservas` table (columns: id, propiedad_id, fecha_inicio, fecha_fin, nombre_huesped, celular_huesped, canal_renta, creado_en, creado_por, modificado_por, modificado_en)
- Reservations track which user created them (creado_por) and which user last modified them (modificado_por + modificado_en)
- Calendar uses react-calendar to show occupied dates visually and block date selection
- Dependencies: @supabase/supabase-js, react-calendar

## API Endpoints

- `GET /api/healthz` - Health check
- `GET /api/properties` - List properties
- `POST /api/properties` - Create property
- `GET /api/properties/:id` - Get property by ID
- `GET /api/reservations` - List reservations (optional ?propertyId filter)
- `POST /api/reservations` - Create reservation
- `GET /api/expenses` - List expenses (optional ?propertyId filter)
- `POST /api/expenses` - Create expense
- `POST /api/sync-ical` - Sync all properties with iCal URLs (fetches iCal feeds, parses events, upserts reservas)
- `POST /api/sync-ical/:propiedadId` - Sync a single property's iCal feed

## Frontend Pages

- **Inicio** (`/`) - Dashboard with "Reservas Próximas" and "Inventario de Propiedades" button. Inventory shows vacacionales/mensuales with expandable cards for editing instrucciones and iCal URL per property, plus per-property sync button. WhatsApp button on each reservation card. Origin badge (Sync) for iCal-synced reservations.
- **Reservas** (`/reservas`) - Calendar view with occupied dates highlighted, property selector (vacacionales), reservation list with WhatsApp buttons and origin badges, global "Sync iCal" button, and form to create/edit reservations with overlap validation
- **Gastos** (`/gastos`) - Expense list from Supabase `gastos` table with category icons, property filter, monthly total summary, and form to register new expenses (categories: Luz, Agua, Roa, Limpieza, Mantenimiento, Otro)
- **Ajustes** (`/ajustes`) - Settings page with profile, preferences

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)
Express 5 API server with routes for health, properties, reservations, and expenses.

### `artifacts/rental-app` (`@workspace/rental-app`)
React + Vite mobile-first PWA with Tailwind CSS. Dark navy header, bottom tab navigation (Inicio, Reservas, Gastos, Ajustes).

### `lib/db` (`@workspace/db`)
Database layer using Drizzle ORM with PostgreSQL. Schema: properties, reservations, expenses tables.

### `lib/api-spec` (`@workspace/api-spec`)
OpenAPI 3.1 spec and Orval config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)
Generated Zod schemas from OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)
Generated React Query hooks from OpenAPI spec.
