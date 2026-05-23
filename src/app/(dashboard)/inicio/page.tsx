import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inicio",
};

/**
 * Pantalla de inicio — M7 Dashboard & Alertas
 * Se implementa completo en el Paso 9 (Alertas in-app).
 */
export default function InicioPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Buenos días</h1>
        <p className="text-muted-foreground">
          Aquí verás las alertas y acciones del día.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* MetricCards — se implementan en Paso 9 */}
        {["Por cobrar", "Por pagar", "Alertas activas", "Flujo neto"].map((label) => (
          <div key={label} className="rounded-lg border bg-card p-6 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tabular-nums">—</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 font-semibold">Alertas pendientes</h2>
        <p className="text-sm text-muted-foreground">
          Las alertas se mostrarán aquí en el Paso 9.
        </p>
      </div>
    </div>
  );
}
