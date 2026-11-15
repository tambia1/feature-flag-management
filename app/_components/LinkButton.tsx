import Link from "next/link";
import { ComponentProps } from "react";
import styles from "./LinkButton.module.css";

type Props = ComponentProps<typeof Link> & {
  variant: "primary" | "secondary" | "link";
};

export const LinkButton = ({ variant, className = "", ...props }: Props) => {
  return <Link className={`${styles[variant]} ${className}`} {...props} />;
};
