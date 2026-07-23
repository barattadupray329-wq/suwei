-- Backfill legacy contracts to the owning administrator and enforce store-local assignees.
UPDATE rentals
SET assignedEmployeeId = userId
WHERE assignedEmployeeId IS NULL OR trim(assignedEmployeeId) = '';

CREATE TRIGGER IF NOT EXISTS rentals_assignee_guard_insert
BEFORE INSERT ON rentals
FOR EACH ROW
WHEN NEW.assignedEmployeeId IS NULL
  OR trim(NEW.assignedEmployeeId) = ''
  OR NOT (
    NEW.assignedEmployeeId = NEW.userId
    OR EXISTS (
      SELECT 1
      FROM organization_members AS member
      WHERE member.ownerId = NEW.userId
        AND member.memberUserId = NEW.assignedEmployeeId
        AND member.role = 'employee'
        AND member.active = 1
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'rental assignee must belong to the store');
END;

CREATE TRIGGER IF NOT EXISTS rentals_assignee_guard_update
BEFORE UPDATE OF userId, assignedEmployeeId ON rentals
FOR EACH ROW
WHEN NEW.assignedEmployeeId IS NULL
  OR trim(NEW.assignedEmployeeId) = ''
  OR NOT (
    NEW.assignedEmployeeId = NEW.userId
    OR EXISTS (
      SELECT 1
      FROM organization_members AS member
      WHERE member.ownerId = NEW.userId
        AND member.memberUserId = NEW.assignedEmployeeId
        AND member.role = 'employee'
        AND member.active = 1
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'rental assignee must belong to the store');
END;
