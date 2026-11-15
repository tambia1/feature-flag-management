import { EmptyState } from "@/app/_components/EmptyState";

/** Shown on flag pages when you have no role in any environment of the project — admins included. */
export const NoAccess = () => {
  return (
    <EmptyState
      icon="⚑"
      title="You don't have access to this project's flags"
      text="Ask your company admin to add you to a team that has a role in this project."
    />
  );
};
