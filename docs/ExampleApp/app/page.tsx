"use client";

import { useEffect, useState } from "react";
import { createFlagClient } from "@feature-flags/sdk";

export default function Home() {
  const [value, setValue] = useState(false);

  useEffect(() => {
    const client = createFlagClient({
      baseUrl: process.env.NEXT_PUBLIC_FLAGS_BASE_URL ?? "",
      sdkKey: process.env.NEXT_PUBLIC_FLAGS_SDK_KEY ?? "",
      context: { key: "example-user", country: "IL", email: "example-user@company.com" },
      application: "example-app",
    });

    const update = () => setValue(client.getFlag("test", false));
    const unsubscribe = client.onChange(update);
    update();

    return () => {
      unsubscribe();
      client.close();
    };
  }, []);

  return <p>test: {String(value)}</p>;
}
