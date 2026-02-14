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
      }
      profiles: {
        Row: {
          id: string
          organization_id: string | null
          role: 'admin' | 'crew'
          full_name: string | null
          created_at: string
        }
        Insert: {
          id: string
          organization_id?: string | null
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
      }
      estimates: {
        Row: {
          id: string
          organization_id: string
          customer_id: string
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
          customer_id: string
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
      }
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
    }
  }
}
