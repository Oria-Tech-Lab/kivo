/**
 * Tipos generados de Supabase — Kivo
 *
 * Este archivo se genera automáticamente con:
 *   npx supabase gen types typescript --project-id jpgkakyxbwuoqyphjqdo > src/types/supabase.ts
 *
 * Mientras no tengamos el schema completo en Supabase, usamos este stub
 * que permite que los clientes compileen con TypeScript.
 *
 * Se reemplazará completamente en el Paso 3 (Schema SQL + RLS).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          nombre: string
          ruc: string
          plan: string
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          ruc: string
          plan?: string
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          ruc?: string
          plan?: string
          created_at?: string
        }
      }
      organization_users: {
        Row: {
          org_id: string
          user_id: string
          rol: string
        }
        Insert: {
          org_id: string
          user_id: string
          rol: string
        }
        Update: {
          org_id?: string
          user_id?: string
          rol?: string
        }
      }
      clientes: {
        Row: {
          id: string
          org_id: string
          nombre: string
          ruc: string | null
          contacto_nombre: string | null
          contacto_email: string | null
          contacto_telefono: string | null
          estado: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          nombre: string
          ruc?: string | null
          contacto_nombre?: string | null
          contacto_email?: string | null
          contacto_telefono?: string | null
          estado?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          nombre?: string
          ruc?: string | null
          contacto_nombre?: string | null
          contacto_email?: string | null
          contacto_telefono?: string | null
          estado?: string
          updated_at?: string
        }
      }
      proyectos: {
        Row: {
          id: string
          org_id: string
          cliente_id: string
          nombre: string
          tipo: string
          categoria_id: string | null
          estado: string
          responsable_id: string | null
          fecha_inicio: string
          fecha_cierre_est: string | null
          aplica_detraccion: boolean
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          cliente_id: string
          nombre: string
          tipo: string
          categoria_id?: string | null
          estado?: string
          responsable_id?: string | null
          fecha_inicio: string
          fecha_cierre_est?: string | null
          aplica_detraccion?: boolean
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          cliente_id?: string
          nombre?: string
          tipo?: string
          categoria_id?: string | null
          estado?: string
          responsable_id?: string | null
          fecha_inicio?: string
          fecha_cierre_est?: string | null
          aplica_detraccion?: boolean
          notas?: string | null
          updated_at?: string
        }
      }
      proveedores: {
        Row: {
          id: string
          org_id: string
          ruc: string
          razon_social: string
          nombre_comercial: string | null
          tipo: string
          actividad: string | null
          aplica_detraccion: boolean
          pct_detraccion: number
          condicion_pago: string | null
          cuenta_banco_enc: string | null
          cuenta_spot_enc: string | null
          email: string | null
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          ruc: string
          razon_social: string
          nombre_comercial?: string | null
          tipo: string
          actividad?: string | null
          aplica_detraccion?: boolean
          pct_detraccion?: number
          condicion_pago?: string | null
          cuenta_banco_enc?: string | null
          cuenta_spot_enc?: string | null
          email?: string | null
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          ruc?: string
          razon_social?: string
          nombre_comercial?: string | null
          tipo?: string
          actividad?: string | null
          aplica_detraccion?: boolean
          pct_detraccion?: number
          condicion_pago?: string | null
          cuenta_banco_enc?: string | null
          cuenta_spot_enc?: string | null
          email?: string | null
          notas?: string | null
          updated_at?: string
        }
      }
      presupuestos: {
        Row: {
          id: string
          proyecto_id: string
          version: number
          estado: string
          condicion_pago: string
          fecha_aprobacion: string | null
          subtotal: number
          igv_total: number
          total: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          proyecto_id: string
          version?: number
          estado?: string
          condicion_pago: string
          fecha_aprobacion?: string | null
          subtotal?: number
          igv_total?: number
          total?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          proyecto_id?: string
          version?: number
          estado?: string
          condicion_pago?: string
          fecha_aprobacion?: string | null
          subtotal?: number
          igv_total?: number
          total?: number
          updated_at?: string
        }
      }
      lineas_presupuesto: {
        Row: {
          id: string
          presupuesto_id: string
          concepto: string
          subtotal: number
          igv: number
          total: number
          pct_fee: number | null
        }
        Insert: {
          id?: string
          presupuesto_id: string
          concepto: string
          subtotal: number
          igv?: number
          total?: number
          pct_fee?: number | null
        }
        Update: {
          id?: string
          presupuesto_id?: string
          concepto?: string
          subtotal?: number
          igv?: number
          total?: number
          pct_fee?: number | null
        }
      }
      gastos: {
        Row: {
          id: string
          proyecto_id: string
          linea_presupuesto_id: string | null
          proveedor_id: string
          concepto: string
          tipo_comprobante: string
          serie: string | null
          numero_doc: string | null
          subtotal: number
          igv: number
          total: number
          aplica_detraccion: boolean
          pct_detraccion: number
          monto_detraccion: number
          neto_a_pagar: number
          retencion_4ta: number
          adjunto_url: string | null
          fecha_comprobante: string
          fecha_vencimiento_pago: string | null
          estado_pago: string
          fecha_pago_real: string | null
          estado_detraccion: string
          fecha_deposito_detraccion: string | null
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          proyecto_id: string
          linea_presupuesto_id?: string | null
          proveedor_id: string
          concepto: string
          tipo_comprobante: string
          serie?: string | null
          numero_doc?: string | null
          subtotal: number
          igv?: number
          total?: number
          aplica_detraccion?: boolean
          pct_detraccion?: number
          monto_detraccion?: number
          neto_a_pagar?: number
          retencion_4ta?: number
          adjunto_url?: string | null
          fecha_comprobante: string
          fecha_vencimiento_pago?: string | null
          estado_pago?: string
          fecha_pago_real?: string | null
          estado_detraccion?: string
          fecha_deposito_detraccion?: string | null
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          [key: string]: Json | undefined
        }
      }
      gastos_generales: {
        Row: {
          id: string
          org_id: string
          proveedor_id: string | null
          concepto: string
          tipo_recurrencia: string
          monto: number
          periodo_mes: number | null
          periodo_anio: number | null
          tipo_comprobante: string | null
          igv: number
          total: number
          adjunto_url: string | null
          umbral_proyectos: number
          estado: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          proveedor_id?: string | null
          concepto: string
          tipo_recurrencia: string
          monto: number
          periodo_mes?: number | null
          periodo_anio?: number | null
          tipo_comprobante?: string | null
          igv?: number
          total?: number
          adjunto_url?: string | null
          umbral_proyectos?: number
          estado?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          [key: string]: Json | undefined
        }
      }
      asignaciones_gg: {
        Row: {
          id: string
          gasto_general_id: string
          proyecto_id: string
          monto: number
          pct: number | null
          fecha: string
        }
        Insert: {
          id?: string
          gasto_general_id: string
          proyecto_id: string
          monto: number
          pct?: number | null
          fecha: string
        }
        Update: {
          [key: string]: Json | undefined
        }
      }
      movimientos_caja: {
        Row: {
          id: string
          org_id: string
          tipo: string
          origen_tabla: string
          origen_id: string
          proyecto_id: string | null
          cliente_id: string | null
          proveedor_id: string | null
          concepto: string
          monto: number
          fecha_esperada: string
          fecha_real: string | null
          estado: string
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          tipo: string
          origen_tabla: string
          origen_id: string
          proyecto_id?: string | null
          cliente_id?: string | null
          proveedor_id?: string | null
          concepto: string
          monto: number
          fecha_esperada: string
          fecha_real?: string | null
          estado?: string
          created_at?: string
        }
        Update: {
          [key: string]: Json | undefined
        }
      }
      alertas: {
        Row: {
          id: string
          org_id: string
          tipo: string
          nivel: string
          referencia_tabla: string | null
          referencia_id: string | null
          mensaje: string
          fecha_generada: string
          fecha_visto: string | null
          resuelto: boolean
        }
        Insert: {
          id?: string
          org_id: string
          tipo: string
          nivel: string
          referencia_tabla?: string | null
          referencia_id?: string | null
          mensaje: string
          fecha_generada?: string
          fecha_visto?: string | null
          resuelto?: boolean
        }
        Update: {
          [key: string]: Json | undefined
        }
      }
      audit_log: {
        Row: {
          id: string
          org_id: string
          user_id: string
          tabla: string
          registro_id: string
          accion: string
          datos_antes: Json | null
          datos_des: Json | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          tabla: string
          registro_id: string
          accion: string
          datos_antes?: Json | null
          datos_des?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          [key: string]: Json | undefined
        }
      }
    }
    Views: Record<string, never>
    Functions: {
      get_user_org_id: {
        Args: Record<string, never>
        Returns: string
      }
      get_user_rol: {
        Args: Record<string, never>
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
