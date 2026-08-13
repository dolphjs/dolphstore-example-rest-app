# DolphStore

A real estate REST API built with [DolphJS](https://github.com/dolphjs/dolph), TypeORM, and PostgreSQL. Built as a reference implementation of DolphJS conventions at a medium/enterprise scale — pure API, no UI.

## Stack

- **Framework:** `@dolphjs/dolph` (spring/decorator routing)
- **Database:** PostgreSQL via TypeORM
- **Validation:** [Joi](https://joi.dev) for environment config, [class-validator](https://github.com/typestack/class-validator) + [class-transformer](https://github.com/typestack/class-transformer) for request DTOs
- **Auth:** JWT access + refresh tokens, rotated and revocable per-device (IAM module)
- **Email:** [MJML](https://mjml.io) templates rendered with Handlebars, sent through [Sendbyte](https://docs.sendbyte.africa) behind a swappable `EmailProvider` interface
- **Media:** Property images uploaded to [Cloudinary](https://cloudinary.com) behind a swappable `ImageStorageProvider` interface — same pattern as email
- **Payments:** Paystack and Flutterwave — coming in the payments module

## Getting Started

```bash
yarn install
cp .env.example .env   # fill in real secrets/credentials
yarn dev:start          # dolph watch
```

The app **refuses to boot** if `.env` is missing or malformed — see [`src/shared/configs/env.schema.ts`](src/shared/configs/env.schema.ts) for the exact rules. Fix-the-list-it-prints-you rather than guessing.

### API Docs

[`docs/openapi.json`](docs/openapi.json) is the OpenAPI 3.0 spec for every endpoint — paste it into [Swagger Editor](https://editor.swagger.io) or Postman, or view it locally:

```bash
npx @redocly/cli preview-docs docs/openapi.json
```

Update it whenever a route, DTO, or response shape changes.

### Database

```bash
yarn migration:generate src/database/migrations/InitialSchema
yarn migration:run
```

`src/database/data-source.ts` is a separate `DataSource` used only by the `typeorm` CLI for migrations. The app's actual runtime connection is auto-initialized by `DolphFactory` from the `database.typeorm.options` block in `dolph_config.yaml` (see [DolphJS's TypeORM docs](https://dolphjs.com/docs/techniques/database/typeorm)) — both read the same env vars, so they never drift apart.

`host`/`username`/`password` in `dolph_config.yaml` are set to the literal string `sensitive`, which DolphJS auto-replaces with `SQL_HOST`/`SQL_USER`/`SQL_PASSWORD` from `.env` at boot. `port` and `database` aren't covered by that mechanism, so if you change `SQL_PORT`/`SQL_DATABASE`, update `dolph_config.yaml` to match by hand.

## Architecture Conventions

Every module built on top of this foundation should follow these rules — they're what makes the codebase predictable to navigate.

### Folder structure

```
src/
  server.ts                  entrypoint — loads env config first, then boots DolphFactory
  database/
    data-source.ts           CLI-only DataSource, for migrations
    migrations/
  shared/                    cross-cutting code, nothing domain-specific
    configs/                 env.schema.ts (Joi) + env.config.ts (validated, frozen `env` export)
    entities/                AbstractEntity — id/createdAt/updatedAt/deletedAt, extend this in every entity
    enums/                   Role, and other app-wide enums
    interfaces/               JwtPayload, and other shared contracts
    dto/                     PaginationDto, and other cross-module DTOs
  components/
    <domain>/                one folder per bounded domain (iam, properties, reviews, payments, ...)
      <domain>.component.ts  @Component({ controllers, services })
      <domain>.controller.ts @Route(...), extends DolphControllerHandler
      <domain>.service.ts    extends DolphServiceHandler
      <domain>.entity.ts     TypeORM entity, extends AbstractEntity
      <domain>.dto.ts        class-validator DTOs for that domain's routes
```

Path aliases (`tsconfig.json`) mirror this: `@/components/*`, `@/shared/*`, `@/configs/*`, etc.

### Request validation

Define a DTO class with `class-validator` decorators, then bind it with `@DBody`, `@DParam`, or `@DQuery` — DolphJS validates and transforms the request before your handler runs (see `core/transformer.ts` in the framework). Don't hand-roll validation in controllers.

```ts
export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsNumber()
  @Min(0)
  price: number;
}

@Post()
async create(@DBody(CreatePropertyDto) body: CreatePropertyDto) {
  return this.propertyService.create(body);
}
```

A failed validation now returns `400` with a field-level `errors` array — fixed upstream in `@dolphjs/dolph` (`core/error.core.ts`) as part of this foundation, since the shipped behavior was returning a generic `500`.

### Services: upper-level vs lower-level

DolphJS distinguishes **upper-level** services (talk to controllers) from **lower-level** services (talk to each other / external systems) — see `DolphServiceHandler`'s doc comment in `classes/service_classes.class.ts`. The payments module is the reference example: `PaystackService` and `FlutterwaveService` are lower-level, provider-specific services; `PaymentService` is the upper-level service controllers actually inject, which decides which provider to call.

### Entities

Extend `AbstractEntity` (`src/shared/entities/abstract.entity.ts`), not TypeORM's own `BaseEntity` — this codebase uses the Repository pattern (`getDataSource().getRepository(X)`), not Active Record.

Two rules that keep entities testable against an in-memory `better-sqlite3` DataSource in Jest (see the IAM module's specs) as well as correct on Postgres:

- Don't give date columns (`@CreateDateColumn`, etc.) an explicit `type` — let TypeORM pick each driver's native type.
- Use `type: 'simple-enum'`, not `type: 'enum'`, for enum-backed columns (`enum` is Postgres-only; `simple-enum` works cross-driver and still becomes a real Postgres `ENUM` type at migration time).

Inside a `@Component`-managed service, always access the repository through a **getter**, never a field initializer — `@Component` constructs every listed service at module-import time, before `DolphFactory` has run `autoInitTypeOrm()`. See the `:::caution` in [DolphJS's TypeORM docs](https://dolphjs.com/docs/techniques/database/typeorm) and `UserService`/`TokenService` for the pattern.

### Migrations

`synchronize` is `false` — schema changes go through migrations, generated by diffing entities against a real running Postgres:

```bash
yarn migration:generate src/database/migrations/SomeDescriptiveName
yarn migration:run
```

(`src/database/migrations/InitialSchema` — the `users`/`refresh_tokens` tables — was generated and verified this way against a disposable Postgres container before being committed.)

### Environment & secrets

Add new env vars to `env.schema.ts` (with a real Joi constraint, not a rubber-stamp `.string()`), regenerate `.env.example`, and read them through `env` (`src/shared/configs`) — never `process.env` directly in application code. No default secrets, ever; required Joi fields with no `.default()` are required on purpose.

## Auth (IAM module)

All routes below are mounted at `/v1/auth`.

| Method | Path                  | Auth required | Notes                                                                 |
| ------ | --------------------- | -------------- | ---------------------------------------------------------------------- |
| POST   | `/register`           | —              | No tokens issued — creates the account and emails a 6-digit code; `role` optional (defaults to `user`, `admin` can't self-assign) |
| POST   | `/verify-email`       | —              | Confirms the code; issues a token pair on success (no separate login needed) |
| POST   | `/resend-verification`| —              | Always 200 with the same generic message — doesn't leak whether the email is registered |
| POST   | `/login`              | —              | 403 if the email hasn't been verified yet                              |
| POST   | `/refresh`            | —              | Rotates the pair; the old refresh token stops working                  |
| POST   | `/logout`             | Bearer token   | Revokes the refresh token in the body                                  |
| POST   | `/logout-all`         | Bearer token   | Revokes every refresh token issued to the user                         |
| GET    | `/me`                 | Bearer token   |                                                                          |

Passwords are hashed with bcrypt (`@dolphjs/dolph`'s `hashString`/`compareHashedString`) and the `password` column is `select: false` — it's never returned in a response unless a query explicitly opts in (`UserService#findByEmailWithPassword`, used only for login).

Refresh tokens are rotated on every use and tracked per-device in the `refresh_tokens` table: each row's `id` doubles as the JWT's `jti` claim, and only a bcrypt hash of the signed token is stored — see `TokenService`.

Email verification codes (`email_verification_codes` table, `EmailVerificationService`) are 6 digits, bcrypt-hashed at rest, expire after 15 minutes, lock out after 5 wrong guesses (forcing a resend), and are rate-limited to one issue per 60 seconds per user — `register` and `/resend-verification` both go through the same `issueCode`, so that cooldown applies to both.

`IamService` is the module's upper-level service (see "Services" above); `UserService`, `TokenService`, `EmailService`, and `EmailVerificationService` are the lower-level services it orchestrates. The verification email send is best-effort — a delivery failure is logged, not thrown, so a provider outage never blocks account creation (the user can always hit `/resend-verification` once it's back).

## Email (`src/shared/email`)

Application code depends on `EmailProvider` (`send(message): Promise<EmailSendResult>`), never on a specific vendor. `SendbyteEmailProvider` is the only implementation today; swapping providers means writing a new class against the same interface and pointing `email-provider.factory.ts` at it via `EMAIL_PROVIDER`; nothing above `EmailService` changes.

```ts
await this.emailService.sendTemplate(
  'verify-email',
  { firstName: user.firstName, code },
  { to: user.email, subject: 'Verify your email' },
);
```

**Testing note:** if a spec builds its `TestingApp` with `overrides` (e.g. to mock `EmailService`), pass the component as a lazy loader — `() => import('./iam.component').then(m => m.IamComponent)` — not an eagerly-imported class. `@Component` resolves and constructs every listed service the moment its module is evaluated; an eager `import` at the top of the spec file runs that resolution (with the real, unmocked service) before `overrides` ever gets a chance to seed the registry. See `iam.controller.e2e-spec.ts`.

`sendTemplate` renders an `.mjml` file from `src/shared/email/templates` with Handlebars variables, compiling MJML once per template (cached) so repeated sends only re-run the cheap Handlebars substitution. Add a template by dropping a `.mjml` file in that folder and referencing its name.

`SendByteError` is never allowed to leak past the provider — it's caught and rewrapped as `EmailSendException`, so nothing outside `src/shared/email` needs to know which vendor is in use.

## Properties (Listings module)

All routes below are mounted at `/v1/properties`.

| Method | Path                        | Auth required        | Notes                                                        |
| ------ | --------------------------- | --------------------- | -------------------------------------------------------------- |
| GET    | `/`                         | —                     | Search — always scoped to `published` listings                |
| GET    | `/mine`                     | Bearer (agent/admin)  | The caller's own listings, any status                          |
| GET    | `/:id`                      | —                     | 404 for anything not `published` (including the owner's own drafts) |
| POST   | `/`                         | Bearer (agent/admin)  | Starts as `draft`                                               |
| PATCH  | `/:id`                      | Bearer, owner or admin| Includes `status` — how a listing gets published/archived      |
| DELETE | `/:id`                      | Bearer, owner or admin| Soft delete                                                     |
| POST   | `/:id/images`                | Bearer, owner or admin| `multipart/form-data`, field name `image`                      |
| DELETE | `/:id/images/:imageId`       | Bearer, owner or admin|                                                                  |

Two authorization layers, checked in order: `requireRole(Role.AGENT, Role.ADMIN)` (`src/shared/middlewares`) gates who can hit write routes at all; `PropertiesService#assertOwnership` then checks that a non-admin caller owns the specific listing (`agentId` match) before allowing an update/delete/image change. `requireRole` reads `req.payload`, so on any route stacking it with `authShield`, `authShield` must run first — write `@UseMiddleware(requireRole(...))` **above** `@UseMiddleware(authShield)` in source. `@UseMiddleware` decorators evaluate bottom-up (closest to the method runs first, and runs first in the Express chain), which is the opposite of how the stack reads top-to-bottom — verified with a dedicated e2e test (unauthenticated → 401, wrong role → 403) rather than trusted by inspection. See `properties.controller.ts`.

`price`/`areaSqm` are `decimal` columns with an explicit TypeORM `transformer` — Postgres's `pg` driver returns `numeric` as a string by default (a well-known gotcha), so without it every property's `price` would come back as `"45000.00"` instead of `45000` in API responses. Confirmed empirically against a real Postgres container before committing, not just assumed from sqlite (which returns `decimal` as a native `number` either way, so it wouldn't have caught this).

`PropertiesService` is the upper-level service; `PropertyService` (search/CRUD via a TypeORM query builder — `LOWER(...) LIKE LOWER(...)` for city/state, not `ILIKE`, since `ILIKE` is Postgres-only and breaks the sqlite-backed tests) and `PropertyImageService` (wraps `ImageStorageService`, tracks image `position`) are the lower-level ones it composes.

## Media (`src/shared/storage`)

Same swappable-provider shape as email: `ImageStorageProvider` (`upload(buffer, folder)`, `remove(publicId)`) is the interface application code depends on; `CloudinaryImageStorageProvider` is the only implementation, selected via `IMAGE_STORAGE_PROVIDER` in `image-storage-provider.factory.ts`. Uploads never touch disk — DolphJS's built-in `useFileUploader` middleware defaults to `memoryStorage()`, so `req.file.buffer` goes straight to Cloudinary's `upload_stream`.

## Roadmap

- [x] Foundation: env validation, DTO validation convention, TypeORM/Postgres wiring, shared entity/enum/interface scaffolding
- [x] IAM: registration, login, JWT access + refresh token rotation
- [x] Email: MJML + Handlebars templates, Sendbyte provider behind a swappable interface
- [x] Properties/Listings: CRUD, Cloudinary-backed image upload, search & filtering
- [ ] Reviews/Ratings
- [ ] Payments: Paystack + Flutterwave
