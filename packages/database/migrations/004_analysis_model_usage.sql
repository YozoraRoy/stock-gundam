ALTER TABLE analysis_records ADD model_usage NVARCHAR(4000);
ALTER TABLE analysis_records ADD primary_models NVARCHAR(500);
ALTER TABLE analysis_records ADD fallback_used NVARCHAR(10);
ALTER TABLE analysis_records ADD fallback_count INT;
