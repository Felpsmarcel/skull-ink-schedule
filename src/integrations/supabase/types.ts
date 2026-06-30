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
          {
            foreignKeyName: "app_users_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists_public"
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
          calendar_id: string | null
          commission_pct: number
          contact_email: string | null
          contact_id: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          discount_eur: number | null
          end_at: string
          ghl_appointment_id: string | null
          ghl_contact_id: string | null
          id: string
          internal_note: string | null
          notes: string | null
          original_eur: number
          services: Json
          start_at: string
          status: Database["public"]["Enums"]["appt_status"]
          total_eur: number
          updated_at: string
        }
        Insert: {
          artist_id: string
          calendar_id?: string | null
          commission_pct?: number
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          discount_eur?: number | null
          end_at: string
          ghl_appointment_id?: string | null
          ghl_contact_id?: string | null
          id?: string
          internal_note?: string | null
          notes?: string | null
          original_eur?: number
          services?: Json
          start_at: string
          status?: Database["public"]["Enums"]["appt_status"]
          total_eur?: number
          updated_at?: string
        }
        Update: {
          artist_id?: string
          calendar_id?: string | null
          commission_pct?: number
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          discount_eur?: number | null
          end_at?: string
          ghl_appointment_id?: string | null
          ghl_contact_id?: string | null
          id?: string
          internal_note?: string | null
          notes?: string | null
          original_eur?: number
          services?: Json
          start_at?: string
          status?: Database["public"]["Enums"]["appt_status"]
          total_eur?: number
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
            foreignKeyName: "appointments_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists_public"
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
          {
            foreignKeyName: "availability_blocks_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists_public"
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      ghl_sync_failures: {
        Row: {
          created_at: string
          ghl_event_id: string | null
          id: string
          payload: Json | null
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ghl_event_id?: string | null
          id?: string
          payload?: Json | null
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ghl_event_id?: string | null
          id?: string
          payload?: Json | null
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghl_sync_failures_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "portfolio_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists_public"
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
            foreignKeyName: "quotes_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists_public"
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
          description_short: string | null
          duration_min: number
          id: string
          modality: Database["public"]["Enums"]["service_modality"]
          name: string
          price_eur: number
          price_max_eur: number | null
          sort_order: number | null
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          description?: string | null
          description_short?: string | null
          duration_min: number
          id?: string
          modality?: Database["public"]["Enums"]["service_modality"]
          name: string
          price_eur: number
          price_max_eur?: number | null
          sort_order?: number | null
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          description_short?: string | null
          duration_min?: number
          id?: string
          modality?: Database["public"]["Enums"]["service_modality"]
          name?: string
          price_eur?: number
          price_max_eur?: number | null
          sort_order?: number | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
    }
    Views: {
      artists_public: {
        Row: {
          active: boolean | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          ghl_calendar_id: string | null
          ghl_user_id: string | null
          id: string | null
          name: string | null
          specialties: string[] | null
        }
        Insert: {
          active?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          ghl_calendar_id?: string | null
          ghl_user_id?: string | null
          id?: string | null
          name?: string | null
          specialties?: string[] | null
        }
        Update: {
          active?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          ghl_calendar_id?: string | null
          ghl_user_id?: string | null
          id?: string | null
          name?: string | null
          specialties?: string[] | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_artist_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_my_artist_appointments: {
        Args: never
        Returns: {
          artist_id: string
          calendar_id: string
          commission_eur: number
          commission_pct: number
          contact_id: string
          contact_name: string
          created_at: string
          end_at: string
          ghl_appointment_id: string
          id: string
          notes: string
          services_summary: string
          start_at: string
          status: string
          updated_at: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
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
