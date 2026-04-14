-- Make audit log append-only and system-origin only.

CREATE OR REPLACE FUNCTION public.auditlog_guard_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.details->>'_source', '') <> 'system-audit' THEN
    RAISE EXCEPTION 'Manual audit inserts are not allowed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditlog_guard_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'AuditLog is immutable: updates are not allowed';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'AuditLog is immutable: deletes are not allowed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "AuditLog_block_manual_insert" ON "AuditLog";
CREATE TRIGGER "AuditLog_block_manual_insert"
BEFORE INSERT ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION public.auditlog_guard_insert();

DROP TRIGGER IF EXISTS "AuditLog_block_mutation" ON "AuditLog";
CREATE TRIGGER "AuditLog_block_mutation"
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION public.auditlog_guard_immutable();
