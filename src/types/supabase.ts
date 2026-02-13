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
            companies: {
                Row: {
                    id: string
                    name: string
                    settings: Json
                    crew_pin: string | null
                    logo_url: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    settings?: Json
                    crew_pin?: string | null
                    logo_url?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    settings?: Json
                    crew_pin?: string | null
                    logo_url?: string | null
                    created_at?: string
                }
            }
            profiles: {
                Row: {
                    id: string
                    company_id: string | null
                    role: 'admin' | 'crew'
                    full_name: string | null
                    created_at: string
                }
                Insert: {
                    id: string
                    company_id?: string | null
                    role?: 'admin' | 'crew'
                    full_name?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    company_id?: string | null
                    role?: 'admin' | 'crew'
                    full_name?: string | null
                    created_at?: string
                }
            }
            customers: {
                Row: {
                    id: string
                    company_id: string
                    name: string
                    address: string | null
                    city: string | null
                    state: string | null
                    zip: string | null
                    phone: string | null
                    email: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    company_id: string
                    name: string
                    address?: string | null
                    city?: string | null
                    state?: string | null
                    zip?: string | null
                    phone?: string | null
                    email?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    company_id?: string
                    name?: string
                    address?: string | null
                    city?: string | null
                    state?: string | null
                    zip?: string | null
                    phone?: string | null
                    email?: string | null
                    created_at?: string
                }
            }
            estimates: {
                Row: {
                    id: string
                    company_id: string
                    customer_id: string
                    status: 'Draft' | 'Work Order' | 'Invoiced' | 'Paid'
                    date: string
                    scheduled_date: string | null
                    inputs: Json
                    calculations: Json
                    financials: Json
                    actuals: Json
                    created_at: string
                }
                Insert: {
                    id?: string
                    company_id: string
                    customer_id: string
                    status?: 'Draft' | 'Work Order' | 'Invoiced' | 'Paid'
                    date?: string
                    scheduled_date?: string | null
                    inputs?: Json
                    calculations?: Json
                    financials?: Json
                    actuals?: Json
                    created_at?: string
                }
                Update: {
                    id?: string
                    company_id?: string
                    customer_id?: string
                    status?: 'Draft' | 'Work Order' | 'Invoiced' | 'Paid'
                    date?: string
                    scheduled_date?: string | null
                    inputs?: Json
                    calculations?: Json
                    financials?: Json
                    actuals?: Json
                    created_at?: string
                }
            }
            inventory_items: {
                Row: {
                    id: string
                    company_id: string
                    name: string
                    unit: string
                    quantity: number
                    unit_cost: number
                    category: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    company_id: string
                    name: string
                    unit: string
                    quantity?: number
                    unit_cost?: number
                    category?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    company_id?: string
                    name?: string
                    unit?: string
                    quantity?: number
                    unit_cost?: number
                    category?: string | null
                    created_at?: string
                }
            }
        }
    }
}
