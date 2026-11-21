import { LinkButton } from "./_components/LinkButton";
import styles from "./error.module.css";
import { Text } from "./_components/Text";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <Text variant="title">Page not found</Text>
      <Text variant="body" color="muted">
        This page doesn&apos;t exist, or it was deleted.
      </Text>
      <LinkButton href="/" variant="solid">
        Go to flags
      </LinkButton>
    </main>
  );
}
