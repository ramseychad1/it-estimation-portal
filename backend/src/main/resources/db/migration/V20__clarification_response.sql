-- V20: Add clarification_response column to estimate_request_items.
-- Counterpart to clarification_note (SO → requester).  When a requester
-- responds to a clarification request the requester's free-form reply is
-- stored here so the reviewer can see it when the item re-enters IN_REVIEW.
-- Cleared when the SO raises a new clarification request.

ALTER TABLE estimate_request_items
    ADD COLUMN clarification_response TEXT;
