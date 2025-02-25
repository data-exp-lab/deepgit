import { atom, useAtom } from "jotai";
import { useCallback } from "react";

export interface NotificationInput {
  message: string | JSX.Element;
  type?: "success" | "info" | "warning" | "error";

  // Options:
  keepAlive?: boolean;
}

interface NotificationTechnical extends NotificationInput {
  id: string;
  createdAt: number;
}

const notificationsAtom = atom<NotificationTechnical[]>([]);

let INCREMENTAL_ID = 1;

export function useNotifications() {
  const [notifications, setNotifications] = useAtom(notificationsAtom);

  const notify = useCallback(
    (notification: NotificationInput) => {
      const id = ++INCREMENTAL_ID + "";
      const fullNotification = {
        ...notification,
        createdAt: Date.now(),
        id,
      };
      setNotifications((notifications) => notifications.concat([fullNotification]));

      return id;
    },
    [setNotifications],
  );

  const remove = useCallback(
    (id: string) => {
      setNotifications((notifications) => notifications.filter((notification) => notification.id !== id));
    },
    [setNotifications],
  );

  return { notifications, notify, remove };
}
