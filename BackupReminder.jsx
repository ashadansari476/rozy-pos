import { useEffect } from "react";
import { showToast } from "./Toast";
import { shouldRemindBackup, getLastBackupDate } from "../../lib/backup";
import { canAccessSettings } from "../../lib/permissions";
import { useApp } from "../../stores/appStore";

export default function BackupReminder() {
  const user = useApp((s) => s.user);

  useEffect(() => {
    if (!user || !canAccessSettings(user)) return;

    const timer = setTimeout(() => {
      if (shouldRemindBackup()) {
        const last = getLastBackupDate();
        const msg = last
          ? "It has been over a week since your last backup. Go to Settings to create one."
          : "You have not backed up yet. Go to Settings to save your data.";
        showToast("\uD83D\uDCBE " + msg, "warning", 8000);
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [user]);

  return null;
}
