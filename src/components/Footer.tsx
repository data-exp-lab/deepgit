import React, { FC } from "react";
import { AiOutlineHeart } from "react-icons/ai";
import { BsCodeSlash } from "react-icons/bs";
import { Link } from "react-router-dom";

import Matomo from "./Matomo";

const Footer: FC = () => (
  <>
    <div className="d-flex flex-row align-items-center">
      <Link to="/" className="flex-shrink-0 me-2 p-0">
        <img
          src={import.meta.env.BASE_URL + "/logo.svg"}
          alt="Retina logo"
          style={{ height: "1.2em" }}
          className="me-1"
        />
      </Link>
      <div className="flex-grow-1">
        <Link to="/">Retina</Link> is built with <AiOutlineHeart /> by{" "}
        <a href="https://www.ouestware.com/en" target="_blank" rel="noreferrer">
          OuestWare
        </a>
        ,{" "}
        <a href="https://cis.cnrs.fr" className="text-nowrap" target="_blank" rel="noreferrer">
          CNRS CIS
        </a>{" "}
        and{" "}
        <a href="http://www.tommasoventurini.it/" className="text-nowrap" target="_blank" rel="noreferrer">
          Tommaso Venturini
        </a>
      </div>
      <div className="flex-shrink-0 ms-2">
        <a href="https://gitlab.com/ouestware/retina" target="_blank" rel="noreferrer">
          <BsCodeSlash />
        </a>
      </div>
    </div>
    <Matomo />
  </>
);

export default Footer;
