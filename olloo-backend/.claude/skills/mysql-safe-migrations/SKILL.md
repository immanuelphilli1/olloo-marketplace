---
name: mysql-safe-migrations
description: Write and verify Laravel alter migrations that must run on production MySQL when tests use sqlite. Use when a migration drops/replaces indexes or foreign keys, changes columns, backfills data, or when deploy migrate fails with error 1553 "needed in a foreign key constraint" or a half-applied migration.
---

# MySQL-safe migrations

## Goal

Alter migrations that pass `php artisan test` (sqlite `:memory:`) can still fail on production MySQL, and MySQL DDL is not transactional, so a failure leaves the schema half-changed with the migration unrecorded. Verify on a throwaway MySQL database before shipping.

## Steps

1. Write each `up()` step so it checks its own state and can be re-run: `Schema::hasColumn`, `Schema::hasTable`, `Schema::hasIndex($table, [$cols], 'unique')` or `Schema::hasIndex($table, 'index_name')`.
2. When replacing an index that a foreign key may use, **add the new index first, then drop the old one**. The new index must start with the FK column.
3. In `down()`, if MySQL may have dropped a FK's own index (see Gotchas), recreate a plain index (guarded by name) before dropping the replacing unique.
4. Backfills: use `DB::table()` (not models, which follow the new schema), and throw a `RuntimeException` naming the bad rows when data cannot be mapped. Never invent defaults for domain-critical fields.
5. Round-trip on scratch MySQL (credentials from `.env`; the user can create databases):
   ```bash
   php -r 'require "vendor/autoload.php"; $app=require "bootstrap/app.php"; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); DB::statement("create database if not exists handco_migcheck_tmp");'
   export DB_DATABASE=handco_migcheck_tmp
   php artisan migrate:fresh --seed --force
   php artisan migrate:rollback --step=N --force   # tests down()
   php artisan tinker --execute="require 'legacy.php';"  # insert old-shape rows via DB::table
   php artisan migrate --force                      # tests up() + backfills
   php artisan migrate:rollback --step=N --force && php artisan migrate --force   # second cycle
   ```
   Then drop the database. Never point this at the real dev database.
6. Run `php artisan test` (sqlite) as well.

## Gotchas

- Error 1553 `Cannot drop index ...: needed in a foreign key constraint`: a composite unique like `(cart_id, product_id, product_variant_id)` is the index MySQL uses for the `cart_id` FK. Dropping it first fails.
- When you add an index that covers a FK column (for example `unique('order_item_id')`), MySQL silently drops the FK's auto-created index. A later `down()` that drops the unique then fails with 1553 unless it re-adds a plain index first.
- `down()` steps that add indexes must be guarded by index name, or the second rollback cycle fails with a duplicate key name.
- `->change()` restates the whole column: omitting `->default()` removes an existing default. Restore defaults explicitly in `down()`.
- sqlite tests never see any of the above.

## What didn't work

- Relying on sqlite tests: every MySQL failure above passed on sqlite.
- An early `return` when a migration looks "already applied": a half-applied run then skips its remaining steps. Guard each step instead.
