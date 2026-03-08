import { SupplierPortals } from "@/components/procurement/SupplierPortals";

export const metadata = { title: "Inköp" };

export default function InkopPage({
  searchParams,
}: {
  searchParams: { q?: string; supplier?: string };
}) {
  return (
    <SupplierPortals
      initialQuery={searchParams.q ?? ""}
      initialSupplier={searchParams.supplier ?? ""}
    />
  );
}
