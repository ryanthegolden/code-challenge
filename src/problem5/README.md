# README.md

## Setup

1. Copy `.env.example` to `.env` and fill in credentials.
2. Run:
   ```bash
   docker-compose up --build
   ```
3. Apply migrations:
   ```bash
   docker exec -it <app_container> yarn prisma migrate dev --name init
   ```

## Scripts

- `yarn dev` — start in dev mode with reload
- `yarn build` — compile TS
- `yarn start` — run compiled code
- `yarn lint` — run ESLint
- `yarn format` — run Prettier
- `yarn prisma studio` — open DB GUI

## Auth Endpoints

| Method | Path                      | Description                         |
| ------ | ------------------------- | ----------------------------------- |
| POST   | `/api/auth/register`      | Register with email & password      |
| POST   | `/api/auth/login`         | Login & get access + refresh tokens |
| POST   | `/api/auth/refresh-token` | Refresh tokens                      |
| POST   | `/api/auth/revoke-token`  | Revoke refresh token                |

## Protected Endpoints

All `/api/users` and `/api/items` routes require `Authorization: Bearer <token>` header.

## Role-based Access

- Only `ADMIN` role can manage users.
- All authenticated users can CRUD their own items.
