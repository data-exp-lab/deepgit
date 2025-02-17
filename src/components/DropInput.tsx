import cx from "classnames";
import React, { FC } from "react";
import { useDropzone } from "react-dropzone";
import { FaTimes } from "react-icons/fa";

import { Loaders } from "../lib/data";

const DropInput: FC<{ value: File | null; onChange: (file: File | null) => void }> = ({ value, onChange }) => {
  const { getRootProps, getInputProps } = useDropzone({
    maxFiles: 1,
    accept: {
      "application/graph": Object.keys(Loaders).map((s) => "." + s),
    },
    onDrop: (acceptedFiles) => {
      const value = acceptedFiles[0] || null;
      onChange(value);
    },
  });

  return (
    <div {...getRootProps()} className="dropzone">
      <input {...getInputProps()} />
      <p>{value ? value.name : "Drag and drop a graph file here, or click to select a file"}</p>

      <p className="text-center">
        <button
          type="button"
          className={cx("btn btn-outline-dark", !value && "hidden")}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onChange(null);
          }}
        >
          <FaTimes /> Clear
        </button>
      </p>
    </div>
  );
};

export default DropInput;
