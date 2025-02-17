import React, { ChangeEvent, FC, useContext, useMemo, useRef, useState } from "react";
import { BsShare } from "react-icons/bs";
import { FiCopy } from "react-icons/fi";

import Modal from "../../components/Modal";
import { GraphContext } from "../../lib/context";
import { Data } from "../../lib/data";
import { cleanNavState, navStateToQueryURL } from "../../lib/navState";
import { useNotifications } from "../../lib/notifications";

const ShareModal: FC<{ close: () => void }> = ({ close }) => {
  const { notify } = useNotifications();
  const { data, navState } = useContext(GraphContext);

  const [shareMode, setShareMode] = useState<"x" | "v">("x");
  const [isEmbed, setIsEmbed] = useState(false);
  const onEmbedChange = (e: ChangeEvent<HTMLInputElement>) => setIsEmbed(e.target.value === "embed");
  const codeOrURLLabel = isEmbed ? "code" : "URL";

  const { origin, pathname } = window.location;
  const shareURL = useMemo(() => {
    return (
      origin +
      pathname +
      `#/${isEmbed ? "embed" : "graph"}/?` +
      navStateToQueryURL(cleanNavState({ ...navState, role: shareMode }, data as Data))
    );
  }, [data, isEmbed, navState, origin, pathname, shareMode]);

  const domCode = useRef<HTMLElement>(null);
  const copyCodeOrURL = () => {
    if (isEmbed && !domCode.current) {
      notify({
        type: "error",
        message: `An error occurred while trying to copy the ${codeOrURLLabel}.`,
      });
    }

    const codeOrURL = isEmbed ? domCode.current!.innerText : shareURL;

    navigator.clipboard
      .writeText(codeOrURL)
      .then(() =>
        notify({
          type: "success",
          message: `The ${codeOrURLLabel} is copied to your clipboard.`,
        }),
      )
      .catch(() =>
        notify({
          type: "error",
          message: `An error occurred while trying to copy the ${codeOrURLLabel}.`,
        }),
      );
  };

  return (
    <Modal
      className="modal-lg"
      title={
        <>
          <BsShare /> Share this graph
        </>
      }
      onClose={close}
    >
      <>
        <div className="mb-3">
          <label className="form-label">
            <h3 className="form-label fs-6">I want to share this graph...</h3>
          </label>
          <div>
            <div className="form-check form-check-inline">
              <input
                className="form-check-input"
                type="radio"
                name="embed-radio-choices"
                id="embed-radio-choice-url"
                value="url"
                checked={!isEmbed}
                onChange={onEmbedChange}
              />
              <label className="form-check-label" htmlFor="embed-radio-choice-url">
                ...by sharing a simple URL
              </label>
            </div>
            <div className="form-check form-check-inline">
              <input
                className="form-check-input"
                type="radio"
                name="embed-radio-choices"
                id="embed-radio-choice-embed"
                value="embed"
                checked={isEmbed}
                onChange={onEmbedChange}
              />
              <label className="form-check-label" htmlFor="embed-radio-choice-embed">
                ...by embedding it inside a webpage
              </label>
            </div>
          </div>
        </div>

        <hr />

        <div className="form-check mb-3">
          <input
            className="form-check-input"
            type="checkbox"
            checked={shareMode === "x"}
            id="share-user-mode-select"
            onChange={(e) => setShareMode(e.target.checked ? "x" : "v")}
          />
          <label className="form-check-label" htmlFor="share-user-mode-select">
            <h3 className="form-label fs-6">I want users to be able to filter and change colors and sizes</h3>
          </label>
        </div>

        <hr />

        <p>
          {isEmbed ? (
            <>You can embed this graph in your website using this code:</>
          ) : (
            <>You can use this URL to share the graph with other users:</>
          )}
        </p>
        {isEmbed ? (
          <pre className="border p-2 rounded custom-scrollbar" contentEditable>
            <code className="p-2" ref={domCode}>{`<iframe
  width="800"
  height="600"
  src="${shareURL}"
  frameBorder="0"
  title="Retina"
  allowFullScreen
></iframe>`}</code>
          </pre>
        ) : (
          <div className="d-flex flex-row align-items-center">
            <button className="btn btn-outline-dark flex-shrink-0 me-2" onClick={copyCodeOrURL}>
              <FiCopy /> Copy {codeOrURLLabel}
            </button>
            <a href={shareURL} className="text-ellipsis flex-grow-1 flex-shrink-1" target="_blank" rel="noreferrer">
              {shareURL}
            </a>
          </div>
        )}
      </>
      <div className="text-end flex-shrink-0">
        {isEmbed && (
          <button className="btn btn-outline-dark mt-1" onClick={copyCodeOrURL}>
            <FiCopy /> Copy {codeOrURLLabel}
          </button>
        )}
        <button type="button" className="btn btn-dark mt-1 ms-2" onClick={close}>
          Close
        </button>
      </div>
    </Modal>
  );
};

export default ShareModal;
