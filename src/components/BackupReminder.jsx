import { useEffect } from "react";
import { showToast } from "./Toast";
import { shouldRemindBackup, getLastBackupDate } from "../../lib/backup";
import { canAccessSettings } from "../../lib/permissions";
import { useApp } from "../../stores/appStore";

export default function BackupReminder() {
  const user = useApp((s) => s.user);

  useEffect(() => {
    if (!user || !canAccessSettings(user)) return;

    // Wait 10 seconds after app loads before checking
    const timer = setTimeout(() => {
      if (shouldRemindBackup()) {
        const last = getLastBackupDate();
        const msg = last
          ? `💾 It's been over a week since your last backup.\nGo to Settings → Backup to create one.`
          : `💾 You haven't backed up yet.\nGo to Settings → Backup to save your data.`;

        showToast(msg, "warning", 8000);
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [user]);

  return null;
}