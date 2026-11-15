"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/app/_components/Select";

type Props = {
  environments: { value: string; label: string }[];
};

export const HistoryFilter = ({ environments }: Props) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const change = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete("entry");

    if (value) {
      params.set("history", value);
    } else {
      params.delete("history");
    }

    router.replace(`${pathname}?${params}`);
  };

  return (
    <Select
      aria-label="Environment"
      value={searchParams.get("history") ?? ""}
      onChange={(event) => change(event.target.value)}
      options={[
        { value: "", label: "Environment: all" },
        ...environments.map((item) => ({ ...item, label: `Environment: ${item.label}` })),
      ]}
    />
  );
};
