-- The collage that was fixed at the bottom of the homepage, now a section of its own (Admin → Ana sayfa): last, as
-- before, showing the shop's Instagram posts. Skipped when one exists.
INSERT INTO "HomeSection" ("id", "type", "payload", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT 'home-instagram', 'INSTAGRAM', '{"feed": true}'::jsonb, (SELECT COALESCE(MAX("sortOrder"), 0) + 1 FROM "HomeSection"), true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "HomeSection" WHERE "type" = 'INSTAGRAM');
