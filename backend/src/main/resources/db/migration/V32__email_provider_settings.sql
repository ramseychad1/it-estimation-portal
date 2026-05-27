INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES
    ('email_provider',       'smtp', NOW(), NULL),
    ('email_resend_api_key', '',     NOW(), NULL)
ON CONFLICT (key) DO NOTHING;
