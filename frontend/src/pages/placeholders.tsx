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

export function TemplateHistoryPage() {
  return (
    <Placeholder
      title="Template history"
      subtitle="Previous versions of standard estimate templates."
      breadcrumb={[{ label: "Catalog" }, { label: "Template history" }]}
    />
  );
}

