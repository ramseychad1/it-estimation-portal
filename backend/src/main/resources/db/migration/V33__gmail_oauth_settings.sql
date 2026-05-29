INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES
    ('email_gmail_client_id',      '', NOW(), NULL),
    ('email_gmail_client_secret',  '', NOW(), NULL),
    ('email_gmail_refresh_token',  '', NOW(), NULL),
    ('email_gmail_connected_email','', NOW(), NULL)
ON CONFLICT (key) DO NOTHING;
