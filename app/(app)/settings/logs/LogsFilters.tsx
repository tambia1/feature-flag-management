"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/app/_components/Select";
import styles from "./LogsFilters.module.css";

type Option = { value: string; label: string };

type Props = {
  people: Option[];
  types: Option[];
  defaultDays: number;
};

export const LogsFilters = ({ people, types, defaultDays }: Props) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set(name, value);
    router.replace(`${pathname}?${params}`);
  };

  return (
    <div className={styles.filters}>
      <Select
        aria-label="Who"
        value={searchParams.get("who") ?? ""}
        onChange={(event) => update("who", event.target.value)}
        options={[{ value: "", label: "Who: anyone" }, ...people.map((person) => ({ ...person, label: `Who: ${person.label}` }))]}
      />
      <Select
        aria-label="Type"
        value={searchParams.get("type") ?? ""}
        onChange={(event) => update("type", event.target.value)}
        options={[{ value: "", label: "Type: all" }, ...types.map((type) => ({ ...type, label: `Type: ${type.label}` }))]}
      />
      <Select
        aria-label="Period"
        value={searchParams.get("days") ?? String(defaultDays)}
        onChange={(event) => update("days", event.target.value)}
        options={[
          { value: "7", label: "Last 7 days" },
          { value: "30", label: "Last 30 days" },
          { value: "90", label: "Last 90 days" },
          { value: "0", label: "All time" },
        ]}
      />
    </div>
  );
};
