import type { Metadata } from "next";
import type { JsonValue } from "@/app/types";
import { ConfirmAction } from "@/app/_components/ConfirmAction";
import { getFlagByKey, getProjectContext, searchString } from "@/lib/flags/context";
import { FLAG_TYPES } from "@/lib/flags/values";
import { requireUser } from "@/lib/session";
import { Card } from "../../../../../_components/Card";
import { archiveFlag, deleteFlag, restoreFlag } from "../../actions";
import { FlagSettingsForm } from "./FlagSettingsForm";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Flag settings" };

export default async function FlagSettingsPage({ params, searchParams }: PageProps<"/projects/[projectKey]/flags/[flagKey]/settings">) {
  const { projectKey, flagKey } = await params;
  const user = await requireUser();
  const context = await getProjectContext(user, projectKey, searchString((await searchParams).env));

  if (!context) {
    return null;
  }

  const flag = await getFlagByKey(context.project.id, flagKey);
  const canEdit = context.canEditFlags;

  return (
    <div className={styles.settings}>
      <div className={styles.main}>
        <FlagSettingsForm
          flagId={flag.id}
          flagKey={flag.key}
          typeLabel={FLAG_TYPES.find((type) => type.value === flag.type)?.label ?? flag.type}
          isBoolean={flag.type === "BOOLEAN"}
          name={flag.name}
          description={flag.description}
          variations={flag.variations.map((variation) => ({ ...variation, value: variation.value as JsonValue }))}
          canEdit={canEdit && !flag.archivedAt}
        />
      </div>
      <Card title="Danger zone" tone="danger">
        {flag.archivedAt ? (
          <>
            <div className={styles.action}>
              <ConfirmAction
                action={restoreFlag}
                fields={{ flagId: flag.id }}
                triggerLabel="Restore flag"
                triggerVariant="secondary"
                title="Restore flag?"
                text={`"${flag.key}" goes back in the flag list, OFF in every environment.`}
                confirmLabel="Restore"
                danger={false}
                disabled={!canEdit}
              />
            </div>
            <div className={styles.action}>
              <ConfirmAction
                action={deleteFlag}
                fields={{ flagId: flag.id, from: "settings" }}
                triggerLabel="Delete flag"
                triggerVariant="danger"
                title="Delete flag?"
                text={`This permanently deletes "${flag.key}" and its history.\nApps get the fallback value from their code.\nThis can't be undone.`}
                confirmLabel="Delete flag"
                disabled={!canEdit}
              />
            </div>
          </>
        ) : (
          <>
            <div className={styles.action}>
              <ConfirmAction
                action={archiveFlag}
                fields={{ flagId: flag.id }}
                triggerLabel="Archive flag"
                triggerVariant="danger"
                title="Archive flag?"
                text={`"${flag.key}" is hidden from the flag list and every environment serves the off value. You can restore it later.`}
                confirmLabel="Archive"
                disabled={!canEdit}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
