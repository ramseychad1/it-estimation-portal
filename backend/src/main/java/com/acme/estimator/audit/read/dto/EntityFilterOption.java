package com.acme.estimator.audit.read.dto;

/**
 * A single entity-type option in the filter dropdown. {@code label} is a
 * human-readable rendering ("SDLC Phase" instead of "SdlcPhase"); the
 * frontend never has to know how to prettify the raw token.
 */
public record EntityFilterOption(String value, String label) {}
