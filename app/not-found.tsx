import { LinkButton } from "./_components/LinkButton";
import styles from "./error.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Page not found</h1>
      <p className={styles.text}>This page doesn&apos;t exist, or it was deleted.</p>
      <LinkButton href="/" variant="solid">
        Go to flags
      </LinkButton>
    </main>
  );
}
