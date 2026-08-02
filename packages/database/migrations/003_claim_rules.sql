ALTER TABLE shareholder_gifts ADD gift_status NVARCHAR(50);
ALTER TABLE shareholder_gifts ADD claim_rule NVARCHAR(50);
ALTER TABLE shareholder_gifts ADD claim_rule_source NVARCHAR(50);
ALTER TABLE shareholder_gifts ADD mops_gift_text NVARCHAR(4000);
ALTER TABLE shareholder_gifts ADD mops_meeting_date NVARCHAR(50);
ALTER TABLE shareholder_gifts ADD mops_source_url NVARCHAR(1000);
ALTER TABLE shareholder_gifts ADD mops_updated_at NVARCHAR(50);
