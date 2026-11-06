# Somtel Enterprise Sales System

Sales and order management for Somtel Enterprise (Dahabshiil Group), Hargeisa.
It replaces the Excel CRM and the sales follow-up parts of Microsoft Dynamics.

**Lead → Deal → Quote / Proposal → Approval → Order → Activation / Delivery → Billing → Renewal**

The design (data model, screens, confirmed business rules) is in [`../docs/DESIGN.md`](../docs/DESIGN.md).

## Build status

| Phase | Scope | Status |
|---|---|---|
| 1 | Sign in, roles, settings, branding, customers (groups, entities, people), catalogs (Somtel services; IT vendors, products and distributors) | **Done** |
| 2 | Pipeline (kanban + table), activities, follow-ups, stale deals | Next |
| 3 | Costing calculator, quotes and proposals, approvals, PDF and Word | |
| 4 | Non-IT orders (Billing then tech sections), IT orders (12 stages) | |
| 5 | Vehicle tracking orders, renewals, notifications | |
| 6 | Dashboards, reports, Excel import and export, audit log screens | |

---

## 1. What you need

- A Linux server with **Docker** and the **Docker Compose plugin** (`docker compose version` should work).
- The server must reach the Debian package mirror and the npm registry while the image is being built.
- About 4 GB of free disk for the image and database.

## 2. Install and run with Docker

```bash
git clone <this repository> somtel
cd somtel/somtel-sales
cp .env.example .env
```

Edit `.env` (see section 3), then:

```bash
docker compose up -d --build
```

This starts three containers:

| Container | What it does |
|---|---|
| `db` | PostgreSQL 16. Data is kept in the `pgdata` volume. |
| `app` | The web app on port 3000. On every start it applies database updates and makes sure the reference data exists (sectors, stages, catalog, T&C). It never overwrites changes made in the app. |
| `worker` | Sends queued emails every 30 seconds and retries failures. Later phases add reminders and alerts here. |

Open `http://<server>:3000`. To use another port set `APP_PORT=8080` in `.env`.
For HTTPS, put the app behind your usual reverse proxy (nginx, IIS, Traefik) and set `APP_URL` to the public https address.

Check that everything is running:

```bash
docker compose ps
```

```bash
docker compose logs -f app worker
```

## 3. The `.env` file

| Setting | What to put |
|---|---|
| `POSTGRES_PASSWORD` | A strong database password. **Use letters and numbers only** (it goes inside a URL). |
| `DATABASE_URL` | Only used when running without Docker. Docker Compose builds it from `POSTGRES_PASSWORD`. |
| `AUTH_SECRET` | A long random string. Create one with `openssl rand -base64 32`. Changing it signs everyone out. |
| `APP_URL` | The address users type, for example `https://sales.somtel.com`. Used in email links. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Your mail server. For Microsoft 365: host `smtp.office365.com`, port `587`, secure `false`, and a mailbox that is allowed to send with SMTP AUTH. |
| `UPLOAD_DIR` | Leave as it is for Docker (`/data/uploads`, kept in the `uploads` volume). |

After changing `.env`, apply it with:

```bash
docker compose up -d
```

Then send a test email from **Settings → Email**.

## 4. Create the first Admin user

```bash
docker compose exec -e ADMIN_EMAIL=you@somtel.com -e ADMIN_NAME="Your Name" -e ADMIN_PASSWORD="ChooseAStrongPassword1" app npx tsx scripts/create-admin.ts
```

The password needs at least 10 characters with letters and numbers. Running the same command for an existing email resets that
user's password and adds the Admin role, which is also how you get back in if the last Admin forgets their password.

Then sign in and follow the **Admin setup** checklist on the dashboard:

1. **Settings → Company and logo**: upload the real logo (it replaces `public/logo.png` everywhere) and fill in address and phone.
2. **Settings → Users and roles**: add the team. Set **Reports to** to build the reporting line (Sector Managers → Manager → Head of Enterprise).
3. **Settings → Tech sections**: add the real tech section names and their team mailboxes.
4. **Catalog → Somtel services**: open each service and tick the tech sections that activate it.
5. **Catalog → Distributors**: add your distributors, then on each **Vendor** page link the distributors you buy that vendor from.
6. **Catalog → IT products**: add products and their hardware or software sub-products (part numbers, terms).
7. **Settings → Business rules**: set the VAT % and the minimum markup floors when they are confirmed.

## 5. Demo data (testing only)

Do **not** run this on the live server. It adds sample users, customer groups, entities and people, sample tech sections,
sample distributors, example IT products and sample distributor costs. Running it again only adds what is missing.

```bash
docker compose exec app npx tsx prisma/seed-demo.ts
```

All demo users sign in with the password `Somtel2026demo`:

| Email | Role |
|---|---|
| `admin@example.com` | Admin |
| `rashid.hassan@example.com` | Head of Enterprise |
| `mohamed.dahir@example.com` | Manager (reports to Rashid) |
| `amina.yusuf@example.com`, `abdirahman.ali@example.com`, `hodan.farah@example.com` | Sector Managers (report to Mohamed) |
| `khadar.ismail@example.com` | Enterprise Support |
| `sahra.jama@example.com` | Procurement |
| `ibrahim.warsame@example.com` | Finance |
| `fadumo.osman@example.com` | Billing |
| `yasin.abdi@example.com`, `nimco.hussein@example.com` | Tech Section |

## 6. Back up and restore

Back up the database and uploaded files (logo, and later contracts and POs) into `backups/<date>/`:

```bash
sh scripts/backup.sh
```

Copy the `backups` folder to another machine or storage every day. To run it every night at 01:30, add this line with `crontab -e`
(change the path to where the app lives):

```text
30 1 * * * cd /opt/somtel/somtel-sales && sh scripts/backup.sh >> backups/backup.log 2>&1
```

Restore a database backup (this replaces the current data):

```bash
docker compose exec -T db pg_restore -U somtel -d somtel --clean --if-exists --no-owner < backups/<date>/somtel.dump
```

Restore uploaded files:

```bash
docker compose run --rm --no-deps -T --user root --entrypoint "" -v "$(pwd)/backups/<date>:/backup" app tar -xzf /backup/uploads.tar.gz -C /data
```

## 7. Update to a new version

```bash
git pull
```

On Windows, in PowerShell, run the same commands from the `somtel-sales` folder.

```bash
docker compose up -d --build
```

Database changes are applied automatically when the app starts. Take a backup first.

---

## Development (without Docker)

Needs Node.js 22 and PostgreSQL 16.

```bash
npm install
```

```bash
cp .env.example .env
```

Set `DATABASE_URL` in `.env` to your local database, then:

```bash
npx prisma migrate deploy && npm run db:seed && npm run db:seed:demo
```

```bash
npm run dev
```

```bash
npm run worker
```

| Command | What it does |
|---|---|
| `npm test` | Unit tests for the business rules |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build |
| `npx prisma migrate dev --name <change>` | Create a database migration after editing `prisma/schema.prisma` |

### Project layout

```text
prisma/schema.prisma        Database tables
prisma/seed-data.ts         Reference data from the brief (price cards, stages, T&C)
prisma/seed.ts              Loads reference data (safe to run again)
prisma/seed-demo.ts         Demo users and clients
scripts/                    Worker, first admin, backup, Docker start
src/lib/settings-registry.ts Every editable business number and its default
src/lib/roles.ts            Roles and permissions
src/lib/pricing.ts          Pricing rules (volume bands, rounding)
src/app/(auth)/             Sign in and password reset
src/app/(app)/              The application screens
tests/                      Unit tests
```

### How access works

| Role | Phase 1 access |
|---|---|
| Admin | Everything: settings, users, catalogs, all customers, audit log |
| Head of Enterprise | All customers, audit log, catalogs (read), distributor costs |
| Manager | Own customers and everyone below them in the reporting line, distributor costs |
| Sector / Account Manager | Own customers only, distributor costs |
| Enterprise Support, Procurement | All customers (read), catalogs (read), view and record distributor costs |
| Finance | All customers (read), catalogs (read), view distributor costs |
| Billing | All customers (read), catalogs (read). No distributor costs |
| Tech Section | No customers or catalogs. They will see only their activation tasks (Phase 4) |

Customers are organised as **Group → Entity → Person**. An entity is the legal company you quote and bill; a group is optional.
A group can be seen by anyone who owns it or can see one of its entities.
An entity (or group) can be edited by its owner, anyone above the owner in the reporting line, the Head of Enterprise and Admin.
Managers, the Head and Admin can delete (soft delete; Admin can restore from **Customers → Show deleted entities**).
