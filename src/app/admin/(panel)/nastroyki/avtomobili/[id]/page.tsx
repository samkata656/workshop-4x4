import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/admin/ui";
import { VehicleForm } from "@/components/admin/vehicle-form";
import { getVehicleForAdmin } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Автомобил" };

type Params = Promise<{ id: string }>;

export default function VehiclePage({ params }: { params: Params }) {
  return (
    <>
      <p className="label">
        <Link href="/admin/nastroyki/avtomobili" className="hover:text-paper">
          ← Автомобили
        </Link>
      </p>
      <Suspense fallback={<div className="skeleton mt-6 h-[60vh]" aria-label="Зареждане" />}>
        <VehicleEditor params={params} />
      </Suspense>
    </>
  );
}

async function VehicleEditor({ params }: { params: Params }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const vehicle = await getVehicleForAdmin(id);
  if (!vehicle) notFound();

  return (
    <>
      <div className="mt-4">
        <PageHeader index="05" section="Автомобил" title={`${vehicle.model} ${vehicle.generation}`}>
          <span className={`badge ${vehicle.verified ? "" : "badge-warn"}`}>{vehicle.verified ? "Проверен" : "Непроверен"}</span>
        </PageHeader>
      </div>
      <p className="mt-3 font-mono text-xs text-muted">
        Добавен от: {vehicle.createdBy === "AI" ? "AI" : vehicle.createdBy === "seed" ? "началните данни" : "админ"}
      </p>
      <div className="mt-10">
        <VehicleForm vehicle={vehicle} />
      </div>
    </>
  );
}
