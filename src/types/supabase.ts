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
          name: string
          settings: Json
          crew_pin: string | null
          logo_url: string | null
          phone: string | null
          email: string | null
          address: Json
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          settings?: Json
          crew_pin?: string | null
          logo_url?: string | null
          phone?: string | null
          email?: string | null
          address?: Json
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          settings?: Json
          crew_pin?: string | null
          logo_url?: string | null
          phone?: string | null
          email?: string | null
          address?: Json
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          organization_id: string
          role: 'admin' | 'crew'
          full_name: string | null
          created_at: string
        }
        Insert: {
          id: string
          organization_id: string
          role?: 'admin' | 'crew'
          full_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          role?: 'admin' | 'crew'
          full_name?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_organization_id_fkey'
            columns: ['organization_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      customers: {
        Row: {
          id: string
          organization_id: string
          name: string
          address: string | null
          city: string | null
          state: string | null
          zip: string | null
          phone: string | null
          email: string | null
          status: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          address?: string | null
          city?: string | null
          state?: string | null
          zip?: string | null
          phone?: string | null
          email?: string | null
          status?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          address?: string | null
          city?: string | null
          state?: string | null
          zip?: string | null
          phone?: string | null
          email?: string | null
          status?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'customers_organization_id_fkey'
            columns: ['organization_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      estimates: {
        Row: {
          id: string
          organization_id: string
          customer_id: string | null
          status: string
          execution_status: string
          date: string
          total_value: number
          notes: string | null
          pricing_mode: string
          scheduled_date: string | null
          invoice_date: string | null
          invoice_number: string | null
          payment_terms: string | null
          inputs: Json
          results: Json
          materials: Json
          financials: Json
          settings_snapshot: Json
          wall_settings: Json
          roof_settings: Json
          expenses: Json
          actuals: Json | null
          sq_ft_rates: Json
          estimate_lines: Json | null
          invoice_lines: Json | null
          work_order_lines: Json | null
          work_order_sheet_url: string | null
          pdf_link: string | null
          site_photos: Json
          inventory_processed: boolean
          last_modified: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          customer_id?: string | null
          status?: string
          execution_status?: string
          date?: string
          total_value?: number
          notes?: string | null
          pricing_mode?: string
          scheduled_date?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          payment_terms?: string | null
          inputs?: Json
          results?: Json
          materials?: Json
          financials?: Json
          settings_snapshot?: Json
          wall_settings?: Json
          roof_settings?: Json
          expenses?: Json
          actuals?: Json | null
          sq_ft_rates?: Json
          estimate_lines?: Json | null
          invoice_lines?: Json | null
          work_order_lines?: Json | null
          work_order_sheet_url?: string | null
          pdf_link?: string | null
          site_photos?: Json
          inventory_processed?: boolean
          last_modified?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          customer_id?: string
          status?: string
          execution_status?: string
          date?: string
          total_value?: number
          notes?: string | null
          pricing_mode?: string
          scheduled_date?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          payment_terms?: string | null
          inputs?: Json
          results?: Json
          materials?: Json
          financials?: Json
          settings_snapshot?: Json
          wall_settings?: Json
          roof_settings?: Json
          expenses?: Json
          actuals?: Json | null
          sq_ft_rates?: Json
          estimate_lines?: Json | null
          invoice_lines?: Json | null
          work_order_lines?: Json | null
          work_order_sheet_url?: string | null
          pdf_link?: string | null
          site_photos?: Json
          inventory_processed?: boolean
          last_modified?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'estimates_organization_id_fkey'
            columns: ['organization_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'estimates_customer_id_fkey'
            columns: ['customer_id']
            referencedRelation: 'customers'
            referencedColumns: ['id']
          }
        ]
      }
      inventory_items: {
        Row: {
          id: string
          organization_id: string
          name: string
          unit: string
          quantity: number
          unit_cost: number
          category: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          unit: string
          quantity?: number
          unit_cost?: number
          category?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          unit?: string
          quantity?: number
          unit_cost?: number
          category?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'inventory_items_organization_id_fkey'
            columns: ['organization_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      equipment: {
        Row: {
          id: string
          organization_id: string
          name: string
          status: string
          last_seen: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          status?: string
          last_seen?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          status?: string
          last_seen?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'equipment_organization_id_fkey'
            columns: ['organization_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      material_logs: {
        Row: {
          id: string
          organization_id: string
          date: string
          job_id: string | null
          customer_name: string | null
          material_name: string
          quantity: number
          unit: string | null
          logged_by: string | null
          log_type: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          date: string
          job_id?: string | null
          customer_name?: string | null
          material_name: string
          quantity?: number
          unit?: string | null
          logged_by?: string | null
          log_type?: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          date?: string
          job_id?: string | null
          customer_name?: string | null
          material_name?: string
          quantity?: number
          unit?: string | null
          logged_by?: string | null
          log_type?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'material_logs_organization_id_fkey'
            columns: ['organization_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      purchase_orders: {
        Row: {
          id: string
          organization_id: string
          date: string
          vendor_name: string
          status: string
          items: Json
          total_cost: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          date: string
          vendor_name: string
          status?: string
          items?: Json
          total_cost?: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          date?: string
          vendor_name?: string
          status?: string
          items?: Json
          total_cost?: number
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'purchase_orders_organization_id_fkey'
            columns: ['organization_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      warehouse_stock: {
        Row: {
          id: string
          organization_id: string
          open_cell_sets: number
          closed_cell_sets: number
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          open_cell_sets?: number
          closed_cell_sets?: number
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          open_cell_sets?: number
          closed_cell_sets?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'warehouse_stock_organization_id_fkey'
            columns: ['organization_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      subscriptions: {
        Row: {
          id: string
          organization_id: string
          plan: 'trial' | 'starter' | 'pro' | 'enterprise'
          status: 'active' | 'past_due' | 'cancelled' | 'suspended'
          max_users: number
          max_estimates_per_month: number
          max_customers: number
          max_storage_mb: number
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          current_period_start: string | null
          current_period_end: string | null
          trial_started_at: string | null
          trial_ends_at: string | null
          estimates_this_month: number
          last_usage_reset: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          plan?: 'trial' | 'starter' | 'pro' | 'enterprise'
          status?: 'active' | 'past_due' | 'cancelled' | 'suspended'
          max_users?: number
          max_estimates_per_month?: number
          max_customers?: number
          max_storage_mb?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          trial_started_at?: string | null
          trial_ends_at?: string | null
          estimates_this_month?: number
          last_usage_reset?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          plan?: 'trial' | 'starter' | 'pro' | 'enterprise'
          status?: 'active' | 'past_due' | 'cancelled' | 'suspended'
          max_users?: number
          max_estimates_per_month?: number
          max_customers?: number
          max_storage_mb?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          trial_started_at?: string | null
          trial_ends_at?: string | null
          estimates_this_month?: number
          last_usage_reset?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_organization_id_fkey'
            columns: ['organization_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      audit_log: {
        Row: {
          id: string
          organization_id: string | null
          user_id: string | null
          action: string
          resource_type: string | null
          resource_id: string | null
          details: Json
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          user_id?: string | null
          action: string
          resource_type?: string | null
          resource_id?: string | null
          details?: Json
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          user_id?: string | null
          action?: string
          resource_type?: string | null
          resource_id?: string | null
          details?: Json
          ip_address?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_log_organization_id_fkey'
            columns: ['organization_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      documents: {
        Row: {
          id: string
          organization_id: string
          customer_id: string | null
          estimate_id: string | null
          document_type: string
          filename: string
          storage_path: string
          public_url: string | null
          file_size: number | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          customer_id?: string | null
          estimate_id?: string | null
          document_type: string
          filename: string
          storage_path: string
          public_url?: string | null
          file_size?: number | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          customer_id?: string | null
          estimate_id?: string | null
          document_type?: string
          filename?: string
          storage_path?: string
          public_url?: string | null
          file_size?: number | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'documents_organization_id_fkey'
            columns: ['organization_id']
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'documents_customer_id_fkey'
            columns: ['customer_id']
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'documents_estimate_id_fkey'
            columns: ['estimate_id']
            referencedRelation: 'estimates'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      verify_crew_pin: {
        Args: { org_name: string; pin: string }
        Returns: Json
      }
      get_org_data: {
        Args: { org_id: string }
        Returns: Json
      }
      get_crew_work_orders: {
        Args: { p_org_id: string }
        Returns: Json
      }
      crew_update_job: {
        Args: { p_org_id: string; p_estimate_id: string; p_actuals: Json; p_execution_status: string }
        Returns: boolean
      }
      get_subscription_status: {
        Args: { p_org_id: string }
        Returns: Json
      }
      get_customer_documents: {
        Args: { p_org_id: string; p_customer_id: string }
        Returns: Json
      }
      get_estimate_documents: {
        Args: { p_org_id: string; p_estimate_id: string }
        Returns: Json
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
