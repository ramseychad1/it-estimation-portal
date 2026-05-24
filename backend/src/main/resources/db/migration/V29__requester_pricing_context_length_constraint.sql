ALTER TABLE estimate_requests
    ADD CONSTRAINT chk_requester_pricing_context_length
    CHECK (char_length(requester_pricing_context) <= 4000);
