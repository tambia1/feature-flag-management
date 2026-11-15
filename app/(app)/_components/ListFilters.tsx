"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Input } from "@/app/_components/Input";
import { Select } from "@/app/_components/Select";
import styles from "./ListFilters.module.css";

type Props = {
  withStatus?: boolean;
  placeholder?: string;
};

/** Search and status filter, kept in the URL so they survive reload and can be shared. */
export const ListFilters = ({ withStatus = true, placeholder = "Search by key or name" }: Props) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  const update = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams);

    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }

    router.replace(`${pathname}?${params}`);
  };

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const changeSearch = (value: string) => {
    setSearch(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => update("search", value), 250);
  };

  return (
    <div className={styles.filters} role="search">
      <Input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={search}
        onChange={(event) => changeSearch(event.target.value)}
        className={styles.search}
      />
      {withStatus && (
        <Select
          aria-label="Status"
          value={searchParams.get("status") ?? ""}
          onChange={(event) => update("status", event.target.value)}
          options={[
            { value: "", label: "Status: all" },
            { value: "on", label: "Status: on" },
            { value: "off", label: "Status: off" },
          ]}
        />
      )}
    </div>
  );
};
