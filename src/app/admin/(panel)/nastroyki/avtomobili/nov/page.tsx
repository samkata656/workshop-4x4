import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/ui";
import { VehicleForm } from "@/components/admin/vehicle-form";

export const metadata: Metadata = { title: "Нов автомобил" };

// The (panel) layout and the proxy already require a session; the form's
// server action checks it again on submit.
export default function NewVehiclePage() {
  return (
    <>
      <p className="label">
        <Link href="/admin/nastroyki/avtomobili" className="hover:text-paper">
          ← Автомобили
        </Link>
      </p>
      <div className="mt-4">
        <PageHeader index="05" section="Автомобили" title="Нов автомобил" />
      </div>
      <div className="mt-10">
        <VehicleForm />
      </div>
    </>
  );
}
