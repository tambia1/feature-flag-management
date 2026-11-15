import Link from "next/link";
import { ComponentProps } from "react";
import styles from "./LinkButton.module.css";

type Props = ComponentProps<typeof Link> & {
  variant: "primary" | "secondary" | "link";
};

/** A link that looks like a Button, for actions that navigate (e.g. "+ New flag"). */
export const LinkButton = ({ variant, className = "", ...props }: Props) => {
  return <Link className={`${styles[variant]} ${className}`} {...props} />;
};
