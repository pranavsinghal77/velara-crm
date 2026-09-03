# Migrations

`20260101000000_init` is the initial schema. It creates every table from scratch,
so it will fail on a database that still holds the pre-1.0 tables (`User`, `Lead`,
`Message`, ... without `orgId`, with string dates and a plaintext `password`
column).

## Fresh database

```bash
npm run db:deploy
npm run db:seed
```

## Existing pre-1.0 database

The old schema has no migration history and is not upgradeable in place: the
`password` column has to become `passwordHash`, string dates become `DateTime`, and
every row needs an `orgId`. If the data is demo data, reset:

```bash
# DESTRUCTIVE: drops every table in the database, then replays migrations.
npx prisma migrate reset
npm run db:seed
```

If the data matters, point `DATABASE_URL` at an empty database, run `db:deploy`
there, and write a one-off script to copy rows across — assigning each an `orgId`
and re-hashing passwords (the old ones were stored in plaintext and should be
treated as compromised, i.e. force a reset for every user).
