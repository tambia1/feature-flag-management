import styles from "./StatTile.module.css";

type Props = {
  label: string;
  value: number;
  detail?: string;
};

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export const StatTile = ({ label, value, detail }: Props) => {
  return (
    <div className={styles.tile}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{compact.format(value)}</dd>
      {detail && <dd className={styles.detail}>{detail}</dd>}
    </div>
  );
};
