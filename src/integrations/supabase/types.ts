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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          budget_kes: number
          category_id: string | null
          clicks: number
          conversions: number
          created_at: string
          cta_text: string | null
          description: string | null
          discount_label: string | null
          discount_percent: number | null
          ends_at: string
          headline: string | null
          id: string
          image_url: string | null
          starts_at: string
          status: string
          title: string
          views: number
        }
        Insert: {
          budget_kes?: number
          category_id?: string | null
          clicks?: number
          conversions?: number
          created_at?: string
          cta_text?: string | null
          description?: string | null
          discount_label?: string | null
          discount_percent?: number | null
          ends_at?: string
          headline?: string | null
          id?: string
          image_url?: string | null
          starts_at?: string
          status?: string
          title: string
          views?: number
        }
        Update: {
          budget_kes?: number
          category_id?: string | null
          clicks?: number
          conversions?: number
          created_at?: string
          cta_text?: string | null
          description?: string | null
          discount_label?: string | null
          discount_percent?: number | null
          ends_at?: string
          headline?: string | null
          id?: string
          image_url?: string | null
          starts_at?: string
          status?: string
          title?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          banner_url: string | null
          code: string
          created_at: string
          description: string | null
          featured_tags: string[]
          icon: string | null
          id: string
          image_url: string | null
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          banner_url?: string | null
          code: string
          created_at?: string
          description?: string | null
          featured_tags?: string[]
          icon?: string | null
          id?: string
          image_url?: string | null
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          banner_url?: string | null
          code?: string
          created_at?: string
          description?: string | null
          featured_tags?: string[]
          icon?: string | null
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          active: boolean
          fee: number
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          fee: number
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          fee?: number
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
          name: string
          phone: string
          status: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
          name: string
          phone: string
          status?: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          name?: string
          phone?: string
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
        }
        Relationships: []
      }
      order_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id: string
          status: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_address: string | null
          delivery_fee: number
          delivery_zone: string | null
          id: string
          mpesa_code: string | null
          notes: string | null
          order_no: string
          payment_method: string
          payment_status: string
          refunded_amount: number
          rider_id: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_zone?: string | null
          id?: string
          mpesa_code?: string | null
          notes?: string | null
          order_no?: string
          payment_method?: string
          payment_status?: string
          refunded_amount?: number
          rider_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_zone?: string | null
          id?: string
          mpesa_code?: string | null
          notes?: string | null
          order_no?: string
          payment_method?: string
          payment_status?: string
          refunded_amount?: number
          rider_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      page_events: {
        Row: {
          campaign_id: string | null
          category_id: string | null
          created_at: string
          event_type: string
          id: string
          path: string | null
          product_id: string | null
          session_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          category_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          path?: string | null
          product_id?: string | null
          session_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          category_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          path?: string | null
          product_id?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          badge: string | null
          brand: string | null
          category_id: string | null
          created_at: string
          description: string | null
          features: string[]
          flash_ends_at: string | null
          flash_price: number | null
          gallery: string[]
          id: string
          image_url: string | null
          in_stock: boolean
          is_deal: boolean
          is_featured: boolean
          is_published: boolean
          name: string
          original_price: number | null
          price: number
          rating: number
          reviews_count: number
          sku: string | null
          specs: Json
          stock_count: number
          updated_at: string
          warranty: string | null
        }
        Insert: {
          badge?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          features?: string[]
          flash_ends_at?: string | null
          flash_price?: number | null
          gallery?: string[]
          id?: string
          image_url?: string | null
          in_stock?: boolean
          is_deal?: boolean
          is_featured?: boolean
          is_published?: boolean
          name: string
          original_price?: number | null
          price?: number
          rating?: number
          reviews_count?: number
          sku?: string | null
          specs?: Json
          stock_count?: number
          updated_at?: string
          warranty?: string | null
        }
        Update: {
          badge?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          features?: string[]
          flash_ends_at?: string | null
          flash_price?: number | null
          gallery?: string[]
          id?: string
          image_url?: string | null
          in_stock?: boolean
          is_deal?: boolean
          is_featured?: boolean
          is_published?: boolean
          name?: string
          original_price?: number | null
          price?: number
          rating?: number
          reviews_count?: number
          sku?: string | null
          specs?: Json
          stock_count?: number
          updated_at?: string
          warranty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          location: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          location?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          location?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      return_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          order_id: string
          reason: string
          refund_amount: number
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          order_id: string
          reason: string
          refund_amount?: number
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          order_id?: string
          reason?: string
          refund_amount?: number
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_name: string
          comment: string | null
          created_at: string
          id: string
          product_id: string
          rating: number
          user_id: string
        }
        Insert: {
          author_name: string
          comment?: string | null
          created_at?: string
          id?: string
          product_id: string
          rating: number
          user_id: string
        }
        Update: {
          author_name?: string
          comment?: string | null
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      riders: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          phone: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          phone: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      role_audit: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          target_user: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          target_user: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          target_user?: string
        }
        Relationships: []
      }
      sms_outbox: {
        Row: {
          created_at: string
          error: string | null
          id: string
          message: string
          order_id: string | null
          phone: string
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          message: string
          order_id?: string | null
          phone: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          message?: string
          order_id?: string | null
          phone?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_outbox_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          approved: boolean
          created_at: string
          id: string
          location: string | null
          message: string
          name: string
          rating: number
          user_id: string | null
        }
        Insert: {
          approved?: boolean
          created_at?: string
          id?: string
          location?: string | null
          message: string
          name: string
          rating?: number
          user_id?: string | null
        }
        Update: {
          approved?: boolean
          created_at?: string
          id?: string
          location?: string | null
          message?: string
          name?: string
          rating?: number
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
   Views: {
  public_reviews: {
    Row: {
      author_name: string | null
      comment: string | null
      created_at: string
      id: string
      product_id: string
      rating: number
    }
    Relationships: []
  }
}
    Functions: {
      admin_customers: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_admin: boolean
          location: string
          order_count: number
          phone: string
          total_spent: number
        }[]
      }
      admin_set_staff: {
        Args: { _email: string; _make_admin: boolean }
        Returns: undefined
      }
      bump_campaign_metric: {
        Args: { _campaign_id: string; _metric: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit: {
        Args: {
          _action: string
          _after?: Json
          _before?: Json
          _entity_id: string
          _entity_type: string
          _metadata?: Json
        }
        Returns: undefined
      }
      place_order: {
        Args: { _order: Json }
        Returns: {
          order_id: string
          order_no: string
          total: number
        }[]
      }
      reject_payment: {
        Args: { _order_id: string; _reason: string }
        Returns: undefined
      }
      request_return: {
        Args: { _order_id: string; _reason: string }
        Returns: string
      }
      resolve_return: {
        Args: { _decision: string; _id: string; _note: string; _refund: number }
        Returns: undefined
      }
      track_order: {
        Args: { _order_no: string; _phone: string }
        Returns: Json
      }
      verify_payment: {
        Args: { _note?: string; _order_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "customer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "customer"],
    },
  },
} as const
