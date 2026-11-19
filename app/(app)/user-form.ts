import "server-only";
import { text } from "@/lib/actions";
import type { UserInput } from "@/lib/company-users";

export const readUserForm = (formData: FormData): UserInput => ({
  name: text(formData, "name"),
  email: text(formData, "email"),
  role: text(formData, "role"),
  password: String(formData.get("password") ?? ""),
});
