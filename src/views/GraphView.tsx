import { SigmaContainer } from "@react-sigma/core";
import cx from "classnames";
import React, { FC, createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BsChevronDoubleLeft, BsChevronDoubleRight } from "react-icons/bs";
import { useLocation, useNavigate } from "react-router";
import Sigma from "sigma";
import { Dimensions } from "sigma/types";

import { LoaderFill } from "../components/Loader";
import {
  ComputedData,
  getEdgeSizes,
  getEmptyComputedData,
  getMetrics,
  getNodeColors,
  getNodeSizes,
} from "../lib/computedData";
import { BASE_SIGMA_SETTINGS } from "../lib/consts";
import { GraphContext, Panel } from "../lib/context";
import { Data, enrichData, loadGraphFile, loadGraphURL, prepareGraph, readGraph } from "../lib/data";
import {
  BAD_FILE,
  BAD_URL,
  MISSING_FILE,
  MISSING_URL,
  UNKNOWN,
  getErrorMessage,
  getReportNotification,
} from "../lib/errors";
import { applyGraphStyle } from "../lib/graph";
import {
  DEFAULT_ROLE,
  NavState,
  cleanNavState,
  guessNavState,
  navStateToQueryURL,
  queryURLToNavState,
} from "../lib/navState";
import { useNotifications } from "../lib/notifications";
import ContextPanel from "./ContextPanel";
import EditionPanel from "./EditionPanel";
import EventsController from "./EventsController";
import GraphAppearance from "./GraphAppearance";
import GraphControls from "./GraphControls";
import LocalWarningBanner from "./LocalWarningBanner";
import NodeSizeCaption from "./NodeSizeCaption";
import { MODALS, ModalName } from "./modals";

const GraphView: FC<{ embed?: boolean }> = ({ embed = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useNotifications();
  const [ready, setReady] = useState(true); // set default value as `!embed` to get an overlay

  const state = location.state as { file?: unknown; fromHome?: unknown } | undefined;
  const localFile = useMemo(() => (state?.file instanceof File ? state.file : null), [state]);
  const fromHome = useMemo(() => !!state?.fromHome, [state]);

  const domRoot = useRef<HTMLElement>(null);
  const [sigma, setSigma] = useState<Sigma | undefined>(undefined);
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 1000, height: 1000 });
  const [hovered, setHovered] = useState<string | Set<string> | undefined>(undefined);
  const [graphFile, setGraphFile] = useState<{
    name: string;
    extension: string;
    textContent: string;
  } | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const rawNavState = useMemo(() => queryURLToNavState(location.search), [location.search]);

  const url = useMemo(() => rawNavState.url, [rawNavState]);
  const local = useMemo(() => rawNavState.local, [rawNavState]);
  const navState = useMemo(() => (data ? cleanNavState(rawNavState, data) : null), [rawNavState, data]);
  const setNavState = useCallback(
    (newNavState: NavState) => {
      navigate(
        location.hash.replace(/^#/, "").replace(/\?.*/, "") +
        "?" +
        navStateToQueryURL(data ? cleanNavState(newNavState, data) : newNavState),
      );
    },
    [data, location.hash, navigate],
  );

  const [modalName, setModalName] = useState<ModalName | undefined>(undefined);
  const [panel, setPanel] = useState<Panel>("main");
  const [isPanelExpanded, setIsPanelExpanded] = useState(!embed && navState?.role !== "d");

  const [computedData, setComputedData] = useState<ComputedData | null>(null);

  const [showEditionPanel, setShowEditionPanel] = useState(false); // Add this state
  // Refresh aggregations and filtered items lists:
  useEffect(() => {
    if (data) {
      setComputedData((old) => ({
        nodeSizes: {},
        edgeSizes: {},
        nodeSizeExtents: [0, Infinity],
        edgeSizeExtents: [0, Infinity],
        ...old,
        ...getMetrics(
          data,
          {
            filters: navState?.filters,
            filterable: navState?.filterable,
            colorable: navState?.colorable,
            sizeable: navState?.sizeable,
          },
          old?.metrics,
        ),
      }));
    }
  }, [sigma, data, navState?.filters, navState?.filterable, navState?.colorable, navState?.sizeable]);

  // On first computedData update, apply graph style:
  useEffect(() => {
    if (data && computedData && navState && !sigma) {
      applyGraphStyle(data, computedData, navState);
    }
  }, [sigma, data, navState, computedData]);

  // Keep dimensions up to date:
  useEffect(() => {
    if (!sigma) return;

    const handler = () => setDimensions(sigma.getDimensions());
    sigma.on("resize", handler);
    return () => {
      sigma.off("resize", handler);
    };
  }, [sigma]);

  // Refresh node colors and sizes:
  useEffect(() => {
    if (data) {
      setComputedData((current) => ({
        ...(current || getEmptyComputedData()),
        ...getNodeColors(data, { nodeColorField: navState?.nodeColorField }),
      }));
    }
  }, [data, navState?.nodeColorField]);
  useEffect(() => {
    if (data) {
      setComputedData((current) => ({
        ...(current || getEmptyComputedData()),
        ...getNodeSizes(
          data,
          { nodeSizeField: navState?.nodeSizeField, nodeSizeRatio: navState?.nodeSizeRatio },
          dimensions,
        ),
      }));
    }
  }, [data, navState?.nodeSizeField, navState?.nodeSizeRatio, dimensions]);
  useEffect(() => {
    if (data) {
      setComputedData((current) => ({
        ...(current || getEmptyComputedData()),
        ...getEdgeSizes(data, { edgeSizeRatio: navState?.edgeSizeRatio }, dimensions),
      }));
    }
  }, [data, navState?.edgeSizeRatio, dimensions]);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!ready) return;

    let promise:
      | Promise<{
        name: string;
        extension: string;
        textContent: string;
      }>
      | undefined;

    if (!url && !local) {
      navigate("/?", {
        state: {
          error: MISSING_URL,
        },
      });
      return;
    } else if (local) {
      if (localFile) {
        promise = loadGraphFile(localFile);
      } else {
        navigate("/?", {
          state: {
            error: MISSING_FILE,
          },
        });
        return;
      }
    } else {
      promise = loadGraphURL(url as string);
    }

    if (promise) {
      promise
        .then(({ name, extension, textContent }) => {
          setGraphFile({ name, extension, textContent });
          return readGraph({ name, extension, textContent });
        })
        .then((rawGraph) => {
          if (!rawGraph) throw new Error("Parsed graph is empty or invalid (possibly no edges).");
          return prepareGraph(rawGraph);
        })
        .then(({ graph, report }) => {
          const notif = getReportNotification(report, /*rawNavState.role !== "d"*/ true);
          if (notif) notify(notif);

          const richData = enrichData(graph);
          setData(richData);

          if (fromHome) {
            setNavState({
              ...rawNavState,
              ...guessNavState(richData, report),
            });
          }
        })
        .catch((e) => {
          const error = e.name === BAD_URL ? BAD_URL : BAD_FILE;
          console.error(getErrorMessage(error).replace(/\.$/, "") + ":");
          console.error(e.message);
          navigate("/?", {
            state: {
              error: error,
            },
          });
        });
    } else {
      // This case should never occur, but TypeScript doesn't understand that;
      navigate("/?", {
        state: {
          error: UNKNOWN,
        },
      });
    }
  }, [url, local, ready]);
  /* eslint-enable react-hooks/exhaustive-deps */

  if (!ready)
    return (
      <div
        className="fill flex-centered flex-column hoverable"
        tabIndex={0}
        role="dialog"
        onClick={() => setReady(true)}
      >
        <p>
          <img src={import.meta.env.BASE_URL + "/logo.svg"} alt="Retina logo" style={{ height: "4em" }} />
        </p>
        <p className="fs-3">Click here to see the graph visualization</p>
      </div>
    );

  if (!data || !graphFile || !navState || !computedData) return <LoaderFill />;

  return (
    <GraphContext.Provider
      value={{
        embedMode: embed,
        data,
        navState,
        computedData,
        graphFile,
        setNavState,
        hovered,
        setHovered,

        isPanelExpanded,
        setIsPanelExpanded,

        showEditionPanel,
        setShowEditionPanel,

        modal: modalName,
        openModal: (modal: ModalName) => setModalName(modal),
        closeModal: () => setModalName(undefined),

        panel,
        setPanel,

        sigma,
        setSigma,
        root: domRoot.current || undefined,
      }}
    >
      {navState.local && <LocalWarningBanner />}
      {showEditionPanel && <EditionPanel isExpanded={true} />}
      <main className={cx("graph-view", isPanelExpanded ? "panel-expanded" : "panel-collapsed")} ref={domRoot}>
        <div className="wrapper">
          <ContextPanel />
          <section className="graph">
            <SigmaContainer
              className={cx("sigma-wrapper", !!hovered && "cursor-pointer")}
              graph={data.graph}
              settings={BASE_SIGMA_SETTINGS}
            >
              <GraphAppearance />
              <EventsController />

              <div className="controls">
                <GraphControls />
              </div>

              <div className="captions">
                <NodeSizeCaption />
              </div>
            </SigmaContainer>
          </section>
        </div>

        <button
          className="btn btn-outline-dark toggle-button graph-button"
          onClick={() => setIsPanelExpanded((v) => !v)}
          title="Toggle side panel"
        >
          {isPanelExpanded ? <BsChevronDoubleLeft /> : <BsChevronDoubleRight />}
        </button>
      </main>

      {/* Currently opened modal: */}
      {modalName && createElement(MODALS[modalName], { close: () => setModalName(undefined) })}
    </GraphContext.Provider>
  );
};

export default GraphView;
