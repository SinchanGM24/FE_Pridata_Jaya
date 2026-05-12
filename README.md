# FE2 - SMD Pridata Frontend

Modern Next.js 15 frontend for SMD Pridata Enterprise Management System, supporting all 5 roles (Owner, Admin, Invoicist, Warehouse Staff, Accountant).

## Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn
- BE2 backend running on `http://localhost:5001`

### Installation

1. **Clone and setup:**

   ```bash
   cd fe2
   npm install
   ```

2. **Environment Configuration:**

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and set:

   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5001/api/v1
   NODE_ENV=development
   ```

3. **Run Development Server:**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Login with demo credentials:**
   - Email: `admin@pridata.com`
   - Password: `password123`

## Project Structure

```
fe2/
├── app/                     # Next.js App Router
│   ├── (auth)/             # Auth routes (login, register)
│   ├── (dashboard)/        # Protected routes with sidebar
│   │   ├── akuntan/        # Accountant role
│   │   ├── gudang/         # Warehouse staff role
│   │   ├── owner/          # Owner role
│   │   ├── fakturis/       # Invoicer role
│   │   └── admin/          # Admin role
│   └── layout.tsx          # Root layout
├── components/
│   ├── layout/             # Sidebar, Navbar
│   ├── shared/             # Reusable components
│   └── [role]/             # Role-specific components
├── services/               # API service layer
├── lib/                    # Utilities (auth, api-client)
├── hooks/                  # Custom React hooks
├── types/                  # TypeScript types
└── constants/              # App constants
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **UI Components**: (Ready for ShadcN UI integration)

## Available Scripts

| Command         | Description                                      |
| --------------- | ------------------------------------------------ |
| `npm run dev`   | Start development server (http://localhost:3000) |
| `npm run build` | Build for production                             |
| `npm start`     | Start production server                          |
| `npm run lint`  | Run ESLint                                       |

## Features by Role

### Owner

- Dashboard with business overview
- Catalog management (products, categories, brands)
- User management
- System reports & analytics
- Full system access

### Admin

- User & role management
- Master data administration
- System configuration
- Audit logs
- System health monitoring

### Invoicist (Fakturis)

- Order management
- Invoice creation & verification
- Customer verification
- Transaction history

### Warehouse Staff (Gudang)

- Stock management
- Goods receipt
- Shipment tracking
- Warehouse transfers
- Stock adjustments & reports

### Accountant (Akuntan)

- Invoice tracking & verification
- Payment management
- Receivables management
- Financial reports
- Aging reports

## Authentication Flow

1. User enters credentials on `/login`
2. Credentials sent to BE2 `/auth/sign-in`
3. Session token stored in cookie (`better-auth.session_token`)
4. Token automatically added to subsequent requests via axios interceptor
5. On token expiry, user redirected to login
6. User data stored in localStorage for client-side access

## Environment Variables

```env
# Backend API URL (required)
NEXT_PUBLIC_API_URL=http://localhost:5001/api/v1

# Environment (development/production)
NODE_ENV=development
```

## API Integration

All API calls use centralized axios instance in `lib/api-client.ts`:

```typescript
// Example: Login
import { authService } from "@/services/auth";

const response = await authService.login({
	email: "user@example.com",
	password: "password123",
});
```

## Custom Hooks

- `useAuth()` - Get current user and auth state
- More hooks can be added in `hooks/` directory

## Route Protection

Routes are protected via:

1. **Middleware** (future): `middleware.ts` can add automatic protection
2. **Component Level**: `useAuth()` hook checks user before rendering
3. **API Level**: Backend validates roles on API endpoints

## Development Workflow

1. **Create new page:**

   ```bash
   # Create: app/(dashboard)/owner/new-page/page.tsx
   export default function NewPage() {
     return <div>Page content</div>;
   }
   ```

2. **Create new service:**

   ```bash
   # Create: services/newService.ts
   export const newService = {
     async getAll() { /* ... */ }
   };
   ```

3. **Add hook:**
   ```bash
   # Create: hooks/useNewHook.ts
   export function useNewHook() { /* ... */ }
   ```

## Phase 1 Status: ✅ COMPLETE

- ✅ Project scaffold with Next.js 15 App Router
- ✅ TypeScript configuration
- ✅ Auth middleware & hooks
- ✅ API client with axios interceptors
- ✅ Route groups for auth/dashboard
- ✅ Login page with demo credentials
- ✅ Role-based navigation & sidebar
- ✅ Placeholder dashboards for all roles
- ✅ Type definitions & constants

## Next Phase: Master Data Management

Phase 2 will implement:

- Product CRUD pages
- Category/Brand management
- DataTable component with filtering/sorting
- FormInput component for data entry
- Master data API services

## Troubleshooting

### Login issues

- Ensure BE2 is running on port 5001
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Verify backend is accepting CORS requests

### Type errors

- Run `npm run build` to check all types
- Ensure TypeScript version is ^5

### Styling not applied

- Tailwind CSS requires `app/globals.css` import in root layout
- Check `tailwind.config.ts` configuration

## Contributing

1. Follow Next.js and React best practices
2. Use TypeScript for all code
3. Create feature branches for new work
4. Keep components small and reusable
5. Add types for all props and functions

## Support

For issues or questions:

1. Check existing documentation
2. Review code comments
3. Check BE2 API documentation
4. Submit issues with detailed reproduction steps

## License

© 2026 PT. Pridata Jaya. All rights reserved.
