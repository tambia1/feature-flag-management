"use client";

import { createContext, type ReactNode, use, useSyncExternalStore } from "react";
import type { JsonValue } from "@/app/types";
import { createFlagClient, type FlagClient } from "@/sdk/src";

const FlagsContext = createContext<FlagClient | null>(null);

let shared: { userKey: string; client: FlagClient } | null = null;

const clientFor = (userKey: string): FlagClient | null => {
  const sdkKey = process.env.NEXT_PUBLIC_FLAGS_SDK_KEY;

  if (typeof window === "undefined" || !sdkKey) {
    return null;
  }

  if (shared?.userKey !== userKey) {
    shared?.client.close();
    shared = {
      userKey,
      client: createFlagClient({
        baseUrl: process.env.NEXT_PUBLIC_FLAGS_BASE_URL ?? "",
        sdkKey,
        context: { key: userKey },
        application: "Feature Flag Management",
      }),
    };
  }

  return shared.client;
};

type Props = {
  userKey: string;
  children: ReactNode;
};

export const FlagsProvider = ({ userKey, children }: Props) => {
  return <FlagsContext value={clientFor(userKey)}>{children}</FlagsContext>;
};

const noop = () => {};

export const useFlag = <T extends JsonValue>(key: string, fallback: T): T => {
  const client = use(FlagsContext);

  return useSyncExternalStore(
    (onChange) => (client ? client.onChange(onChange) : noop),
    () => (client ? client.getFlag(key, fallback) : fallback),
    () => fallback,
  );
};
