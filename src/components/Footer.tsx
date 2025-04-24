import React, { FC } from "react";
import { FaGithub } from "react-icons/fa";
import { Link } from "react-router-dom";

import Matomo from "./Matomo";

const Footer: FC = () => (
  <>
    <div className="d-flex flex-column align-items-center justify-content-center text-center">
      <span>
        Released under the GNU GPLv3 license. Copyright © 2024-present
        <a href="https://github.com/data-exp-lab/deepgit" target="_blank" rel="noreferrer" className="ms-1">
          DeepGit Devs
        </a>
      </span>
    </div>
    <Matomo />
  </>
);

export default Footer;
