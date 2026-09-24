# Coding Standards

> Your conventions. Tuned by `/onboard` to the real project stack: Next.js
> (frontend) + Express/TypeScript (backend), monorepo, no auth, no ORM chosen
> yet. Edit further as conventions solidify.

## TypeScript

- Strict mode enabled
- No `any` types - use proper typing or `unknown`
- Define interfaces for all props, API responses, and data models
- Use type inference where obvious, explicit types where helpful

## React

- Functional components only (no class components)
- Use hooks for state and side effects
- Keep components focused - one job per component
- Extract reusable logic into custom hooks

## Next.js

- Server components by default
- Only use `'use client'` when needed (interactivity, hooks, browser APIs)
- Use Server Actions for form submissions and simple mutations
- Use API routes when you need:
  - Webhooks (Clerk, GitHub, etc.)
  - File uploads with progress tracking
  - Long-running operations
  - Specific HTTP status codes or headers
  - Endpoints for future mobile/CLI clients
  - Third-party integrations
- Otherwise, fetch data directly in server components
- Dynamic routes for item/collection pages

## Backend Architecture

> TODO: the database driver/ORM is not chosen yet (build-plan item 2 defines
> the SQLite video model). Keep repositories as the only layer that touches
> whatever library is chosen.

The backend (Express + TypeScript) uses a four-layer architecture. Each layer
has one job, and dependencies only point downward:

`Routes -> Controllers -> Service interfaces -> Service implementations ->
Repository interfaces -> Repository implementations -> SQLite`

1. **Routes** - map an HTTP method + path to a controller, and attach the
   validation middleware for that route.
2. **Controllers** - read the already-validated request DTO and call one
   service method with it, then send the response DTO the service returns as
   JSON. Depend on service **interfaces**, never on a concrete service class.
   No business logic, no direct database access, and no domain entities:
   controllers only ever see DTOs, on the way in and on the way out.
3. **Services** - hold all business logic and operate on **domain entities**,
   not DTOs or Prisma models. A service converts the incoming request DTO
   into a domain entity (or fetches one via the repository), applies business
   rules to it, passes domain entities to the repository, and, before
   returning, maps the resulting domain entity to a response DTO. Depend on
   repository **interfaces**, never on Prisma or a concrete repository class
   directly.
4. **Repositories** - the only layer allowed to import the database
   driver/ORM. Each repository implements an interface and translates between
   stored rows and domain entities.

A layer must never import from a layer below the one directly beneath it (for
example, a controller must never import Prisma or a repository directly).

### Backend Folder Structure

- Routes: `src/routes/[feature].routes.ts`
- Controllers: `src/controllers/[feature].controller.ts`
- Service interfaces: `src/services/interfaces/I[Feature]Service.ts`
- Service implementations: `src/services/[feature].service.ts`
- Repository interfaces: `src/repositories/interfaces/I[Feature]Repository.ts`
- Repository implementations: `src/repositories/[feature].repository.ts`
- Request DTOs: `src/dtos/[feature].dto.ts`
- Response DTOs: `src/dtos/[feature].dto.ts` (same file as the request DTOs
  for that feature)
- Entities/domain models: `src/entities/[feature].entity.ts`
- Middleware: `src/middleware/[name].middleware.ts`
- Custom errors: `src/errors/[Name]Error.ts`

### DTOs (Request and Response)

DTOs are the only shape a controller ever knows about. A domain entity never
crosses into a controller in either direction, keeping the internal business
model free to change without breaking the external API contract.

- **Request DTOs** - every request body/params/query that reaches a
  controller is represented by a DTO, defined next to its Zod schema in
  `src/dtos/[feature].dto.ts`:
  `export const createUserSchema = z.object({...}); export type
  CreateUserDto = z.infer<typeof createUserSchema>;`
  The Zod schema is the single source of truth; the DTO type is always
  inferred from it, never hand-written separately. The validation middleware
  parses the request with the schema and attaches the typed DTO to the
  request; the controller reads that DTO and passes it straight to the
  service, unchanged.
- **Response DTOs** - the plain object shape a service returns and a
  controller sends as JSON, e.g. `UserResponseDto` in the same
  `src/dtos/[feature].dto.ts` file. A response DTO only exists when the
  domain entity needs to be reshaped for the client (renamed/omitted/computed
  fields, hiding internal-only data such as a password hash). If a service's
  return value would be identical to the domain entity, reuse the entity's
  type instead of adding a pass-through DTO.
- Neither kind of DTO is ever passed to a repository.

### Domain Entities

- A domain entity represents a business object (e.g. `User`, `Video`) the way
  the business logic thinks about it, independent of both the external
  request/response shape (DTOs) and the database schema (Prisma model).
- Services are the only layer that constructs or mutates domain entities. A
  service turns an incoming request DTO into a domain entity (or asks the
  repository for an existing one), applies business rules, then either passes
  the resulting entity to the repository to persist, or maps it to a response
  DTO to return to the controller.
- Repositories own the query and the column list for every read, and map an
  entity to a row on write. The row-to-entity mapping on read may live on the
  entity itself, as a constructor that builds an instance from a raw row
  (e.g. `new Video(row)`), instead of a separate repository-side mapper -
  the important boundary is that no layer other than the repository ever
  reads a raw row or imports the database driver's types. Controllers and
  DTOs never reference a domain entity's row-constructing constructor
  directly, and a domain entity never leaks a database-driver type to those
  layers.

### Dependency Injection

- Manual constructor injection only, no DI container/library.
- A controller receives its service interface(s) as constructor parameters,
  e.g. `constructor(private userService: IUserService) {}`.
- A service receives its repository interface(s) as constructor parameters,
  e.g. `constructor(private userRepository: IUserRepository) {}`.
- Concrete service and repository instances are created once and wired
  together in a single composition file (e.g. `src/container.ts`), then
  passed into controllers.
- This keeps both layers testable: tests pass a fake implementing the
  interface instead of touching the real service or Prisma.

### Backend Validation

- Validate all incoming requests with Zod in a validation **middleware** that
  runs before the controller.
- Controllers assume `req.body`/`req.params`/`req.query` are already valid.

### Backend Error Handling

- Services and repositories throw custom, typed error classes (e.g.
  `NotFoundError`, `ValidationError`, `UnauthorizedError`) defined in
  `src/errors/`.
- One global Express error-handling middleware (registered last) catches
  thrown errors, maps each error type to an HTTP status code, and returns a
  consistent JSON error response.
- Controllers do not build error responses with try/catch. Express 5 forwards
  a rejected promise from an async route handler to the error middleware
  automatically, so letting an error throw is enough.

### Backend Naming

- Service interfaces: `IUserService` (interface, `I` prefix)
- Service implementations: `UserService` (plain name, implements the
  interface)
- Repository interfaces: `IUserRepository` (interface, `I` prefix)
- Repository implementations: `UserRepository` (plain name, implements the
  interface)
- Request DTOs: PascalCase ending in `Dto` (e.g. `CreateUserDto`,
  `UpdateUserDto`)
- Response DTOs: PascalCase ending in `ResponseDto` (e.g. `UserResponseDto`)
- Domain entities: PascalCase, no suffix (e.g. `User`, `Video`)
- Custom errors: PascalCase ending in `Error` (e.g. `NotFoundError`)

## Frontend File Organization

- Components: `src/components/[feature]/ComponentName.tsx`
- Pages: `src/app/[route]/page.tsx`
- Server Actions: `src/actions/[feature].ts`
- Types: `src/types/[feature].ts`
- Lib/Utils: `src/lib/[utility].ts`

## Naming

- Components: PascalCase (`ItemCard.tsx`)
- Files: Match component name or kebab-case
- Functions: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Types/Interfaces: PascalCase (no prefix)

## Styling

- CSS Modules (`*.module.css`), matching the current scaffold - no Tailwind or
  component library installed
- No inline styles
- Follows system dark/light mode (see `globals.css` `prefers-color-scheme`)

## Database

> TODO: no ORM/driver chosen yet - build-plan item 2 defines the SQLite video
> model. Update this section once that's picked (e.g. `better-sqlite3`,
> Prisma, Drizzle).

- SQLite stores video metadata (per the build plan); Postgres migration is an
  explicit later item, not V1
- Schema changes go through whatever migration mechanism the chosen
  driver/ORM provides once selected

## Data Fetching

- No authentication in V1 (single local user, per the project plan) - do not
  add user-scoping logic until an auth system is actually introduced
- Server components fetch directly through the backend API
- Client components use Server Actions or call the backend API
- Validate all inputs with Zod

## Error Handling

- Use try/catch in Server Actions
- Return `{ success, data, error }` pattern from actions
- Display user-friendly error messages via toast

## Testing

The blueprint installs no test runner; testing is opt-in at the project level,
because the overlay can't know your stack. Adding unit testing is an explicit
setup task the AI can do through the normal workflow, either as a build-plan item
or with `/tests`. The setup should choose the stack-native runner, wire the
scripts or commands, add a small example test, and update the Commands section
of `AGENTS.md`.

When `AGENTS.md` declares a `Verify` command, treat it as the umbrella automated
gate. It combines only the checks this project actually has, in this order when
available: typecheck, tests, then build. The command does not enable an absent
test runner or replace focused evidence. It gives local work and optional CI one
exact command to run. `/ci` owns Verify and CI setup. `/tests` adds the real test
command to Verify when it already exists, but never creates CI only because
testing was configured.

**The opt-in switch is one signal: a `test` command in the Commands section of
`AGENTS.md`.** Declare one and **tests become a gate for logic-bearing steps**,
not an optional extra; leave it out and the loop verifies logic with the evidence
it already uses (run it, a screenshot, the build). Adding the runner is itself a
deliberate step, never a silent mid-step install. This is the single definition
of the switch; the skills and `ai-interaction.md` only point back here.

- **What to test (the scope rule):** pure logic where a wrong answer is possible -
  parsers, formatters, validators, id/slug builders, server actions. These have
  assertable inputs and outputs and real edge cases (empty, missing, malformed).
- **What not to test:** UI components and integration-level surfaces (render or
  export routes, anything driving a real browser or external service). Verify those
  with a screenshot and the build, not brittle unit tests.
- **The gate (when a runner is configured):** a build step that adds in-scope logic
  must ship a passing test in the same reviewable diff. The project's test command
  must be green before the step is approved, before any checkpoint commit, and
  before `/complete` merges. UI and integration-only steps are exempt and ride on
  screenshot plus build evidence.
- **When it's named:** the `/feature` spec's Testing section predicts the coverage,
  `/implement` writes the test with the step, and if a step surfaces logic the spec
  didn't foresee, add a focused test then.
- An empty suite should fail, not pass, so "no tests ran" never looks like "passed".
- Test files live next to source files (for example `feature.test.ts`).
- Run them via the project's test command (see Commands in `AGENTS.md`), not a
  hardcoded tool name.

Stack binding (swap for yours): a TypeScript app uses Vitest, `vi.mock()` for
external dependencies (Prisma, Clerk, etc.), and `vi.useFakeTimers()` for
time-dependent logic; a Python app would use pytest; a Go app `go test`.

## Browser Verification

For UI and integration behavior, prefer real browser evidence over reading the
code and assuming it works.

- Browser automation is separately opt-in through `/tests browser`. That setup
  reuses a compatible runner or prefers Playwright for supported projects, then
  documents the exact command as `Browser tests` in `AGENTS.md`.
- When `Browser tests` is declared, add focused coverage for stable behavioral
  done-whens when it is proportionate, and run the documented command during
  `/check`. Do not assume it proves visual fidelity, real authenticated-profile
  behavior, browser chrome, or another claim the test does not observe.
- If no Browser tests command is declared, do not add a runner silently in the
  middle of an unrelated feature. Use the available dev server, browser
  screenshots, build output, API output, or manual evidence instead.
- Browser tests are not part of the default Verify command or CI unless the user
  separately chooses that slower gate.
- Browser evidence is especially important for flows that click, type, submit,
  navigate, download files, render complex layouts, or depend on client-side
  state.

## Code Quality

- No commented-out code unless specified
- No unused imports or variables
- Keep functions under 50 lines when possible

## Comments

Write code that explains itself; comment only what the code cannot say.
Over-commenting is a common AI tell, so resist it.

- Comment the **why**, not the **what**. Delete any comment that restates the code.
- No banner/header blocks, section dividers, or step-by-step narration of obvious
  code. A file does not need a comment announcing each region.
- A comment earns its place only when it captures something the code can't: a
  non-obvious decision, a gotcha or workaround, why a value is what it is, or a
  link to a spec or issue.
- Prefer self-documenting names and small functions over explanatory comments.
- Keep doc comments minimal: a one-line purpose on an exported type or function is
  plenty; don't write JSDoc that just repeats the signature.
- When in doubt, leave the comment out.

## Writing

- No em dashes (U+2014) in generated content: docs, comments, commit messages,
  READMEs, specs. They read as AI-generated.
- Use a hyphen for `term - description` separators; rephrase prose with commas,
  parentheses, or a colon. Avoid en dashes and the ellipsis character too.
