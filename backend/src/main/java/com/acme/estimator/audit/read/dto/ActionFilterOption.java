package com.acme.estimator.audit.read.dto;

import com.acme.estimator.audit.ChangeAction;

public record ActionFilterOption(ChangeAction value, String label) {}
