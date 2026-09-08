/** Product audit history is append-only even when a caller bypasses application helpers. */
export const productEventIntegritySchema = `
CREATE OR REPLACE FUNCTION reject_product_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Product audit events are append-only';
END;
$$ LANGUAGE plpgsql;
DO $$
DECLARE event_table TEXT;
BEGIN
  FOREACH event_table IN ARRAY ARRAY['product_workspace_events','product_organization_events','product_billing_events'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS product_event_immutable ON %I', event_table);
    EXECUTE format('CREATE TRIGGER product_event_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_product_event_mutation()', event_table);
    EXECUTE format('DROP TRIGGER IF EXISTS product_event_no_truncate ON %I', event_table);
    EXECUTE format('CREATE TRIGGER product_event_no_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION reject_product_event_mutation()', event_table);
  END LOOP;
END;
$$;
`;
