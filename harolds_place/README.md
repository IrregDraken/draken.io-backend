# THE HAROLD'S PLACE Ordering Platform

This directory contains the portable backend and dedicated Flutter staff-application source for the restaurant ordering product. It is deliberately isolated from the unrelated Draken Industries service at the repository root.

## What is implemented

The Flask API includes customer registration and sign-in, public restaurant/menu reads, server-calculated ordering, idempotent submissions, role-based staff routes, real order-state transitions, menu configuration, restaurant settings, payment initialization and verification seams, and validated Paystack webhook handling. The PostgreSQL schema is represented through SQLAlchemy models and an initial Alembic migration. The system starts empty by design: no menu, prices, customer details, hours, reviews, sales numbers, or payment result is fabricated.

## Local setup

Copy `backend/.env.example` to `backend/.env`, replace the JWT secret, and set only the values the restaurant has verified. For a Docker-capable machine, run `docker compose up --build` in this directory. Before exposing the API, run `cd backend && alembic upgrade head`, then run `python bootstrap_owner.py --email owner@example.com --display-name "Restaurant Owner"` to create the first owner and an intentionally closed/unconfigured restaurant record. Do not commit `.env` files.

## Tests

From `backend/`, install `requirements.txt` and run `pytest -q`. The checked-in tests cover authentication, the honest empty-menu state, server-side order-total calculation, idempotency, and an invalid delivery state transition. Docker, Flutter, and a PostgreSQL CLI were unavailable in the current build environment, so live container, migration, Android, and emulator results are not claimed.

## Production prerequisites

Before accepting real orders, the owner must confirm the customer contact number/address/hours, enter approved menu data, configure pickup/delivery policies, review privacy/terms text, select hosting, configure HTTPS and CORS, configure storage, set production rate-limit storage rather than the local `memory://` default, and provide an approved payment account only if online payment is desired. See `docs/architecture.md` and `docs/implementation-notes.md` for the full design and research constraints.
