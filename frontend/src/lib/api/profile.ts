import { api } from "../api";

export interface NotificationPrefItem {
  type: string;
  label: string;
  description: string;
  roleNote: string;
  enabled: boolean;
}

export interface NotificationPrefsResponse {
  globalEmailEnabled: boolean;
  masterEnabled: boolean;
  preferences: NotificationPrefItem[];
}

export interface UpdateNotificationPrefsRequest {
  masterEnabled: boolean;
  preferences: Record<string, boolean>;
}

export function getNotificationPrefs(): Promise<NotificationPrefsResponse> {
  return api("/profile/notifications");
}

export function updateNotificationPrefs(
  body: UpdateNotificationPrefsRequest
): Promise<NotificationPrefsResponse> {
  return api("/profile/notifications", { method: "PUT", body });
}
