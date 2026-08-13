# DolphStore

A real estate REST API built with [DolphJS](https://github.com/dolphjs/dolph), TypeORM, and PostgreSQL. Built as a reference implementation of DolphJS conventions at a medium/enterprise scale — pure API, no UI.

## Stack

- **Framework:** `@dolphjs/dolph` (spring/decorator routing)
- **Database:** PostgreSQL via TypeORM
- **Validation:** [Joi](https://joi.dev) for environment config, [class-validator](https://github.com/typestack/class-validator) + [class-transformer](https://github.com/typestack/class-transformer) for request DTOs
- **Auth:** JWT (access + refresh tokens) — coming in the IAM module
- **Payments:** Paystack and Flutterwave — coming in the payments module

## Getting Started

```bash
yarn install
cp .env.example .env   # fill in real secrets/credentials
yarn dev:start          # dolph watch
```

The app **refuses to boot** if `.env` is missing or malformed — see [`src/shared/configs/env.schema.ts`](src/shared/configs/env.schema.ts) for the exact rules. Fix-the-list-it-prints-you rather than guessing.

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

### Environment & secrets

Add new env vars to `env.schema.ts` (with a real Joi constraint, not a rubber-stamp `.string()`), regenerate `.env.example`, and read them through `env` (`src/shared/configs`) — never `process.env` directly in application code. No default secrets, ever; required Joi fields with no `.default()` are required on purpose.

## Roadmap

- [x] Foundation: env validation, DTO validation convention, TypeORM/Postgres wiring, shared entity/enum/interface scaffolding
- [ ] IAM: registration, login, JWT access + refresh token rotation
- [ ] Properties/Listings: CRUD, media, search & filtering
- [ ] Reviews/Ratings
- [ ] Payments: Paystack + Flutterwave
