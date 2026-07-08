/**
 * Human-readable labels for ChangeAction values rendered in activity
 * timelines (requester detail + review screen). UX-4 consolidation: both
 * pages carried partial copies of this switch, so newer item-level actions
 * (ITEM_REVIEW_STARTED, ITEM_APPROVED, …) fell through and rendered as raw
 * enum names. Keep in sync with backend ChangeAction — unmapped values
 * degrade to a title-cased version of the enum rather than the raw name.
 */
export function actionLabel(action: string): string {
  switch (action) {
    case "CREATED":         return "Created";
    case "UPDATED":         return "Updated";
    case "DELETED":         return "Discarded";
    case "SUBMITTED":       return "Submitted";
    case "REVIEW_STARTED":  return "Review started";
    case "REVIEW_RELEASED": return "Review released";
    case "APPROVED":        return "Approved";
    case "REJECTED":        return "Rejected";
    case "SENT_BACK":       return "Sent back";
    case "ITEM_REVIEW_STARTED":    return "Item review started";
    case "ITEM_REVIEW_RELEASED":   return "Item review released";
    case "ITEM_REVIEW_TAKEN_OVER": return "Review taken over";
    case "ITEM_APPROVED":          return "Item approved";
    case "ITEM_REJECTED":          return "Item rejected";
    case "ITEM_REVISED":           return "Item revised";
    case "ITEM_RESUBMITTED":       return "Item resubmitted";
    case "ITEM_DROPPED":           return "Item removed";
    case "ITEM_SENT_BACK":         return "Item sent back";
    case "ITEM_CLARIFICATION_REQUESTED": return "Clarification requested";
    case "ITEM_CLARIFICATION_ANSWERED":  return "Clarification answered";
    case "ITEM_RECALLED":                return "Item recalled";
    case "PRICING_REVIEW_STARTED":   return "Pricing review started";
    case "PRICING_REVIEW_RELEASED":  return "Pricing review released";
    case "PRICING_REVIEW_APPROVED":  return "Pricing approved";
    case "PRICING_REVIEW_REQUESTED": return "Pricing review requested";
    case "SETTING_UPDATED":          return "Setting updated";
    default:
      // Never surface a raw enum: ITEM_FOO_BAR -> "Item foo bar".
      return action
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/^./, (c) => c.toUpperCase());
  }
}
