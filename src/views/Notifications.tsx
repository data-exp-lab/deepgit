import cx from "classnames";
import { FC, useCallback, useState } from "react";
import { CSSTransition } from "react-transition-group";

import { NotificationInput, useNotifications } from "../lib/notifications";
import { useTimeout } from "../utils/useTimeout";

const CLASSES_TOAST = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  error: "text-white bg-danger",
};

const CLASSES_TOAST_CLOSE: Record<string, string> = {
  error: "btn-close-white",
};

const CLASSES_ALERT = {
  success: "alert-success",
  info: "alert-info",
  warning: "alert-warning",
  error: "alert-danger",
};

const Notifications: FC = () => {
  const { notifications, remove } = useNotifications();

  return (
    <div id="toasts-container">
      {notifications.map((notification) => (
        <Notification
          key={notification.id}
          type="toast"
          notification={notification}
          onClose={() => remove(notification.id)}
        />
      ))}
    </div>
  );
};

export const Notification: FC<{
  notification: NotificationInput;
  onClose?: () => void;
  type?: "toast" | "text";
}> = ({ notification, onClose, type }) => {
  const [show, setShow] = useState<boolean>(true);

  const setShowFalse = useCallback(() => setShow(false), [setShow]);
  const { cancel, reschedule } = useTimeout(
    setShowFalse,
    notification.keepAlive ? -1 : notification.type !== "success" ? 10000 : 5000,
  );

  if (type === "toast") {
    const notifType = notification.type || "info";
    return (
      <CSSTransition
        className={cx("toast align-items-center border-0 show mb-2 me-2", CLASSES_TOAST[notifType])}
        classNames="fade"
        onMouseEnter={cancel}
        onMouseLeave={reschedule}
        in={show}
        timeout={300}
        onExited={() => {
          if (onClose) onClose();
        }}
      >
        <div role="alert" aria-live="assertive" aria-atomic="true">
          <div className="d-flex">
            <div className="toast-body">{notification.message}</div>
            {onClose && (
              <button
                type="button"
                className={cx("btn-close me-2 m-auto", CLASSES_TOAST_CLOSE[notifType])}
                onClick={onClose}
              />
            )}
          </div>
        </div>
      </CSSTransition>
    );
  }

  return (
    <div
      className={cx("alert", CLASSES_ALERT[notification.type || "info"], onClose ? "alert-dismissible" : "")}
      role="alert"
    >
      {notification.message}
      {onClose && <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />}
    </div>
  );
};

export default Notifications;
