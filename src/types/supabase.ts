/**
 * Tipos generados del schema Supabase — Kivo
 * Basados en supabase/migrations/001_initial_schema.sql
 *
 * Para regenerar cuando cambie el schema:
 *   SUPABASE_ACCESS_TOKEN=<token> npx supabase gen types typescript \
 *     --project-id jpgkakyxbwuoqyphjqdo > src/types/supabase.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          nombre: string
          ruc: string
          plan: 'free' | 'pro' | 'enterprise'
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          ruc: string
          plan?: 'free' | 'pro' | 'enterprise'
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          ruc?: string
          plan?: 'free' | 'pro' | 'enterprise'
          created_at?: string
        }
        Relationships: []
      }
      organization_users: {
        Row: {
          org_id: string
          user_id: string
          rol: 'admin' | 'pm' | 'viewer'
        }
        Insert: {
          org_id: string
          user_id: string
          rol: 'admin' | 'pm' | 'viewer'
        }
        Update: {
          org_id?: string
          user_id?: string
          rol?: 'admin' | 'pm' | 'viewer'
        }
        Relationships: [
          {
            foreignKeyName: 'organization_users_org_id_fkey'
            columns: ['org_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      categorias: {
        Row: {
          id: string
          org_id: string
          nombre: string
          tipo: 'digital' | 'offline' | 'evento' | 'instalacion' | 'otro' | null
          color: string | null
        }
        Insert: {
          id?: string
          org_id: string
          nombre: string
          tipo?: 'digital' | 'offline' | 'evento' | 'instalacion' | 'otro' | null
          color?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          nombre?: string
          tipo?: 'digital' | 'offline' | 'evento' | 'instalacion' | 'otro' | null
          color?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'categorias_org_id_fkey'
            columns: ['org_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
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
          estado: 'activo' | 'inactivo'
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
          estado?: 'activo' | 'inactivo'
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
          estado?: 'activo' | 'inactivo'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'clientes_org_id_fkey'
            columns: ['org_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      proyectos: {
        Row: {
          id: string
          org_id: string
          cliente_id: string
          nombre: string
          tipo: 'digital' | 'offline' | 'evento' | 'instalacion' | 'otro'
          categoria_id: string | null
          estado: 'activo' | 'en_pausa' | 'cerrado'
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
          tipo: 'digital' | 'offline' | 'evento' | 'instalacion' | 'otro'
          categoria_id?: string | null
          estado?: 'activo' | 'en_pausa' | 'cerrado'
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
          tipo?: 'digital' | 'offline' | 'evento' | 'instalacion' | 'otro'
          categoria_id?: string | null
          estado?: 'activo' | 'en_pausa' | 'cerrado'
          responsable_id?: string | null
          fecha_inicio?: string
          fecha_cierre_est?: string | null
          aplica_detraccion?: boolean
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'proyectos_org_id_fkey'
            columns: ['org_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'proyectos_cliente_id_fkey'
            columns: ['cliente_id']
            referencedRelation: 'clientes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'proyectos_categoria_id_fkey'
            columns: ['categoria_id']
            referencedRelation: 'categorias'
            referencedColumns: ['id']
          },
        ]
      }
      proveedores: {
        Row: {
          id: string
          org_id: string
          ruc: string
          razon_social: string
          nombre_comercial: string | null
          tipo: 'persona_natural' | 'persona_juridica'
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
          tipo: 'persona_natural' | 'persona_juridica'
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
          tipo?: 'persona_natural' | 'persona_juridica'
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
        Relationships: [
          {
            foreignKeyName: 'proveedores_org_id_fkey'
            columns: ['org_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      presupuestos: {
        Row: {
          id: string
          proyecto_id: string
          org_id: string
          version: number
          estado: 'borrador' | 'aprobado' | 'rechazado'
          condicion_pago: 'contado' | '30d' | '45d' | 'hitos'
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
          org_id: string
          version?: number
          estado?: 'borrador' | 'aprobado' | 'rechazado'
          condicion_pago: 'contado' | '30d' | '45d' | 'hitos'
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
          org_id?: string
          version?: number
          estado?: 'borrador' | 'aprobado' | 'rechazado'
          condicion_pago?: 'contado' | '30d' | '45d' | 'hitos'
          fecha_aprobacion?: string | null
          subtotal?: number
          igv_total?: number
          total?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'presupuestos_proyecto_id_fkey'
            columns: ['proyecto_id']
            referencedRelation: 'proyectos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'presupuestos_org_id_fkey'
            columns: ['org_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
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
          subtotal?: number
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
        Relationships: [
          {
            foreignKeyName: 'lineas_presupuesto_presupuesto_id_fkey'
            columns: ['presupuesto_id']
            referencedRelation: 'presupuestos'
            referencedColumns: ['id']
          },
        ]
      }
      gastos: {
        Row: {
          id: string
          proyecto_id: string
          org_id: string
          linea_presupuesto_id: string | null
          proveedor_id: string
          concepto: string
          tipo_comprobante: 'factura' | 'boleta' | 'rxh' | 'sin_comprobante'
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
          estado_pago: 'pendiente' | 'pagado'
          fecha_pago_real: string | null
          estado_detraccion: 'pendiente' | 'depositada' | 'no_aplica'
          fecha_deposito_detraccion: string | null
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          proyecto_id: string
          org_id: string
          linea_presupuesto_id?: string | null
          proveedor_id: string
          concepto: string
          tipo_comprobante: 'factura' | 'boleta' | 'rxh' | 'sin_comprobante'
          serie?: string | null
          numero_doc?: string | null
          subtotal: number
          igv?: number
          total: number
          aplica_detraccion?: boolean
          pct_detraccion?: number
          monto_detraccion?: number
          neto_a_pagar: number
          retencion_4ta?: number
          adjunto_url?: string | null
          fecha_comprobante: string
          fecha_vencimiento_pago?: string | null
          estado_pago?: 'pendiente' | 'pagado'
          fecha_pago_real?: string | null
          estado_detraccion?: 'pendiente' | 'depositada' | 'no_aplica'
          fecha_deposito_detraccion?: string | null
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          proyecto_id?: string
          org_id?: string
          linea_presupuesto_id?: string | null
          proveedor_id?: string
          concepto?: string
          tipo_comprobante?: 'factura' | 'boleta' | 'rxh' | 'sin_comprobante'
          serie?: string | null
          numero_doc?: string | null
          subtotal?: number
          igv?: number
          total?: number
          aplica_detraccion?: boolean
          pct_detraccion?: number
          monto_detraccion?: number
          neto_a_pagar?: number
          retencion_4ta?: number
          adjunto_url?: string | null
          fecha_comprobante?: string
          fecha_vencimiento_pago?: string | null
          estado_pago?: 'pendiente' | 'pagado'
          fecha_pago_real?: string | null
          estado_detraccion?: 'pendiente' | 'depositada' | 'no_aplica'
          fecha_deposito_detraccion?: string | null
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'gastos_proyecto_id_fkey'
            columns: ['proyecto_id']
            referencedRelation: 'proyectos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'gastos_org_id_fkey'
            columns: ['org_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'gastos_proveedor_id_fkey'
            columns: ['proveedor_id']
            referencedRelation: 'proveedores'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'gastos_linea_presupuesto_id_fkey'
            columns: ['linea_presupuesto_id']
            referencedRelation: 'lineas_presupuesto'
            referencedColumns: ['id']
          },
        ]
      }
      gastos_generales: {
        Row: {
          id: string
          org_id: string
          proveedor_id: string | null
          concepto: string
          tipo_recurrencia: 'mensual' | 'puntual'
          monto: number
          periodo_mes: number | null
          periodo_anio: number | null
          tipo_comprobante: 'factura' | 'boleta' | 'rxh' | 'sin_comprobante' | null
          igv: number
          total: number
          adjunto_url: string | null
          umbral_proyectos: number
          estado: 'pendiente_asignacion' | 'cubierto_parcial' | 'cubierto' | 'generando_ganancia'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          proveedor_id?: string | null
          concepto: string
          tipo_recurrencia: 'mensual' | 'puntual'
          monto: number
          periodo_mes?: number | null
          periodo_anio?: number | null
          tipo_comprobante?: 'factura' | 'boleta' | 'rxh' | 'sin_comprobante' | null
          igv?: number
          total: number
          adjunto_url?: string | null
          umbral_proyectos?: number
          estado?: 'pendiente_asignacion' | 'cubierto_parcial' | 'cubierto' | 'generando_ganancia'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          proveedor_id?: string | null
          concepto?: string
          tipo_recurrencia?: 'mensual' | 'puntual'
          monto?: number
          periodo_mes?: number | null
          periodo_anio?: number | null
          tipo_comprobante?: 'factura' | 'boleta' | 'rxh' | 'sin_comprobante' | null
          igv?: number
          total?: number
          adjunto_url?: string | null
          umbral_proyectos?: number
          estado?: 'pendiente_asignacion' | 'cubierto_parcial' | 'cubierto' | 'generando_ganancia'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'gastos_generales_org_id_fkey'
            columns: ['org_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'gastos_generales_proveedor_id_fkey'
            columns: ['proveedor_id']
            referencedRelation: 'proveedores'
            referencedColumns: ['id']
          },
        ]
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
          fecha?: string
        }
        Update: {
          id?: string
          gasto_general_id?: string
          proyecto_id?: string
          monto?: number
          pct?: number | null
          fecha?: string
        }
        Relationships: [
          {
            foreignKeyName: 'asignaciones_gg_gasto_general_id_fkey'
            columns: ['gasto_general_id']
            referencedRelation: 'gastos_generales'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'asignaciones_gg_proyecto_id_fkey'
            columns: ['proyecto_id']
            referencedRelation: 'proyectos'
            referencedColumns: ['id']
          },
        ]
      }
      movimientos_caja: {
        Row: {
          id: string
          org_id: string
          tipo: 'ingreso' | 'egreso' | 'detraccion' | 'retencion'
          origen_tabla: string
          origen_id: string
          proyecto_id: string | null
          cliente_id: string | null
          proveedor_id: string | null
          concepto: string
          monto: number
          fecha_esperada: string
          fecha_real: string | null
          estado: 'pendiente' | 'realizado' | 'vencido'
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          tipo: 'ingreso' | 'egreso' | 'detraccion' | 'retencion'
          origen_tabla: string
          origen_id: string
          proyecto_id?: string | null
          cliente_id?: string | null
          proveedor_id?: string | null
          concepto: string
          monto: number
          fecha_esperada: string
          fecha_real?: string | null
          estado?: 'pendiente' | 'realizado' | 'vencido'
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          tipo?: 'ingreso' | 'egreso' | 'detraccion' | 'retencion'
          origen_tabla?: string
          origen_id?: string
          proyecto_id?: string | null
          cliente_id?: string | null
          proveedor_id?: string | null
          concepto?: string
          monto?: number
          fecha_esperada?: string
          fecha_real?: string | null
          estado?: 'pendiente' | 'realizado' | 'vencido'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'movimientos_caja_org_id_fkey'
            columns: ['org_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      alertas: {
        Row: {
          id: string
          org_id: string
          tipo:
            | 'factura_proveedor_pendiente'
            | 'detraccion_vencida'
            | 'detraccion_proxima'
            | 'factura_cobro_vencida'
            | 'proyecto_sin_margen'
            | 'pago_proximo_proveedor'
            | 'proyecto_margen_riesgo'
            | 'semana_caja_negativa'
            | 'gasto_general_cubierto'
          nivel: 'critico' | 'advertencia' | 'informativo'
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
          tipo:
            | 'factura_proveedor_pendiente'
            | 'detraccion_vencida'
            | 'detraccion_proxima'
            | 'factura_cobro_vencida'
            | 'proyecto_sin_margen'
            | 'pago_proximo_proveedor'
            | 'proyecto_margen_riesgo'
            | 'semana_caja_negativa'
            | 'gasto_general_cubierto'
          nivel: 'critico' | 'advertencia' | 'informativo'
          referencia_tabla?: string | null
          referencia_id?: string | null
          mensaje: string
          fecha_generada?: string
          fecha_visto?: string | null
          resuelto?: boolean
        }
        Update: {
          id?: string
          org_id?: string
          tipo?:
            | 'factura_proveedor_pendiente'
            | 'detraccion_vencida'
            | 'detraccion_proxima'
            | 'factura_cobro_vencida'
            | 'proyecto_sin_margen'
            | 'pago_proximo_proveedor'
            | 'proyecto_margen_riesgo'
            | 'semana_caja_negativa'
            | 'gasto_general_cubierto'
          nivel?: 'critico' | 'advertencia' | 'informativo'
          referencia_tabla?: string | null
          referencia_id?: string | null
          mensaje?: string
          fecha_generada?: string
          fecha_visto?: string | null
          resuelto?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'alertas_org_id_fkey'
            columns: ['org_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      audit_log: {
        Row: {
          id: string
          org_id: string
          user_id: string
          tabla: string
          registro_id: string
          accion: 'INSERT' | 'UPDATE' | 'DELETE'
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
          accion: 'INSERT' | 'UPDATE' | 'DELETE'
          datos_antes?: Json | null
          datos_des?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          tabla?: string
          registro_id?: string
          accion?: 'INSERT' | 'UPDATE' | 'DELETE'
          datos_antes?: Json | null
          datos_des?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_org_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_rol: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ─── Helpers de tipo ─────────────────────────────────────────────────────────
type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row']

export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']
