"use client";

import { Button, EmptyState } from "@/components/ui";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState title="Algo deu errado ao carregar esta página" action={<Button onClick={reset}>Tentar de novo</Button>}>
      Se o problema continuar, avise o administrador da plataforma.
    </EmptyState>
  );
}
