import styles from "./Loading.module.css";

export const Loading = () => {
  return (
    <p className={styles.loading} role="status">
      Loading…
    </p>
  );
};
