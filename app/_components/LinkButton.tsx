import Link from "next/link";
import { ComponentProps } from "react";
import type { ButtonColor } from "./Button";
import styles from "./LinkButton.module.css";

type Props = ComponentProps<typeof Link> & {
  variant: "solid" | "outline" | "link";
  color?: ButtonColor;
};

export const LinkButton = ({ variant, color = "accent", className = "", ...props }: Props) => {
  return <Link className={`${styles[variant]} ${styles[color]} ${className}`} {...props} />;
};
