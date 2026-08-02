ALTER TABLE shareholder_gifts ADD COLUMN gift_status NVARCHAR(50);
ALTER TABLE shareholder_gifts ADD COLUMN claim_rule NVARCHAR(50);
ALTER TABLE shareholder_gifts ADD COLUMN claim_rule_source NVARCHAR(50);
ALTER TABLE shareholder_gifts ADD COLUMN mops_gift_text NVARCHAR(4000);
ALTER TABLE shareholder_gifts ADD COLUMN mops_meeting_date NVARCHAR(50);
ALTER TABLE shareholder_gifts ADD COLUMN mops_source_url NVARCHAR(1000);
ALTER TABLE shareholder_gifts ADD COLUMN mops_updated_at NVARCHAR(50);
