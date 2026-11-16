import type { Metadata } from "next";
import type { JsonValue, Rule } from "@/app/types";
import { isProduction } from "@/lib/environments";
import { getFlagByKey, getProjectContext, searchString } from "@/lib/flags/context";
import { formatValue } from "@/lib/flags/values";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { FlagToggle } from "../_components/FlagToggle";
import { TargetingEditor } from "./_components/TargetingEditor";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Targeting" };

export default async function TargetingPage({ params, searchParams }: PageProps<"/projects/[projectKey]/flags/[flagKey]">) {
  const { projectKey, flagKey } = await params;
  const user = await requireUser();
  const context = await getProjectContext(user, projectKey, searchString((await searchParams).env));

  if (!context) {
    return null;
  }

  const { project, environment, role } = context;
  const flag = await getFlagByKey(project.id, flagKey);

  const [settings, allEnvironments, created] = await Promise.all([
    prisma.flagEnvironment.findUniqueOrThrow({
      where: { flagId_environmentId: { flagId: flag.id, environmentId: environment.id } },
      select: { isOn: true, offVariationId: true, rules: true },
    }),
    prisma.flagEnvironment.findMany({
      where: { flagId: flag.id, environmentId: { in: project.environments.map((item) => item.id) } },
      select: { environmentId: true, isOn: true },
    }),
    prisma.flagHistory.findFirst({
      where: { flagId: flag.id },
      orderBy: { createdAt: "asc" },
      select: { userName: true, createdAt: true },
    }),
  ]);

  const canEdit = role === "EDITOR" && !flag.archivedAt;
  const variations = flag.variations.map((variation) => ({ ...variation, value: variation.value as JsonValue }));
  const offValue = variations.find((variation) => variation.id === settings.offVariationId)?.value ?? null;

  return (
    <div className={styles.layout}>
      <section className={styles.main} aria-label={`Targeting in ${environment.name}`}>
        <div className={`${styles.environment} ${isProduction(environment) ? styles.production : ""}`}>
          <span className={styles.environmentName}>{environment.name}</span>
          <FlagToggle
            flagId={flag.id}
            flagKey={flag.key}
            environmentId={environment.id}
            environmentName={environment.name}
            isOn={settings.isOn}
            isProduction={isProduction(environment)}
            disabled={!canEdit}
            showLabel
          />
        </div>
        {flag.archivedAt && (
          <p className={styles.hint}>This flag is archived: every environment serves the off value. Restore it from Settings.</p>
        )}
        <TargetingEditor
          key={`${environment.id}-${JSON.stringify([settings.offVariationId, settings.rules])}`}
          flagId={flag.id}
          environmentId={environment.id}
          variations={variations}
          initial={{ offVariationId: settings.offVariationId, rules: settings.rules as Rule[] }}
          canEdit={canEdit}
        />
        {role !== "EDITOR" && <p className={styles.hint}>Read-only: you are a viewer in {environment.name}.</p>}
      </section>
      <aside className={styles.side}>
        <h2 className={styles.sideTitle}>All environments</h2>
        <ul className={styles.environments}>
          {project.environments.map((item) => {
            const isOn = allEnvironments.find((row) => row.environmentId === item.id)?.isOn;
            return (
              <li key={item.id} className={styles.environmentRow}>
                <span>{item.name}</span>
                <span className={isOn ? styles.on : styles.off}>{isOn ? "On" : "Off"}</span>
              </li>
            );
          })}
        </ul>
        {created && (
          <p className={styles.meta}>
            Created by {created.userName} ·{" "}
            {created.createdAt.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        )}
        <p className={styles.meta}>In code:</p>
        <code className={styles.code}>
          getFlag(&quot;{flag.key}&quot;, {formatValue(offValue)})
        </code>
      </aside>
    </div>
  );
}
