import cx from "classnames";
import { FC } from "react";
import { createPortal } from "react-dom";

import { AppContext } from "../lib/context";

interface Props {
  title?: string | JSX.Element;
  onClose?: () => void;
  showHeader?: boolean;
  footerAlignLeft?: boolean;
  className?: string;
  bodyClassName?: string;
  children: JSX.Element | [JSX.Element] | [JSX.Element, JSX.Element];
}

const UnmountedModal: FC<Props> = ({
  onClose,
  title,
  children,
  showHeader = true,
  footerAlignLeft = false,
  className,
  bodyClassName,
}) => {
  const childrenArray = Array.isArray(children) ? children : [children];
  const body = childrenArray[0];
  const footer = childrenArray[1];

  return (
    <div role="dialog" className="modal">
      <div className="modal-backdrop" onClick={() => onClose && onClose()} />
      <div
        role="document"
        className={cx("", "modal-dialog", "modal-dialog-centered", "modal-dialog-scrollable", className)}
      >
        <div className="modal-content">
          {showHeader && (
            <div className="modal-header border-bottom-0">
              {title && (
                <h5 className="modal-title">
                  <span>{title}</span>
                </h5>
              )}
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={() => onClose && onClose()}
                disabled={!onClose}
              >
                <i className="fas fa-times" />
              </button>
            </div>
          )}
          {body && (
            <div id="modal-body" className={cx("modal-body", bodyClassName)}>
              {body}
            </div>
          )}
          {footer && (
            <div
              className="modal-footer border-top-0"
              style={{ justifyContent: footerAlignLeft ? "left" : "flex-end" }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Modal: FC<Props> = ({ children, ...props }) => (
  <AppContext.Consumer>
    {(context) => createPortal(<UnmountedModal {...props}>{children}</UnmountedModal>, context.portalTarget)}
  </AppContext.Consumer>
);

export default Modal;
