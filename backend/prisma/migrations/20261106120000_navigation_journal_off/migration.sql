-- The shop owner asked for "Journal" to leave the header. A saved header keeps the item, switched off (one switch in
-- Admin → Üst menü ve alt bilgi brings it back); without a saved header the new defaults already have it off.
UPDATE "Setting"
SET "value" = jsonb_set(
  "value",
  '{header,items}',
  (
    SELECT COALESCE(jsonb_agg(CASE WHEN item->>'id' = 'journal' THEN jsonb_set(item, '{visible}', 'false'::jsonb) ELSE item END ORDER BY ord), '[]'::jsonb)
    FROM jsonb_array_elements("value"->'header'->'items') WITH ORDINALITY AS t(item, ord)
  )
)
WHERE "key" = 'navigation' AND jsonb_typeof("value"->'header'->'items') = 'array';
