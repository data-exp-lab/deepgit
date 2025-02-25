import PublishModal from "./PublishModal";
import ShareModal from "./ShareModal";

export const MODALS = {
  publish: PublishModal,
  share: ShareModal,
} as const;

export type ModalName = keyof typeof MODALS;
