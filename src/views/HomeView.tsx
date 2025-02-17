import cx from "classnames";
import React, { FC, useEffect, useState } from "react";
import { AiOutlineCloud } from "react-icons/ai";
import { RiComputerLine } from "react-icons/ri";
import { useLocation, useNavigate } from "react-router";

import DropInput from "../components/DropInput";
import Footer from "../components/Footer";
import { SAMPLE_DATASET_URI } from "../lib/consts";
import { getErrorMessage } from "../lib/errors";
import { useNotifications } from "../lib/notifications";

const HomeView: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useNotifications();
  const error = ((location.state as { error?: unknown } | undefined)?.error || "") + "";
  const [state, setState] = useState<
    { type: "hidden" } | { type: "choice" } | { type: "url"; input: string } | { type: "local"; input: File | null }
  >({ type: "hidden" });

  useEffect(() => {
    const id = setTimeout(() => setState({ type: "choice" }), 500);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (error)
      notify({
        message: getErrorMessage(error),
        type: "error",
      });
  }, [error, notify]);

  return (
    <main className="home-view">
      <div className="title-block">
        <div className="text-center">
          <img src={import.meta.env.BASE_URL + "/logo.svg"} alt="Retina Logo" className="mb-3" />
        </div>
        <h1 className="mb-4">
          <span className="position-relative">
            Retina{" "}
            <small className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-warning fs-6">
              beta
            </small>
          </span>
        </h1>
        <h2 className="h4 text-center">
          Retina is a web application that helps you share your graph visualizations online.
        </h2>
        <h2 className="h5 text-center">
          It currently accepts <a href="http://gexf.net/">GEXF</a> and{" "}
          <a href="https://en.wikipedia.org/wiki/GraphML">GraphML</a> files.
        </h2>
        <div>
          <div className={cx("gexf-form", "text-center", "mt-4", state.type === "hidden" && "opacity-0")}>
            {state.type === "choice" && (
              <>
                <p className="h5">Your graph file is...</p>
                <div className="d-flex flex-row align-items-stretch flex-wrap justify-content-center">
                  <button
                    type="button"
                    className="btn btn-outline-dark flex-regular-width m-1"
                    onClick={() => setState({ type: "url", input: "" })}
                  >
                    <AiOutlineCloud /> Online
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-dark flex-regular-width m-1"
                    onClick={() => setState({ type: "local", input: null })}
                  >
                    <RiComputerLine /> On your computer
                  </button>
                </div>
              </>
            )}
            {state.type === "url" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  navigate(`/graph/?r=d&url=${encodeURIComponent(state.input)}`, { state: { fromHome: true } });
                }}
              >
                <label htmlFor="graph-url-input" className="form-label h5">
                  Enter here your graph file URL, or use{" "}
                  <a
                    href={SAMPLE_DATASET_URI}
                    onClick={(e) => {
                      e.preventDefault();
                      setState({ type: "url", input: window.location.origin + SAMPLE_DATASET_URI });
                    }}
                  >
                    our sample
                  </a>
                  :
                </label>
                <input
                  type="url"
                  className="form-control"
                  id="graph-url-input"
                  value={state.input}
                  placeholder="http://..."
                  onChange={(e) => setState({ type: "url", input: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-outline-dark mt-2 me-2"
                  onClick={() => setState({ type: "choice" })}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-outline-dark mt-2" disabled={!state.input}>
                  Visualize
                </button>
              </form>
            )}
            {state.type === "local" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  navigate(`/graph/?r=d&l=1`, { state: { file: state.input as File, fromHome: true } });
                }}
              >
                <DropInput value={state.input} onChange={(file) => setState({ type: "local", input: file })} />
                <button
                  type="button"
                  className="btn btn-outline-dark mt-2 me-2"
                  onClick={() => setState({ type: "choice" })}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-outline-dark mt-2" disabled={!state.input}>
                  Visualize
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="footer p-2">
        <hr className="mb-2" />
        <Footer />
      </div>
    </main>
  );
};

export default HomeView;
