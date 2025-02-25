import { noop } from "lodash";
import React, { FC, useContext, useState } from "react";
import { AiOutlineCheckCircle, AiOutlineCloudUpload } from "react-icons/ai";
import { FiCopy } from "react-icons/fi";

import Modal from "../../components/Modal";
import { GraphContext } from "../../lib/context";
import { useNotifications } from "../../lib/notifications";

const PublishModal: FC<{ close: () => void }> = ({ close }) => {
  const { notify } = useNotifications();
  const { graphFile, navState, setNavState } = useContext(GraphContext);
  const [url, setUrl] = useState<string>("");
  const [state, setState] = useState<{ type: "idle"; errorMessage?: string } | { type: "loading" }>({
    type: "idle",
  });

  const handleSubmit = async () => {
    if (state.type !== "idle") return;

    setState({ type: "loading" });
    fetch(url)
      .then((response) => response.text())
      .then((textData) => {
        if (textData === graphFile.textContent) {
          // First, update navState so that blocker is skipped next update:
          setNavState({
            ...navState,
            preventBlocker: true,
          });

          // Then, actually update the navState:
          setNavState({
            ...navState,
            url,
            local: undefined,
          });
          notify({
            type: "success",
            message: "Congrats, you can now share your graph online!",
          });
          close();
        } else {
          setState({
            type: "idle",
            errorMessage: "The file at the given URL does not match the one you are using now.",
          });
        }
      })
      .catch(() => {
        setState({
          type: "idle",
          errorMessage: "The file at the given URL could not be properly loaded.",
        });
      });
  };

  return (
    <Modal
      className="modal-lg"
      title={
        <>
          <AiOutlineCloudUpload /> Publish your graph online
        </>
      }
      onClose={state.type !== "loading" ? close : noop}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <p>
          To be able to <strong>share</strong> your visualizations online, Retina needs to be able to access your graph
          file <strong>online</strong>, through HTTP. You can publish it on a server or your own, a cloud provider...
        </p>

        <p>
          Here is how to upload it on{" "}
          <a href="https://gist.github.com/" target="_blank" rel="noreferrer">
            GitHub Gist
          </a>
          , a site where you can freely upload your graph for Retina:
        </p>

        <ol>
          <li>
            Go to{" "}
            <a href="https://gist.github.com/" target="_blank" rel="noreferrer">
              gist.github.com
            </a>
            , create an account (if not done already) and log in
          </li>
          <li>
            <span className="d-flex flex-row align-items-baseline">
              Click{" "}
              <button
                type="button"
                className="btn btn-outline-dark btn-sm btn-inline mx-1"
                onClick={() => {
                  navigator.clipboard
                    .writeText(graphFile.textContent)
                    .then(() =>
                      notify({
                        type: "success",
                        message: "The graph file content is copied to your clipboard.",
                      }),
                    )
                    .catch(() =>
                      notify({
                        type: "error",
                        message: "An error occurred while trying to copy the graph file content.",
                      }),
                    );
                }}
              >
                <small>
                  <FiCopy />
                </small>{" "}
                here
              </button>{" "}
              to copy your graph file content
            </span>
          </li>
          <li>
            Create{" "}
            <a href="https://gist.github.com/" target="_blank" rel="noreferrer">
              a new gist
            </a>
          </li>
          <li>Paste your file content in the main input (the big white rectangle)</li>
          <li>
            <span className="d-flex flex-row align-items-baseline">
              Click{" "}
              <button
                type="button"
                className="btn btn-outline-dark btn-sm btn-inline mx-1"
                onClick={() => {
                  navigator.clipboard
                    .writeText(graphFile.name)
                    .then(() =>
                      notify({
                        type: "success",
                        message: "The graph file name is copied to your clipboard.",
                      }),
                    )
                    .catch(() =>
                      notify({
                        type: "error",
                        message: "An error occurred while trying to copy the graph file name.",
                      }),
                    );
                }}
              >
                <small>
                  <FiCopy />
                </small>{" "}
                here
              </button>{" "}
              to copy your graph file name
            </span>
          </li>
          <li>
            Paste your file name in the <strong>Filename including extension…</strong> input
          </li>
          <li>
            Click on <strong>Create secret gist</strong>
          </li>
          <li>
            Click on the <strong>Raw</strong> button (on the top right of the graph file content)
          </li>
        </ol>
        <p>
          At this point, you should have a webpage with only the graph content visible. That means your graph has
          properly been uploaded!
        </p>
        <p>
          <label htmlFor="newly-uploaded-file-url">
            Paste bellow the URL of your graph file online to check that it has properly been uploaded:
          </label>
        </p>
        <div>
          <input
            id="newly-uploaded-file-url"
            type="text"
            className="form-control"
            placeholder="http://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        {state.type === "idle" && !!state.errorMessage && <div className="text-danger mt-3">{state.errorMessage}</div>}
        <div className="text-end flex-shrink-0 mt-3">
          <button type="button" className="btn btn-dark mt-1" onClick={close}>
            Close
          </button>
          <button className="btn btn-outline-dark mt-1 ms-2" type="submit" disabled={!url}>
            <AiOutlineCheckCircle /> Check online file
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default PublishModal;
