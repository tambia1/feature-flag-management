import { Table } from "@/app/_components/Table";
import { formatWhen } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { LogsFilters } from "./LogsFilters";
import styles from "./LogsView.module.css";
import { Text } from "@/app/_components/Text";

type Props = {
  companyId: string;
  query: Record<string, string | string[] | undefined>;
  defaultDays: number;
};

const PAGE_SIZE = 200;

export const LogsView = async ({ companyId, query, defaultDays }: Props) => {
  const who = typeof query.who === "string" ? query.who : "";
  const type = typeof query.type === "string" ? query.type : "";
  const days = Number(typeof query.days === "string" ? query.days : defaultDays) || 0;

  const [people, types, entries] = await Promise.all([
    prisma.log.findMany({
      where: { companyId },
      distinct: ["userId"],
      select: { userId: true, userName: true },
      orderBy: { userId: "asc" },
    }),
    prisma.log.findMany({ where: { companyId }, distinct: ["targetType"], select: { targetType: true } }),
    prisma.log.findMany({
      where: {
        companyId,
        ...(who && { userId: who }),
        ...(type && { targetType: type }),
        ...(days > 0 && { createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } }),
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      select: { id: true, createdAt: true, userName: true, action: true, target: true, change: true, comment: true },
    }),
  ]);

  return (
    <>
      <LogsFilters
        people={people.map((person) => ({ value: person.userId, label: person.userName }))}
        types={types.map((item) => ({ value: item.targetType, label: item.targetType }))}
        defaultDays={defaultDays}
      />
      <Table
        headers={["When", "Who", "Action", "Target", "Change", "Comment"]}
        isEmpty={entries.length === 0}
        emptyText="No log entries for these filters."
      >
        {entries.map((entry) => (
          <tr key={entry.id}>
            <td className={styles.when}>{formatWhen(entry.createdAt)}</td>
            <td>{entry.userName}</td>
            <td>{entry.action}</td>
            <td>{entry.target}</td>
            <td>{entry.change ?? "—"}</td>
            <td>{entry.comment ?? "—"}</td>
          </tr>
        ))}
      </Table>
      {entries.length === PAGE_SIZE && (
        <Text variant="small" color="muted">
          Showing the latest {PAGE_SIZE} entries. Narrow the filters to see older ones.
        </Text>
      )}
    </>
  );
};
