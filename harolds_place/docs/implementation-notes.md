# THE HAROLD'S PLACE Ordering Platform — Implementation Notes

## Current environment constraints

Flutter, Docker, and the PostgreSQL command-line client are not installed in the current build environment. The repository will contain Flutter and Docker-compatible source, tests, and setup instructions, but Android builds, container startup, database migrations against a live PostgreSQL service, and mobile emulator checks cannot be claimed as executed here.

## Practical build sequence

The customer website is implemented as a mobile-first React application with a strict API seam and client-side development state only. The portable product workspace contains the Flask application, SQLAlchemy models and migrations, test suite, Docker Compose file, and Flutter staff source. When the tools and credentials are available, a future operator should set the environment variables, start PostgreSQL, apply Alembic migrations, run backend tests, run Flutter tests, create a real staff user, configure the menu, and execute the recorded end-to-end acceptance flow.

## Product integrity rules

The implementation does not seed fake customers, menu items, food photography, reviews, ratings, sales figures, payment success, opening hours, delivery fee, or production credentials. Every production-dependent capability is either implemented with real configuration requirements or visibly marked unavailable until configured.
