import { HTMLAttributes } from "react";
import styles from "./Text.module.css";

type TextVariant = "title" | "heading" | "subheading" | "label" | "body" | "small" | "caption" | "plain";
type TextColor = "inherit" | "muted" | "accent" | "danger" | "success";
type TextTag = "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div" | "li";

type Props = HTMLAttributes<HTMLElement> & {
  variant: TextVariant;
  color?: TextColor;
  as?: TextTag;
};

const tags: Record<TextVariant, TextTag> = {
  title: "h1",
  heading: "h2",
  subheading: "h3",
  label: "span",
  body: "p",
  small: "p",
  caption: "span",
  plain: "span",
};

export const Text = ({ variant, color = "inherit", as, className = "", ...props }: Props) => {
  const Tag = as ?? tags[variant];

  return <Tag className={`${styles[variant]} ${styles[color]} ${className}`} {...props} />;
};
