import cx from "classnames";
import React, { FC, useContext, useState } from "react";
import { FaTimes } from "react-icons/fa";
import Slider from "rc-slider";

import { GraphContext } from "../lib/context";

const EdgePanel: FC<{ isExpanded: boolean }> = ({ isExpanded }) => {
    const { navState, setNavState, setShowEdgePanel } = useContext(GraphContext);

    // State for edge creation criteria
    const [topicThreshold, setTopicThreshold] = useState(2);
    const [contributorThreshold, setContributorThreshold] = useState(1);
    const [stargazerThreshold, setStargazerThreshold] = useState(5);
    const [enableTopicLinking, setEnableTopicLinking] = useState(false);
    const [enableContributorOverlap, setEnableContributorOverlap] = useState(false);
    const [enableSharedOrganization, setEnableSharedOrganization] = useState(false);
    const [enableCommonStargazers, setEnableCommonStargazers] = useState(false);
    const [enableDependencies, setEnableDependencies] = useState(false);

    return (
        <section
            className={cx(
                "side-panel edge-panel d-flex flex-column bg-dark text-white",
                isExpanded ? "expanded" : "collapsed",
            )}
        >
            <div className="panel-content scrollbar-left position-relative">
                <div className="flex-grow-1 p-0 m-0">
                    <div className="editor-block block">
                        <button
                            className="btn btn-outline-light position-absolute"
                            style={{ top: 15, right: 15 }}
                            onClick={() => {
                                setNavState({ ...navState, role: "x" });
                                setShowEdgePanel(false);
                            }}
                        >
                            <FaTimes />
                        </button>

                        <h1 className="fs-4 mt-4 mb-4">
                            <img
                                src={import.meta.env.BASE_URL + "deepgit_logo.png"}
                                alt="DeepGit logo"
                                style={{ height: "1em", filter: "invert(1)" }}
                                className="me-1 mb-1"
                            />
                            Edge Creation
                        </h1>

                        <div className="mb-3">
                            <h3 className="form-label fs-6 mb-3">Configure how edges are automatically created between repositories based on various criteria</h3>
                        </div>

                        {/* Topic Based Linking */}
                        <div className="mb-4">
                            <div className="d-flex align-items-center mb-2">
                                <input
                                    type="checkbox"
                                    className="form-check-input me-2"
                                    checked={enableTopicLinking}
                                    onChange={(e) => setEnableTopicLinking(e.target.checked)}
                                />
                                <label className="form-label mb-0">Topic Based Linking</label>
                            </div>
                            <p className="text-white small mb-2 ms-4">
                                Repositories sharing a number of common topics will be linked
                            </p>
                            {enableTopicLinking && (
                                <div className="ms-4">
                                    <label className="form-label small text-white">
                                        Minimum shared topics: <strong>{topicThreshold}</strong>
                                    </label>
                                    <Slider
                                        value={topicThreshold}
                                        min={1}
                                        max={10}
                                        step={1}
                                        marks={{
                                            1: "1",
                                            5: "5",
                                            10: "10"
                                        }}
                                        onChange={(value) => setTopicThreshold(value as number)}
                                        className="mt-2"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Contributor Overlap */}
                        <div className="mb-4">
                            <div className="d-flex align-items-center mb-2">
                                <input
                                    type="checkbox"
                                    className="form-check-input me-2"
                                    checked={enableContributorOverlap}
                                    onChange={(e) => setEnableContributorOverlap(e.target.checked)}
                                />
                                <label className="form-label mb-0">Contributor Overlap</label>
                            </div>
                            <p className="text-white small mb-2 ms-4">
                                Repositories will be linked if they share a sufficient number of contributors
                            </p>
                            {enableContributorOverlap && (
                                <div className="ms-4">
                                    <label className="form-label small text-white">
                                        Minimum shared contributors: <strong>{contributorThreshold}</strong>
                                    </label>
                                    <Slider
                                        value={contributorThreshold}
                                        min={1}
                                        max={20}
                                        step={1}
                                        marks={{
                                            1: "1",
                                            5: "5",
                                            10: "10",
                                            20: "20"
                                        }}
                                        onChange={(value) => setContributorThreshold(value as number)}
                                        className="mt-2"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Shared Organization */}
                        <div className="mb-4">
                            <div className="d-flex align-items-center mb-2">
                                <input
                                    type="checkbox"
                                    className="form-check-input me-2"
                                    checked={enableSharedOrganization}
                                    onChange={(e) => setEnableSharedOrganization(e.target.checked)}
                                />
                                <label className="form-label mb-0">Shared Organization</label>
                            </div>
                            <p className="text-white small mb-2 ms-4">
                                Repositories maintained within the same GitHub organization will be linked. This helps identify repositories that are part of the same project ecosystem or company.
                            </p>
                        </div>

                        {/* Common Stargazers */}
                        <div className="mb-4">
                            <div className="d-flex align-items-center mb-2">
                                <input
                                    type="checkbox"
                                    className="form-check-input me-2"
                                    checked={enableCommonStargazers}
                                    onChange={(e) => setEnableCommonStargazers(e.target.checked)}
                                />
                                <label className="form-label mb-0">Common Stargazers</label>
                            </div>
                            <p className="text-white small mb-2 ms-4">
                                Repositories are linked if they share a sufficient number of stargazers
                            </p>
                            {enableCommonStargazers && (
                                <div className="ms-4">
                                    <label className="form-label small text-white">
                                        Minimum shared stargazers: <strong>{stargazerThreshold}</strong>
                                    </label>
                                    <Slider
                                        value={stargazerThreshold}
                                        min={1}
                                        max={100}
                                        step={5}
                                        marks={{
                                            1: "1",
                                            25: "25",
                                            50: "50",
                                            100: "100"
                                        }}
                                        onChange={(value) => setStargazerThreshold(value as number)}
                                        className="mt-2"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Dependencies */}
                        <div className="mb-4">
                            <div className="d-flex align-items-center mb-2">
                                <input
                                    type="checkbox"
                                    className="form-check-input me-2"
                                    checked={enableDependencies}
                                    onChange={(e) => setEnableDependencies(e.target.checked)}
                                />
                                <label className="form-label mb-0">Dependencies</label>
                            </div>
                            <p className="text-white small mb-2 ms-4">
                                If a repository depends on another, it will be linked (this creates direct edges). This shows the actual dependency relationships between projects, such as when one project imports or uses another.
                            </p>
                        </div>

                        {/* Apply Button */}
                        <div className="mb-3">
                            <button
                                className="btn btn-light w-100 text-center"
                                onClick={() => {
                                    // Here you would implement the logic to create edges based on the selected criteria
                                    console.log("Creating edges with criteria:", {
                                        topicThreshold,
                                        contributorThreshold,
                                        stargazerThreshold,
                                        enableTopicLinking,
                                        enableContributorOverlap,
                                        enableSharedOrganization,
                                        enableCommonStargazers,
                                        enableDependencies
                                    });
                                }}
                            >
                                Apply Edge Creation Rules
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default EdgePanel;
