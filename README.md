# DolphStore

A real estate REST API built with [DolphJS](https://github.com/dolphjs/dolph), TypeORM, and PostgreSQL. Built as a reference implementation of DolphJS conventions at a medium/enterprise scale — pure API, no UI.

## Stack

- **Framework:** `@dolphjs/dolph` (spring/decorator routing)
- **Database:** PostgreSQL via TypeORM
- **Validation:** [Joi](https://joi.dev) for environment config, [class-validator](https://github.com/typestack/class-validator) + [class-transformer](https://github.com/typestack/class-transformer) for request DTOs
- **Auth:** JWT access + refresh tokens, rotated and revocable per-device (IAM module)
- **Email:** [MJML](https://mjml.io) templates rendered with Handlebars, sent through [Sendbyte](https://docs.sendbyte.africa) behind a swappable `EmailProvider` interface
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

| Method | Path          | Auth required | Notes                                                    |
| ------ | ------------- | -------------- | --------------------------------------------------------- |
| POST   | `/register`   | —              | `role` optional, defaults to `user`; `admin` can't self-assign |
| POST   | `/login`      | —              |                                                             |
| POST   | `/refresh`    | —              | Rotates the pair; the old refresh token stops working      |
| POST   | `/logout`     | Bearer token   | Revokes the refresh token in the body                      |
| POST   | `/logout-all` | Bearer token   | Revokes every refresh token issued to the user             |
| GET    | `/me`         | Bearer token   |                                                             |

Passwords are hashed with bcrypt (`@dolphjs/dolph`'s `hashString`/`compareHashedString`) and the `password` column is `select: false` — it's never returned in a response unless a query explicitly opts in (`UserService#findByEmailWithPassword`, used only for login).

Refresh tokens are rotated on every use and tracked per-device in the `refresh_tokens` table: each row's `id` doubles as the JWT's `jti` claim, and only a bcrypt hash of the signed token is stored — see `TokenService`.

`IamService` is the module's upper-level service (see "Services" above); `UserService`, `TokenService`, and `EmailService` are the lower-level services it orchestrates. Registration sends a welcome email best-effort — a delivery failure is logged, not thrown, so a provider outage never blocks account creation.

## Email (`src/shared/email`)

Application code depends on `EmailProvider` (`send(message): Promise<EmailSendResult>`), never on a specific vendor. `SendbyteEmailProvider` is the only implementation today; swapping providers means writing a new class against the same interface and pointing `email-provider.factory.ts` at it via `EMAIL_PROVIDER`; nothing above `EmailService` changes.

```ts
await this.emailService.sendTemplate(
  'welcome',
  { firstName: user.firstName },
  { to: user.email, subject: 'Welcome to DolphStore' },
);
```

`sendTemplate` renders an `.mjml` file from `src/shared/email/templates` with Handlebars variables, compiling MJML once per template (cached) so repeated sends only re-run the cheap Handlebars substitution. Add a template by dropping a `.mjml` file in that folder and referencing its name.

`SendByteError` is never allowed to leak past the provider — it's caught and rewrapped as `EmailSendException`, so nothing outside `src/shared/email` needs to know which vendor is in use.

## Roadmap

- [x] Foundation: env validation, DTO validation convention, TypeORM/Postgres wiring, shared entity/enum/interface scaffolding
- [x] IAM: registration, login, JWT access + refresh token rotation
- [x] Email: MJML + Handlebars templates, Sendbyte provider behind a swappable interface
- [ ] Properties/Listings: CRUD, media, search & filtering
- [ ] Reviews/Ratings
- [ ] Payments: Paystack + Flutterwave
