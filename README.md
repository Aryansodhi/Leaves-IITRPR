## LeaveFlow · IIT Ropar

LeaveFlow is the new digital cockpit for IIT Ropar’s leave, LTC and travel permission workflows. It keeps HoDs, Dean Affairs, Registrar, Accounts and the Director’s office aligned with contextual nudges, OTP-based access and Prisma-backed audit trails.

### Stack

- Next.js 14 App Router + React 19 + TypeScript
- Tailwind CSS v4 with a custom design system
- Prisma ORM + PostgreSQL (Supabase friendly) with seed data covering departments, roles and approval steps
- Zod + React Hook Form for resilient client UX
- Nodemailer OTP delivery with console fallback
- ESLint 9, Prettier 3, Husky + lint-staged for safe commits

## Getting Started

```bash
npm install
cp .env.example .env
# fill DATABASE_URL / email SMTP settings (Supabase recommended)

npm run prisma:generate
npm run db:push           # creates tables in the target database
npm run prisma:seed       # optional sample data + workflows

npm run dev
```

Visit <http://localhost:3000> for the dashboard mock and <http://localhost:3000/login> for the OTP experience.

## Environment variables

| Key                           | Purpose                                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` / `DIRECT_URL` | Postgres connection strings (Supabase works out-of-the-box).                                             |
| `NEXT_PUBLIC_APP_URL`         | URL used when building absolute links inside emails.                                                     |
| `NEXT_PUBLIC_OTP_MINUTES`     | Client hint for OTP expiry (mirrors server value).                                                       |
| `EMAIL_*` vars                | SMTP credentials for Nodemailer. When omitted the server logs OTPs to the console for local development. |
| `OTP_EXP_MINUTES`             | Server-side expiry enforcement for OTP tokens.                                                           |

See `.env.example` for defaults.

## Database shape

Key Prisma models:

- `User`, `Role`, `Department` — cover faculty vs non-teaching staff, HoD assignments and reporting chains.
- `LeaveType`, `LeaveApplication`, `ApprovalStep` — describe each leave family, the application metadata and multi-hop approvals with escalation actors (HoD → Dean → Registrar → Accounts → Director).
- `OfficeOrder`, `LeaveAttachment`, `Notification` — attach orders, supporting documents and alert stakeholders.
- `OtpToken`, `LeaveBalance` — ephemeral OTPs with hashed storage and leave balance tracking per cycle.

Run `npm run prisma:seed` for a realistic dataset (CSE department, HoD, Dean, Registrar, etc.) demonstrating Earned Leave, LTC and Air India exemption flows.

## Auth flow

1. `/api/auth/request-otp` throttles requests, creates a hashed OTP row and emails/prints the code.
2. `/api/auth/verify-otp` validates the code, stamps `lastLoginAt`, records a notification and returns a session token placeholder.
3. The React client uses React Hook Form + Zod for both email and OTP steps with inline status states.

## Available scripts

| Script                      | Description                                                     |
| --------------------------- | --------------------------------------------------------------- |
| `npm run dev`               | Start the Next.js dev server with Turbopack.                    |
| `npm run build` / `start`   | Production bundle & serve.                                      |
| `npm run lint` / `lint:fix` | ESLint 9 (core web vitals config).                              |
| `npm run format`            | Prettier sweep for TS/JS/MD/CSS/JSON.                           |
| `npm run prisma:*`          | Helpers for `generate`, `db push`, migrations, deploy and seed. |
| `npm run lint-staged`       | Invoked by Husky pre-commit to lint + format staged files.      |

## Next steps

- Wire Supabase Auth or a custom session layer using the OTP token + NextAuth/lucia.
- Build per-leave dynamic forms (Earned, Station, LTC, Ex-India, Airline permission) using Prisma metadata.
- Add role-based dashboards (HoD queue, Accounts backlog, Director escalations) and office-order PDF generation.
- Integrate notifications (email + internal inbox) and escalate overdue approvals automatically.
