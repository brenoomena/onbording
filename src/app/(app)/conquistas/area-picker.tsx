"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";

/** Escolha da área do ranking (para quem acompanha todas). */
export function AreaPicker({ areas, value, myArea, total }: { areas: { id: string; name: string }[]; value: string | null; myArea: string | null; total: boolean }) {
  const router = useRouter();
  return (
    <Select
      aria-label="Área do ranking"
      value={value ?? ""}
      onChange={(e) => {
        const u = new URLSearchParams();
        if (total) u.set("periodo", "total");
        if (e.target.value && e.target.value !== myArea) u.set("area", e.target.value);
        const s = u.toString();
        router.push(`/conquistas${s ? `?${s}` : ""}`);
      }}
      className="w-auto py-1 text-[13px]"
    >
      {!value && <option value="">Escolha a área</option>}
      {areas.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </Select>
  );
}
