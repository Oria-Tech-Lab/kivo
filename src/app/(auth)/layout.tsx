/**
 * Layout para rutas de autenticación.
 * No incluye sidebar ni navegación — pantalla limpia.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary/5 to-muted/20">
      {children}
    </main>
  );
}
