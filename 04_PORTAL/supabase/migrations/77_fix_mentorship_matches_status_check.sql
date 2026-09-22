-- Migration 77: Fix mentorship_matches status check constraint
-- -------------------------------------------------------------
-- PENDING (オファー申請中) と REJECTED (オファー辞退) を status の許容値に追加する

ALTER TABLE mentorship_matches DROP CONSTRAINT IF EXISTS mentorship_matches_status_check;
ALTER TABLE mentorship_matches ADD CONSTRAINT mentorship_matches_status_check 
    CHECK (status IN ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'REJECTED'));
