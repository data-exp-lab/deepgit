import React, { useContext } from "react";
import { useLocation } from "react-router-dom";

import { GraphContext } from "../lib/context";

const matomoUrl: string | undefined = import.meta.env.MATOMO_URL;
const matomoSiteId: string | undefined = import.meta.env.MATOMO_SITE_ID;

const Matomo: React.FC = () => {
  const location = useLocation();
  const context = useContext(GraphContext);

  const url = context?.navState?.url || "local";

  return (
    <>
      {matomoUrl && matomoSiteId && (
        <img
          referrerPolicy="no-referrer-when-downgrade"
          src={`${matomoUrl}/matomo.php?idsite=${matomoSiteId}&url=${window.location.origin}${
            location.pathname
          }&rec=1&_cvar={"1":["graph", "${url || "local"}"]}`}
          style={{ border: 0 }}
          alt=""
        />
      )}
    </>
  );
};

export default Matomo;
