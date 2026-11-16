import { Tabs } from "@/app/_components/Tabs";
import { Page } from "../../_components/Page";

export default function DashboardLayout({ children }: LayoutProps<"/settings/dashboard">) {
  return (
    <Page title="Dashboard">
      <Tabs
        label="Dashboard"
        tabs={[
          { href: "/settings/dashboard", label: "Statistics" },
          { href: "/settings/dashboard/graph", label: "Graph" },
        ]}
      />
      {children}
    </Page>
  );
}
