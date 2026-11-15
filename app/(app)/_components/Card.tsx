import { ReactNode } from "react";
import styles from "./Card.module.css";

type Props = {
  title?: string;
  tone?: "normal" | "danger";
  children: ReactNode;
};

/** A bordered panel, e.g. the "Add user" form or the danger zone. */
export const Card = ({ title, tone = "normal", children }: Props) => {
  return (
    <section className={`${styles.card} ${styles[tone]}`}>
      {title && <h2 className={styles.title}>{title}</h2>}
      {children}
    </section>
  );
};
