import React from "react";
import { Tooltip } from "@mui/material";

type InfoTooltipIconProps = {
  title: string;
};

const InfoTooltipIcon: React.FC<InfoTooltipIconProps> = ({ title }) => (
  <Tooltip title={title} enterDelay={200} arrow>
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 16,
        height: 16,
        borderRadius: "50%",
        border: "1px solid currentColor",
        fontSize: "0.65rem",
        lineHeight: 1,
        cursor: "help",
        paddingBottom: 1,
        marginLeft: 4,
      }}
      aria-label="More info"
    >
      i
    </span>
  </Tooltip>
);

export default InfoTooltipIcon;
