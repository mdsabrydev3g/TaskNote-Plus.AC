ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
UPDATE "users"
SET "username" = lower(split_part("email", '@', 1))
WHERE "username" IS NULL AND "email" IS NOT NULL AND split_part("email", '@', 1) <> '';--> statement-breakpoint
UPDATE "users"
SET "username" = 'user-' || left("id"::text, 8)
WHERE "username" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uq" ON "users" USING btree ("username");
