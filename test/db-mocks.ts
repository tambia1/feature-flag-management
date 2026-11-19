import { afterEach, vi } from "vitest";
import { signInAs, signedInUserId } from "./session";

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: async () => {
        const id = signedInUserId();
        return id ? { user: { id } } : null;
      },
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("next/cache", () => ({
  refresh: () => {},
  revalidatePath: () => {},
}));

afterEach(() => signInAs(null));
