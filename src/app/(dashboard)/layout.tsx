/**
 * Layout del dashboard — Kivo
 *
 * Incluye sidebar de navegación y header.
 * Los componentes de navegación se implementan en pasos posteriores.
 * Por ahora provee la estructura base.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — se implementa en Paso 4+ */}
      <aside className="hidden w-64 border-r bg-card lg:block">
        <div className="flex h-16 items-center border-b px-6">
          <span className="text-xl font-bold text-primary">Kivo</span>
        </div>
        <nav className="p-4">
          <p className="text-xs text-muted-foreground">Navegación en paso 4+</p>
        </nav>
      </aside>

      {/* Contenido principal */}
      <div className="flex flex-1 flex-col">
        {/* Header — se implementa en Paso 4+ */}
        <header className="flex h-16 items-center border-b px-6">
          <p className="text-sm text-muted-foreground">Header en paso 4+</p>
        </header>

        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
