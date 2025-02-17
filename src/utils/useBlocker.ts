/**
 * React-router v6 lost a very interesting feature, which can block transitions from happening, for instance when a form
 * is not confirmed. A ticket is opened to restore this feature (https://github.com/remix-run/react-router/issues/8139)
 * and @rmorse wrote a fallback Gist here: https://gist.github.com/rmorse/426ffcc579922a82749934826fa9f743
 * This file is that fallback, but properly typed for TypeScript:
 */
import type { History, Transition } from "history";
import { useContext, useEffect } from "react";
import { UNSAFE_NavigationContext as NavigationContext } from "react-router-dom";

export declare type Navigator = Pick<History, "block" | "go" | "push" | "replace" | "createHref">;

export function useBlocker(blocker: (tx: Transition) => void, when = true) {
  const navigator = useContext(NavigationContext).navigator as Navigator;

  useEffect(() => {
    if (!when) return;

    const unblock = navigator.block((tx) => {
      const autoUnblockingTx = {
        ...tx,
        retry() {
          unblock();
          tx.retry();
        },
      };

      blocker(autoUnblockingTx);
    });

    return unblock;
  }, [navigator, blocker, when]);
}
