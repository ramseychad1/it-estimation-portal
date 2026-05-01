import { useEffect } from "react";
import { ComingSoon, PageHeader, type BreadcrumbItem } from "../components/PageHeader";

interface PlaceholderProps {
  title: string;
  subtitle: string;
  breadcrumb?: BreadcrumbItem[];
}

function Placeholder({ title, subtitle, breadcrumb }: PlaceholderProps) {
  useEffect(() => {
    document.title = `${title} — Estimator`;
  }, [title]);

  return (
    <>
      <PageHeader breadcrumb={breadcrumb} title={title} subtitle={subtitle} />
      <ComingSoon />
    </>
  );
}

export function DashboardPage() {
  return (
    <Placeholder
      title="Dashboard"
      subtitle="Your activity at a glance."
      breadcrumb={[{ label: "Workspace" }, { label: "Dashboard" }]}
    />
  );
}

export function RequestsPage() {
  return (
    <Placeholder
      title="Estimate requests"
      subtitle="Track requests in flight and waiting on you."
      breadcrumb={[{ label: "Workspace" }, { label: "Estimate requests" }]}
    />
  );
}

export function ProductsPage() {
  return (
    <Placeholder
      title="Products"
      subtitle="The catalog of products and sub-features available to estimate."
      breadcrumb={[{ label: "Catalog" }, { label: "Products" }]}
    />
  );
}

export function CriticalQuestionsPage() {
  return (
    <Placeholder
      title="Critical questions"
      subtitle="Questions attached to products that change the shape of an estimate."
      breadcrumb={[{ label: "Catalog" }, { label: "Critical questions" }]}
    />
  );
}

export function TemplateHistoryPage() {
  return (
    <Placeholder
      title="Template history"
      subtitle="Previous versions of standard estimate templates."
      breadcrumb={[{ label: "Catalog" }, { label: "Template history" }]}
    />
  );
}

