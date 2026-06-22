export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_users: {
        Row: {
          artist_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          artist_id?: string | null
          created_at?: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          artist_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "app_users_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_services: {
        Row: {
          appointment_id: string
          duration_min: number
          id: string
          price_eur: number
          quantity: number
          service_id: string
        }
        Insert: {
          appointment_id: string
          duration_min: number
          id?: string
          price_eur: number
          quantity?: number
          service_id: string
        }
        Update: {
          appointment_id?: string
          duration_min?: number
          id?: string
          price_eur?: number
          quantity?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_services_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          artist_id: string
          contact_id: string
          created_at: string
          created_by: string | null
          discount_eur: number | null
          end_at: string
          ghl_appointment_id: string | null
          id: string
          internal_note: string | null
          notes: string | null
          start_at: string
          status: Database["public"]["Enums"]["appt_status"]
          updated_at: string
        }
        Insert: {
          artist_id: string
          contact_id: string
          created_at?: string
          created_by?: string | null
          discount_eur?: number | null
          end_at: string
          ghl_appointment_id?: string | null
          id?: string
          internal_note?: string | null
          notes?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["appt_status"]
          updated_at?: string
        }
        Update: {
          artist_id?: string
          contact_id?: string
          created_at?: string
          created_by?: string | null
          discount_eur?: number | null
          end_at?: string
          ghl_appointment_id?: string | null
          id?: string
          internal_note?: string | null
          notes?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["appt_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      artists: {
        Row: {
          active: boolean
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          ghl_calendar_id: string | null
          ghl_user_id: string | null
          id: string
          name: string
          phone: string | null
          specialties: string[] | null
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          ghl_calendar_id?: string | null
          ghl_user_id?: string | null
          id?: string
          name: string
          phone?: string | null
          specialties?: string[] | null
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          ghl_calendar_id?: string | null
          ghl_user_id?: string | null
          id?: string
          name?: string
          phone?: string | null
          specialties?: string[] | null
        }
        Relationships: []
      }
      availability_blocks: {
        Row: {
          artist_id: string
          created_at: string
          end_at: string
          ghl_block_id: string | null
          id: string
          reason: string | null
          start_at: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          end_at: string
          ghl_block_id?: string | null
          id?: string
          reason?: string | null
          start_at: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          end_at?: string
          ghl_block_id?: string | null
          id?: string
          reason?: string | null
          start_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_blocks_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          ghl_contact_id: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          synced_at: string | null
          tags: string[] | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          ghl_contact_id: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          synced_at?: string | null
          tags?: string[] | null
        }
        Update: {
          created_at?: string
          email?: string | null
          ghl_contact_id?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          synced_at?: string | null
          tags?: string[] | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_eur: number
          appointment_id: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          paid_at: string | null
          quote_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          type: Database["public"]["Enums"]["payment_type"]
        }
        Insert: {
          amount_eur: number
          appointment_id?: string | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string | null
          quote_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          type: Database["public"]["Enums"]["payment_type"]
        }
        Update: {
          amount_eur?: number
          appointment_id?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string | null
          quote_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          type?: Database["public"]["Enums"]["payment_type"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio: {
        Row: {
          artist_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string
          published: boolean
          service_id: string | null
          sort_order: number | null
          tags: string[] | null
          title: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          published?: boolean
          service_id?: string | null
          sort_order?: number | null
          tags?: string[] | null
          title: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          published?: boolean
          service_id?: string | null
          sort_order?: number | null
          tags?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          artist_id: string
          contact_id: string
          created_at: string
          created_by: string | null
          discount_eur: number
          id: string
          notes: string | null
          services_snap: Json
          status: Database["public"]["Enums"]["quote_status"]
          subtotal_eur: number
          total_eur: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          artist_id: string
          contact_id: string
          created_at?: string
          created_by?: string | null
          discount_eur?: number
          id?: string
          notes?: string | null
          services_snap?: Json
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal_eur?: number
          total_eur?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          artist_id?: string
          contact_id?: string
          created_at?: string
          created_by?: string | null
          discount_eur?: number
          id?: string
          notes?: string | null
          services_snap?: Json
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal_eur?: number
          total_eur?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string | null
          duration_min: number
          id: string
          modality: Database["public"]["Enums"]["service_modality"]
          name: string
          price_eur: number
          sort_order: number | null
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          description?: string | null
          duration_min: number
          id?: string
          modality?: Database["public"]["Enums"]["service_modality"]
          name: string
          price_eur: number
          sort_order?: number | null
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          modality?: Database["public"]["Enums"]["service_modality"]
          name?: string
          price_eur?: number
          sort_order?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_artist_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      appt_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      payment_method: "cash" | "card" | "transfer" | "payconiq" | "other"
      payment_status: "pending" | "paid" | "refunded"
      payment_type: "deposit" | "final" | "refund"
      quote_status: "draft" | "sent" | "accepted" | "rejected" | "expired"
      service_modality: "presencial" | "consulta_online" | "hibrido"
      user_role: "admin" | "artist"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appt_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ],
      payment_method: ["cash", "card", "transfer", "payconiq", "other"],
      payment_status: ["pending", "paid", "refunded"],
      payment_type: ["deposit", "final", "refund"],
      quote_status: ["draft", "sent", "accepted", "rejected", "expired"],
      service_modality: ["presencial", "consulta_online", "hibrido"],
      user_role: ["admin", "artist"],
    },
  },
} as const
