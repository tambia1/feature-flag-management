"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createFlagClient } from "@feature-flags/sdk";

const USER_KEY_STORAGE = "user-id";

const newUserKey = () => `user-id-${Math.floor(1000 + Math.random() * 9000)}`;

const readOrCreateUserKey = (): string => {
  try {
    const saved = localStorage.getItem(USER_KEY_STORAGE);

    if (saved) {
      return saved;
    }

    const key = newUserKey();
    localStorage.setItem(USER_KEY_STORAGE, key);
    return key;
  } catch {
    return newUserKey();
  }
};

let visitorUserKey: string | null = null;

const getVisitorUserKey = () => (visitorUserKey ??= readOrCreateUserKey());
const getServerUserKey = () => "";
const subscribe = () => () => {};

export default function Home() {
  const [value, setValue] = useState(false);
  const userKey = useSyncExternalStore(subscribe, getVisitorUserKey, getServerUserKey);

  useEffect(() => {
    if (!userKey) {
      return;
    }

    const client = createFlagClient({
      baseUrl: process.env.NEXT_PUBLIC_FLAGS_BASE_URL ?? "",
      envSdkKey: process.env.NEXT_PUBLIC_FLAGS_ENV_SDK_KEY ?? "",
      context: { key: userKey, country: "IL", email: "example-user@company.com" },
      applicationName: "example-app",
    });

    const update = () => setValue(client.getFlag("test", false));
    const unsubscribe = client.onChange(update);
    update();

    return () => {
      unsubscribe();
      client.close();
    };
  }, [userKey]);

  return (
    <>
      <p>user: {userKey}</p>
      <p>test: {String(value)}</p>
    </>
  );
}
