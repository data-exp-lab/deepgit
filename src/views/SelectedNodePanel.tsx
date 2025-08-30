import cx from "classnames";
import { map, mapKeys, omitBy, startCase, uniq } from "lodash";
import React, { FC, useContext } from "react";
import { BiRadioCircleMarked } from "react-icons/bi";
import { FaTimes } from "react-icons/fa";
import Linkify from "react-linkify";
import { Coordinates } from "sigma/types";

import Connection from "../components/Connection";
import Node from "../components/Node";
import { ANIMATION_DURATION, DEFAULT_LINKIFY_PROPS, isHiddenRetinaField, removeRetinaPrefix } from "../lib/consts";
import { GraphContext } from "../lib/context";
import { NodeData } from "../lib/data";

const HIDDEN_KEYS = new Set(["x", "y", "z", "size", "label", "color", "stargazers"]);

const SelectedNodePanel: FC<{ node: string; data: NodeData }> = ({ node, data: { attributes } }) => {
  const {
    navState,
    setNavState,
    data: { graph },
    sigma,
    computedData: { filteredNodes },
  } = useContext(GraphContext);

  const [showAllVisibleNeighbors, setShowAllVisibleNeighbors] = React.useState(false);
  const [showAllHiddenNeighbors, setShowAllHiddenNeighbors] = React.useState(false);

  if (!attributes) return null;

  const currentAttributes = graph.getNodeAttributes(node);
  const filteredAttributes = mapKeys(
    omitBy(attributes, (_, key) => isHiddenRetinaField(key) || HIDDEN_KEYS.has(key)),
    (_, key) => removeRetinaPrefix(key),
  );
  const visibleNeighbors: string[] = [];
  const hiddenNeighbors: string[] = [];
  uniq(graph.neighbors(node)).forEach((n) => {
    if (filteredNodes && !filteredNodes.has(n)) hiddenNeighbors.push(n);
    else visibleNeighbors.push(n);
  });

  // Debug logging
  console.log('SelectedNodePanel render:', {
    visibleNeighborsCount: visibleNeighbors.length,
    hiddenNeighborsCount: hiddenNeighbors.length,
    showAllVisibleNeighbors,
    showAllHiddenNeighbors
  });

  const isHidden = filteredNodes && !filteredNodes.has(node);

  return (
    <div className="selected-nodes-block block">
      <h1 className="fs-4 mt-4">
        <span className={cx("me-2", isHidden ? "circle" : "disc")} style={{ background: currentAttributes.color }} />
        <Linkify {...DEFAULT_LINKIFY_PROPS}>{currentAttributes.label}</Linkify>
        {isHidden ? (
          <>
            {" "}
            <small className="text-muted">(currently filtered out)</small>
          </>
        ) : null}
      </h1>

      <br />

      <div>
        <button
          className="btn btn-outline-dark mt-1 me-2"
          onClick={() => setNavState({ ...navState, selectedNode: undefined })}
        >
          <FaTimes /> Unselect
        </button>
        <button
          className="btn btn-outline-dark mt-1"
          onClick={() => {
            if (!sigma) return;
            const nodePosition = sigma.getNodeDisplayData(node) as Coordinates;
            sigma.getCamera().animate(
              { ...nodePosition, ratio: 0.3 },
              {
                duration: ANIMATION_DURATION,
              },
            );
          }}
        >
          <BiRadioCircleMarked /> Show on graph
        </button>
      </div>

      <br />

      {map(filteredAttributes, (value, key) => (
        <h2 key={key} className="fs-5 ellipsis">
          <small className="text-muted">{startCase(key)}:</small>{" "}
          <span title={value}>
            {key === "topics" && typeof value === "string" ? (
              // Special handling for topics - display in a compact grid layout
              <div className="mt-2 d-flex flex-wrap">
                {value.split('|').map((topic, index) => (
                  <span key={index} className="badge bg-secondary me-1 mb-1">{topic.trim()}</span>
                ))}
              </div>
            ) : key === "contributors" && typeof value === "string" ? (
              // Special handling for contributors - display with GitHub profile links and show more/less
              <div className="mt-2">
                {(() => {
                  const contributorsList = value.split(',').map(c => c.trim()).filter(Boolean);
                  if (contributorsList.length === 0) return <span className="text-muted">No contributors</span>;

                  return (
                    <div>
                      <div className="d-flex align-items-center mb-2">
                        <span className="badge bg-primary me-2">{contributorsList.length} contributors</span>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          type="button"
                          data-bs-toggle="collapse"
                          data-bs-target={`#contributors-${node}`}
                          aria-expanded="false"
                          aria-controls={`contributors-${node}`}
                        >
                          Show/Hide Contributors
                        </button>
                      </div>

                      <div className="collapse" id={`contributors-${node}`}>
                        <div className="mb-2">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Search contributors..."
                            onChange={(e) => {
                              const searchTerm = e.target.value.toLowerCase();
                              const contributorElements = document.querySelectorAll(`#contributors-${node} .contributor-item`);
                              contributorElements.forEach((el) => {
                                const username = el.textContent?.toLowerCase() || '';
                                if (username.includes(searchTerm)) {
                                  (el as HTMLElement).style.display = 'inline-block';
                                } else {
                                  (el as HTMLElement).style.display = 'none';
                                }
                              });
                            }}
                          />
                        </div>
                        <div className="d-flex flex-wrap">
                          {contributorsList.map((contributor, index) => (
                            <a
                              key={index}
                              href={`https://github.com/${contributor}`}
                              target="_blank"
                              rel="noreferrer"
                              className="badge bg-primary me-1 mb-1 text-decoration-none contributor-item"
                            >
                              {contributor}
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

            ) : typeof value === "number" ? (
              value.toLocaleString()
            ) : typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://")) ? (
              <a href={value} target="_blank" rel="noreferrer">{value}</a>
            ) : (
              <Linkify {...DEFAULT_LINKIFY_PROPS}>{String(value)}</Linkify>
            )}
          </span>
        </h2>
      ))}

      <hr />

      {!(visibleNeighbors.length + hiddenNeighbors.length) && <p className="text-muted">This node has no neighbor.</p>}

      {!!visibleNeighbors.length && (
        <>
          <div className="text-muted mb-2 mt-4">
            This node has {visibleNeighbors.length > 1 ? visibleNeighbors.length + " neighbors" : "one neighbor"}{" "}
            visible in this graph:
          </div>
          <div>
            <ul className="list-unstyled">
              <li className="text-muted small mb-2">Debug: Showing {showAllVisibleNeighbors ? 'all' : 'first 5'} of {visibleNeighbors.length} neighbors</li>
              {(showAllVisibleNeighbors ? visibleNeighbors : visibleNeighbors.slice(0, 5)).map((neighbor) => (
                <li key={neighbor} className="d-flex flex-row align-items-center">
                  <Connection origin={node} edges={graph.edges(node, neighbor)} />
                  <Node link node={neighbor} className="text-ellipsis" attributes={graph.getNodeAttributes(neighbor)} />
                </li>
              ))}
            </ul>
            {visibleNeighbors.length > 5 && (
              <div className="mt-2">
                <button
                  className="btn btn-sm btn-outline-primary"
                  type="button"
                  onClick={() => {
                    console.log('Visible neighbors button clicked, current state:', showAllVisibleNeighbors);
                    setShowAllVisibleNeighbors(!showAllVisibleNeighbors);
                  }}
                >
                  {showAllVisibleNeighbors ? 'Show Less' : 'Show All'}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {!!hiddenNeighbors.length && (
        <>
          <div className="text-muted mb-2 mt-4">
            This node{visibleNeighbors.length ? " also" : ""} has{" "}
            {hiddenNeighbors.length > 1 ? hiddenNeighbors.length + " neighbors " : "one neighbor "}
            that {hiddenNeighbors.length > 1 ? "are" : "is"} currently filtered out:
          </div>
          <div>
            <ul className="list-unstyled">
              <li className="text-muted small mb-2">Debug: Showing {showAllHiddenNeighbors ? 'all' : 'first 5'} of {hiddenNeighbors.length} neighbors</li>
              {(showAllHiddenNeighbors ? hiddenNeighbors : hiddenNeighbors.slice(0, 5)).map((neighbor) => (
                <li key={neighbor} className="d-flex flex-row align-items-center">
                  <Connection origin={node} edges={graph.edges(node, neighbor)} />
                  <Node link node={neighbor} className="text-ellipsis" attributes={graph.getNodeAttributes(neighbor)} />
                </li>
              ))}
            </ul>
            {hiddenNeighbors.length > 5 && (
              <div className="mt-2">
                <button
                  className="btn btn-sm btn-outline-primary"
                  type="button"
                  onClick={() => {
                    console.log('Hidden neighbors button clicked, current state:', showAllHiddenNeighbors);
                    setShowAllHiddenNeighbors(!showAllHiddenNeighbors);
                  }}
                >
                  {showAllHiddenNeighbors ? 'Show Less' : 'Show All'}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <hr />

      {/* Shared Topics with Neighbors Section */}
      {(() => {
        const currentTopics = currentAttributes.attributes?.topics;
        if (!currentTopics || typeof currentTopics !== 'string') return null;

        const currentTopicsArray = currentTopics.split('|').map(t => t.trim()).filter(Boolean);
        if (currentTopicsArray.length === 0) return null;

        const allNeighbors = [...visibleNeighbors, ...hiddenNeighbors];
        if (allNeighbors.length === 0) return null;

        const neighborsWithSharedTopics = allNeighbors.map(neighbor => {
          const neighborTopics = graph.getNodeAttributes(neighbor).attributes?.topics;
          if (!neighborTopics || typeof neighborTopics !== 'string') return null;

          const neighborTopicsArray = neighborTopics.split('|').map(t => t.trim()).filter(Boolean);
          const sharedTopics = currentTopicsArray.filter(topic => neighborTopicsArray.includes(topic));

          return {
            neighbor,
            sharedTopics
          };
        }).filter((item): item is { neighbor: string; sharedTopics: string[] } => item !== null);

        if (neighborsWithSharedTopics.length === 0) return null;

        // Collect all unique shared topics across all neighbors
        const allSharedTopics = new Set<string>();
        neighborsWithSharedTopics.forEach(({ sharedTopics }) => {
          sharedTopics.forEach(topic => allSharedTopics.add(topic));
        });

        const uniqueSharedTopics = Array.from(allSharedTopics).sort();

        return (
          <>
            <div className="text-muted mb-2 mt-4">
              <strong>Shared Topics with Neighbors:</strong>
            </div>
            <div className="mb-3">
              {uniqueSharedTopics.length > 0 ? (
                <div className="mt-2 d-flex flex-wrap">
                  {uniqueSharedTopics.map((topic, index) => (
                    <span key={index} className="badge bg-secondary me-1 mb-1 fs-6" style={{ fontSize: '0.875rem' }}>{topic}</span>
                  ))}
                </div>
              ) : (
                <span className="text-muted">No shared topics</span>
              )}
            </div>
          </>
        );
      })()}

      {/* Shared Contributors with Neighbors Section */}
      {(() => {
        const currentContributors = currentAttributes.attributes?.contributors;
        if (!currentContributors || typeof currentContributors !== 'string') return null;

        const currentContributorsArray = currentContributors.split(',').map(c => c.trim()).filter(Boolean);
        if (currentContributorsArray.length === 0) return null;

        const allNeighbors = [...visibleNeighbors, ...hiddenNeighbors];
        if (allNeighbors.length === 0) return null;

        const neighborsWithSharedContributors = allNeighbors.map(neighbor => {
          const neighborContributors = graph.getNodeAttributes(neighbor).attributes?.contributors;
          if (!neighborContributors || typeof neighborContributors !== 'string') return null;

          const neighborContributorsArray = neighborContributors.split(',').map(c => c.trim()).filter(Boolean);
          const sharedContributors = currentContributorsArray.filter(contributor => neighborContributorsArray.includes(contributor));

          return {
            neighbor,
            sharedContributors
          };
        }).filter((item): item is { neighbor: string; sharedContributors: string[] } => item !== null);

        if (neighborsWithSharedContributors.length === 0) return null;

        // Collect all unique shared contributors across all neighbors
        const allSharedContributors = new Set<string>();
        neighborsWithSharedContributors.forEach(({ sharedContributors }) => {
          sharedContributors.forEach(contributor => allSharedContributors.add(contributor));
        });

        const uniqueSharedContributors = Array.from(allSharedContributors).sort();

        return (
          <>
            <div className="text-muted mb-2 mt-4">
              <strong>Shared Contributors with Neighbors:</strong>
            </div>
            <div className="mb-3">
              {uniqueSharedContributors.length > 0 ? (
                <div className="mt-2 d-flex flex-wrap">
                  {uniqueSharedContributors.map((contributor, index) => (
                    <a
                      key={index}
                      href={`https://github.com/${contributor}`}
                      target="_blank"
                      rel="noreferrer"
                      className="badge bg-primary me-1 mb-1 text-decoration-none fs-6"
                      style={{ fontSize: '0.875rem' }}
                    >
                      {contributor}
                    </a>
                  ))}
                </div>
              ) : (
                <span className="text-muted">No shared contributors</span>
              )}
            </div>
          </>
        );
      })()}

      {/* Shared Stargazers with Neighbors Section */}
      {(() => {
        const currentStargazers = currentAttributes.attributes?.stargazers;
        if (!currentStargazers || typeof currentStargazers !== 'string') return null;

        const currentStargazersArray = currentStargazers.split(',').map(s => s.trim()).filter(Boolean);
        if (currentStargazersArray.length === 0) return null;

        const allNeighbors = [...visibleNeighbors, ...hiddenNeighbors];
        if (allNeighbors.length === 0) return null;

        const neighborsWithSharedStargazers = allNeighbors.map(neighbor => {
          const neighborStargazers = graph.getNodeAttributes(neighbor).attributes?.stargazers;
          if (!neighborStargazers || typeof neighborStargazers !== 'string') return null;

          const neighborStargazersArray = neighborStargazers.split(',').map(s => s.trim()).filter(Boolean);
          const sharedStargazers = currentStargazersArray.filter(stargazer => neighborStargazersArray.includes(stargazer));

          return {
            neighbor,
            sharedStargazers
          };
        }).filter((item): item is { neighbor: string; sharedStargazers: string[] } => item !== null);

        if (neighborsWithSharedStargazers.length === 0) return null;

        // Collect all unique shared stargazers across all neighbors
        const allSharedStargazers = new Set<string>();
        neighborsWithSharedStargazers.forEach(({ sharedStargazers }) => {
          sharedStargazers.forEach(stargazer => allSharedStargazers.add(stargazer));
        });

        const uniqueSharedStargazers = Array.from(allSharedStargazers).sort();

        return (
          <>
            <div className="text-muted mb-2 mt-4">
              <strong>Shared Stargazers with Neighbors:</strong>
            </div>
            <div className="mb-3">
              {uniqueSharedStargazers.length > 0 ? (
                <div>
                  <div className="d-flex align-items-center mb-2">
                    <span className="badge bg-success me-2">{uniqueSharedStargazers.length} shared stargazers</span>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target={`#shared-stargazers-${node}`}
                      aria-expanded="false"
                      aria-controls={`shared-stargazers-${node}`}
                    >
                      Show/Hide Shared Stargazers
                    </button>
                  </div>

                  <div className="collapse" id={`shared-stargazers-${node}`}>
                    <div className="mb-2">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Search shared stargazers..."
                        onChange={(e) => {
                          const searchTerm = e.target.value.toLowerCase();
                          const stargazerElements = document.querySelectorAll(`#shared-stargazers-${node} .shared-stargazer-item`);
                          stargazerElements.forEach((el) => {
                            const username = el.textContent?.toLowerCase() || '';
                            if (username.includes(searchTerm)) {
                              (el as HTMLElement).style.display = 'inline-block';
                            } else {
                              (el as HTMLElement).style.display = 'none';
                            }
                          });
                        }}
                      />
                    </div>
                    <div className="d-flex flex-wrap">
                      {uniqueSharedStargazers.map((stargazer, index) => (
                        <a
                          key={index}
                          href={`https://github.com/${stargazer}`}
                          target="_blank"
                          rel="noreferrer"
                          className="badge bg-success me-1 mb-1 text-decoration-none shared-stargazer-item fs-6"
                          style={{ fontSize: '0.875rem' }}
                        >
                          {stargazer}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <span className="text-muted">No shared stargazers</span>
              )}
            </div>
          </>
        );
      })()}

      <hr />

      <div className="alert alert-info mb-3">
        <small>
          <strong>Note:</strong> Contributors represent pull request creators, and stargazers are users who starred the repository on GitHub.
        </small>
      </div>
    </div>
  );
};

export default SelectedNodePanel;
