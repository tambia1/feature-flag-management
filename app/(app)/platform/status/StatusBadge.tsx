import type { ServiceState } from "@/app/types";
import styles from "./StatusBadge.module.css";

type Props = {
  state: ServiceState;
  text: string;
};

export const StatusBadge = ({ state, text }: Props) => {
  return <span className={`${styles.badge} ${styles[state]}`}>{text}</span>;
};
