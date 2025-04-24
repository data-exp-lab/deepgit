import cx from "classnames";
import React, { FC, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { FaArrowRight, FaSearch } from "react-icons/fa";

import Footer from "../components/Footer";
import { getErrorMessage } from "../lib/errors";
import { useNotifications } from "../lib/notifications";

const HomeView: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useNotifications();
  const error = ((location.state as { error?: unknown } | undefined)?.error || "") + "";

  useEffect(() => {
    if (error)
      notify({
        message: getErrorMessage(error),
        type: "error",
      });
  }, [error, notify]);

  return (
    <main className="home-view d-flex flex-column justify-content-center" style={{ padding: "0 2rem", minHeight: "100vh", paddingTop: "10vh" }}>
      <div className="title-block text-center">
        <img
          src={import.meta.env.BASE_URL + "deepgit_logo.png"}
          alt="DeepGit Logo"
          className="mb-3"
          style={{ width: "150px", height: "auto" }}
        />
        <h1 className="mb-4">
          <span className="position-relative">
            DeepGit{" "}
            <small className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-warning fs-6">
              beta
            </small>
          </span>
        </h1>
        <h2 className="h5 mb-4" style={{ maxWidth: "500px", margin: "0 auto" }}>
          Discover and explore domain-specific scientific software using large scale graphs
        </h2>
        <div className="search-bar mb-4 d-flex justify-content-center">
          <div
            className="input-group align-items-center"
            style={{
              border: "1px solid #ddd",
              borderRadius: "20px",
              overflow: "hidden",
              width: "800px", // Fixed width
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
              backgroundColor: "#fff", // Unified background
            }}
          >
            <span
              className="input-group-text border-0"
              style={{
                padding: "0.75rem",
                fontSize: "1rem",
                color: "#6c757d",
                backgroundColor: "transparent", // Transparent icon background
              }}
            >
              <FaSearch />
            </span>
            <input
              type="text"
              className="form-control border-0"
              placeholder="Search scientific software topics..."
              style={{
                boxShadow: "none",
                fontSize: "1rem",
                padding: "0.75rem",
                backgroundColor: "transparent", // Transparent input background
              }}
            />
            <button
              className="btn border-0"
              style={{
                padding: "0.75rem",
                fontSize: "1rem",
                color: "#6c757d",
                backgroundColor: "transparent", // Transparent button background
                transition: "color 0.3s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#1e90ff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#6c757d")}
            >
              <FaArrowRight />
            </button>
          </div>
        </div>
        <div className="tags d-flex flex-wrap justify-content-center mb-4" style={{ maxWidth: "600px", margin: "0 auto" }}>
          {[
            "visual programming",
            "machine learning",
            "logic programming",
            "large language models",
          ].map((tag) => (
            <button
              key={tag}
              className="btn btn-outline-secondary m-1"
              style={{
                borderRadius: "20px",
                padding: "0.5rem 1rem",
                border: "1px solid #ddd",
                backgroundColor: "#fff",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                fontSize: "1rem",
                color: "#212529",
                transition: "background-color 0.3s ease, box-shadow 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f8f9fa";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#fff";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.1)";
              }}
            >
              {tag}
            </button>
          ))}
        </div>
        {/* <div className="links d-flex justify-content-center">
          <a href="#" className="mx-2">
            About DeepGit
          </a>
          <a href="#" className="mx-2">
            Explore Graphs
          </a>
          <a href="#" className="mx-2">
            Documentation
          </a>
          <a href="#" className="mx-2">
            GitHub Repository
          </a>
        </div> */}
      </div>
      <div className="footer p-2">
        {/* <hr className="mb-2" /> */}
        <Footer />
      </div>
    </main>
  );
};

export default HomeView;
