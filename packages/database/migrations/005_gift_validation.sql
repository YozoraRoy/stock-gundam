ALTER TABLE shareholder_gifts ADD twse_meeting_date NVARCHAR(50);
ALTER TABLE shareholder_gifts ADD validation_status NVARCHAR(40);
ALTER TABLE shareholder_gifts ADD validation_reason NVARCHAR(500);