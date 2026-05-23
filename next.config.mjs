/** @type {import('next').NextConfig} */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const securityHeaders = [
  // HSTS: forzar HTTPS por 2 años con subdomains
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // No permitir embedding en iframes (clickjacking)
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  // No sniffear MIME types
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // Referrer: solo origen cuando cruza dominios
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // Deshabilitar features innecesarias
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // CSP: política estricta adaptada a Next.js + Supabase
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // Next.js requiere unsafe-inline para hydration
      "style-src 'self' 'unsafe-inline'",   // Tailwind requiere inline styles
      `connect-src 'self' ${supabaseUrl} https://api.resend.com https://apiperu.dev`,
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig = {
  // Security headers en todas las rutas
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // Imágenes: solo dominios permitidos
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
    ],
  },

  // Logging de errores del servidor sin datos de usuario
  logging: {
    fetches: {
      fullUrl: false,
    },
  },

  experimental: {
    // Permitir paquetes de servidor en Server Components
    serverComponentsExternalPackages: ["@supabase/supabase-js"],
  },
};

export default nextConfig;
