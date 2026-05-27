-- Email notification settings seeded with sensible defaults.
-- email_smtp_password stores the Gmail App Password in plaintext (internal tool tradeoff).
-- email_from_address: leave blank to use smtp_username, or set a verified Gmail "Send mail as" alias.
INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES
    ('email_enabled',       'false',                NOW(), NULL),
    ('email_smtp_host',     'smtp.gmail.com',       NOW(), NULL),
    ('email_smtp_port',     '587',                  NOW(), NULL),
    ('email_smtp_username', '',                     NOW(), NULL),
    ('email_smtp_password', '',                     NOW(), NULL),
    ('email_from_name',     'IT Estimation Portal', NOW(), NULL),
    ('email_from_address',  '',                     NOW(), NULL)
ON CONFLICT (key) DO NOTHING;
