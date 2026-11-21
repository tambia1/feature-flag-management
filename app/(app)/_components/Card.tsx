import { ReactNode } from "react";
import styles from "./Card.module.css";
import { Text } from "@/app/_components/Text";

type Props = {
  title?: string;
  tone?: "normal" | "danger";
  children: ReactNode;
};

export const Card = ({ title, tone = "normal", children }: Props) => {
  return (
    <section className={`${styles.card} ${styles[tone]}`}>
      {title && (
        <Text variant="subheading" as="h2" color={tone === "danger" ? "danger" : "inherit"}>
          {title}
        </Text>
      )}
      {children}
    </section>
  );
};
