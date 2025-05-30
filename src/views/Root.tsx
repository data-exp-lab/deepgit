import React, { FC } from "react";
import { Route } from "react-router";
import { HashRouter, Navigate, Routes } from "react-router-dom";

import GraphView from "./GraphView";
import HomeView from "./HomeView";
import TopicHistogram from "./TopicHistogram"; // Updated import name
import Notifications from "./Notifications";

const Root: FC = () => {
  return (
    <>
      <HashRouter>
        <Routes>
          <Route path="/" element={<HomeView />} />
          <Route path="/topics" element={<TopicHistogram />} /> {/* Updated route path */}
          <Route path="/embed" element={<GraphView embed />} />
          <Route path="/graph" element={<GraphView />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </HashRouter>
      <Notifications />
    </>
  );
};

export default Root;