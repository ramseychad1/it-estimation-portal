-- V28 — Requester-initiated pricing review context
--
-- Allows a requester to send a fully-approved estimate back to the pricing
-- review queue and supply free-form context for the Revenue Manager.

ALTER TABLE estimate_requests
    ADD COLUMN requester_pricing_context TEXT;
