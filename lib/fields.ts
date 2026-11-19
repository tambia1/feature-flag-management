import { z } from "zod";
import { KEY_PATTERN } from "./flags/values";

export const nameField = (label: string) => z.string().trim().min(1, `Enter ${label}`).max(100);

export const keyField = (example: string) =>
  z.string().regex(KEY_PATTERN, `Key: lowercase letters, numbers and dashes, e.g. ${example}`).max(64);
