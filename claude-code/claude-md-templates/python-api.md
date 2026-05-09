# CLAUDE.md

This is a Python API service. Production code, not a notebook.

## Project

A FastAPI service exposing a JSON API. Backed by Postgres. Async everywhere it pays off.

## Stack

- Python 3.12
- FastAPI
- Pydantic v2 for validation
- SQLAlchemy 2.0 async with asyncpg
- Alembic for migrations
- pytest plus httpx for tests
- ruff for linting and formatting
- mypy strict for typechecking
- uv for dependency management
- Docker for local Postgres

## Directory layout

```
src/
  app/                  FastAPI app entry point
    main.py             create_app and the ASGI app
  api/                  HTTP layer
    v1/                 versioned routes
  domain/               Business logic, no FastAPI imports allowed
    models/             Pydantic models for API surface
    services/           Use cases and business rules
  db/                   Database layer
    engine.py           async engine and session factory
    models/             SQLAlchemy ORM models
    repos/              Repository pattern, one file per aggregate
  config.py             Pydantic Settings, reads env
  logging.py            Structured logging setup
tests/
  unit/                 No DB, no network
  integration/          Real test DB, no external network
  e2e/                  Full app via httpx
alembic/
  versions/             Migration files
```

## Layering rules

The dependencies flow inward. Never import outward.

```
api/  ────►  domain/  ────►  db/
```

The `api/` layer talks HTTP. The `domain/` layer is pure Python with no FastAPI or SQLAlchemy imports. The `db/` layer talks to Postgres. If you ever feel the urge to import FastAPI in `domain/`, the design is wrong, not the rule.

## Commands

```bash
uv sync                      # install deps
uv run ruff format           # format
uv run ruff check            # lint
uv run mypy src              # typecheck
uv run pytest                # run all tests
uv run pytest tests/unit     # run unit tests only
uv run alembic upgrade head  # apply migrations
uv run uvicorn app.main:app --reload    # local dev
docker compose up postgres   # local DB
```

## Conventions

- Every endpoint has a request model and a response model. Never return raw dicts.
- Repositories return domain models, not ORM models.
- Services accept a session as a parameter. They do not create their own.
- All endpoint handlers are async. All repository methods are async.
- Background work goes in a separate worker, not in request handlers.
- Use `from __future__ import annotations` at the top of every module.
- Type hints on every public function. Strict mypy will fail otherwise.

## Definition of done

A change is done when:
- `uv run ruff check` passes
- `uv run mypy src` passes
- `uv run pytest` passes
- Any new endpoint has at least one e2e test
- Any new model has at least one validation test
- The OpenAPI spec at `/docs` reflects the new surface

## Things to never do without asking

- Add a new third-party service dependency
- Change the database schema (write a migration in a separate PR)
- Add a global mutable state
- Use `Any` to escape mypy
- Catch broad exceptions silently
- Block the event loop with sync code

## Things to default to

- Pydantic models for everything that crosses a boundary
- Async functions and async tests
- Dependency injection via FastAPI `Depends`
- Structured logs (key-value pairs), never f-strings into a logger

## Error handling

- Domain errors are raised as typed exceptions defined in `domain/errors.py`
- The API layer maps them to HTTP responses in a single exception handler
- Never let a 500 escape with a stack trace in production

## Configuration

All config goes through `app.config.Settings`. No `os.environ` reads outside that file.

## Voice

- Commit messages: `type(scope): summary`, where type is feat, fix, refactor, test, docs, chore
- PR descriptions explain what changed and why, never just what files moved
