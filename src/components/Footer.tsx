import React, { FC } from "react";
import { FaGithub } from "react-icons/fa";
import { Link } from "react-router-dom";

import Matomo from "./Matomo";

const Footer: FC = () => (
  <>
    <div className="d-flex flex-row align-items-center">
      <Link to="/" className="flex-shrink-0 me-2 p-0">
        <img
          src={import.meta.env.BASE_URL + "/deepgit_logo.png"}
          alt="Retina logo"
          style={{ height: "1.2em" }}
          className="me-1"
        />
      </Link>
      <div className="flex-grow-1">
        <Link to="/">DeepGit</Link> is a joint effort between {" "}
        <a href="https://github.com/data-exp-lab" target="_blank" rel="noreferrer">
          Data Exploration Lab
        </a>
        {" "} and {" "}
        <a href="https://github.com/numfocus/moss" className="text-nowrap" target="_blank" rel="noreferrer">
          MOSS
        </a>{" "}
      </div>
      <div className="flex-shrink-0 ms-2">
        <a href="https://github.com/data-exp-lab/deepgit" target="_blank" rel="noreferrer">
          <FaGithub size={20} />
        </a>
      </div>
    </div>
    <Matomo />
  </>
);

export default Footer;
