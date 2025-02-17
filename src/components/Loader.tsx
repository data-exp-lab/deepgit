import { FC } from "react";

export const Loader: FC = () => {
  return (
    <div className="spinner-border" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
  );
};

export const LoaderFill: FC = () => {
  return (
    <div className="fill flex-centered">
      <Loader />
    </div>
  );
};
