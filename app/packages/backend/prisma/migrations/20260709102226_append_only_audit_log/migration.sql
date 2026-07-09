CREATE OR REPLACE FUNCTION block_audit_log_modification()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only. UPDATE and DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_append_only_audit_log
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION block_audit_log_modification();