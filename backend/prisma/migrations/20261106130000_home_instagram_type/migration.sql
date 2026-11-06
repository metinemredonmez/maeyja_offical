-- "Follow on Instagram" becomes a homepage section type (its own migration: a new enum value can't be used in the
-- transaction that adds it).
ALTER TYPE "HomeSectionType" ADD VALUE IF NOT EXISTS 'INSTAGRAM';
