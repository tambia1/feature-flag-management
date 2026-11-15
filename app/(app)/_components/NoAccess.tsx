import { Lock } from "lucide-react";
import { EmptyState } from "@/app/_components/EmptyState";

export const NoAccess = () => {
  return (
    <EmptyState
      icon={Lock}
      title="You don't have access to this project's flags"
      text="Ask your company admin to add you to a team that has a role in this project."
    />
  );
};
