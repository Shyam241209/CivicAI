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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      civic_reports: {
        Row: {
          admin_remarks: string | null
          ai_confidence_score: number | null
          assigned_department_id: string | null
          assigned_staff_id: string | null
          auto_assign_confidence: number | null
          auto_assign_created_department: boolean | null
          auto_assign_match_method: string | null
          auto_assign_pending_confirmation: boolean | null
          auto_assign_suggested_name: string | null
          context_analysis: string | null
          created_at: string
          department_assignment_confidence: number | null
          department_assignment_method: string | null
          estimated_resolution_time: string | null
          id: string
          image_url: string | null
          is_auto_assigned: boolean | null
          issue_category: string | null
          location_data: Json | null
          needs_admin_review: boolean | null
          priority_level: string | null
          recommended_action: string | null
          resolution_image_url: string | null
          severity: string | null
          short_description: string | null
          status: string | null
          suggested_department: string | null
          updated_at: string
          user_description: string | null
          user_id: string | null
        }
        Insert: {
          admin_remarks?: string | null
          ai_confidence_score?: number | null
          assigned_department_id?: string | null
          assigned_staff_id?: string | null
          auto_assign_confidence?: number | null
          auto_assign_created_department?: boolean | null
          auto_assign_match_method?: string | null
          auto_assign_pending_confirmation?: boolean | null
          auto_assign_suggested_name?: string | null
          context_analysis?: string | null
          created_at?: string
          department_assignment_confidence?: number | null
          department_assignment_method?: string | null
          estimated_resolution_time?: string | null
          id?: string
          image_url?: string | null
          is_auto_assigned?: boolean | null
          issue_category?: string | null
          location_data?: Json | null
          needs_admin_review?: boolean | null
          priority_level?: string | null
          recommended_action?: string | null
          resolution_image_url?: string | null
          severity?: string | null
          short_description?: string | null
          status?: string | null
          suggested_department?: string | null
          updated_at?: string
          user_description?: string | null
          user_id?: string | null
        }
        Update: {
          admin_remarks?: string | null
          ai_confidence_score?: number | null
          assigned_department_id?: string | null
          assigned_staff_id?: string | null
          auto_assign_confidence?: number | null
          auto_assign_created_department?: boolean | null
          auto_assign_match_method?: string | null
          auto_assign_pending_confirmation?: boolean | null
          auto_assign_suggested_name?: string | null
          context_analysis?: string | null
          created_at?: string
          department_assignment_confidence?: number | null
          department_assignment_method?: string | null
          estimated_resolution_time?: string | null
          id?: string
          image_url?: string | null
          is_auto_assigned?: boolean | null
          issue_category?: string | null
          location_data?: Json | null
          needs_admin_review?: boolean | null
          priority_level?: string | null
          recommended_action?: string | null
          resolution_image_url?: string | null
          severity?: string | null
          short_description?: string | null
          status?: string | null
          suggested_department?: string | null
          updated_at?: string
          user_description?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      department_users: {
        Row: {
          created_at: string
          department_id: string
          id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          contact_email: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          officer_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          officer_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          officer_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      issues: {
        Row: {
          description: string | null
          id: number
          latitude: number | null
          longitude: number | null
          status: string | null
          title: string | null
        }
        Insert: {
          description?: string | null
          id?: never
          latitude?: number | null
          longitude?: number | null
          status?: string | null
          title?: string | null
        }
        Update: {
          description?: string | null
          id?: never
          latitude?: number | null
          longitude?: number | null
          status?: string | null
          title?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          report_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          report_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          report_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "civic_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accent_color: string | null
          address_line: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          compact_mode: boolean | null
          country: string | null
          created_at: string
          date_format: string | null
          date_of_birth: string | null
          district: string | null
          font_size: string | null
          full_name: string | null
          gender: string | null
          id: string
          phone: string | null
          pincode: string | null
          region: string | null
          role: string | null
          state: string | null
          theme_preference: string | null
          timezone: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          accent_color?: string | null
          address_line?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          compact_mode?: boolean | null
          country?: string | null
          created_at?: string
          date_format?: string | null
          date_of_birth?: string | null
          district?: string | null
          font_size?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          phone?: string | null
          pincode?: string | null
          region?: string | null
          role?: string | null
          state?: string | null
          theme_preference?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          accent_color?: string | null
          address_line?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          compact_mode?: boolean | null
          country?: string | null
          created_at?: string
          date_format?: string | null
          date_of_birth?: string | null
          district?: string | null
          font_size?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          phone?: string | null
          pincode?: string | null
          region?: string | null
          role?: string | null
          state?: string | null
          theme_preference?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      public_reports: {
        Row: {
          assigned_department_id: string | null
          created_at: string
          id: string
          issue_category: string | null
          location_data: Json | null
          priority_level: string | null
          severity: string | null
          short_description: string | null
          status: string | null
          suggested_department: string | null
          updated_at: string
        }
        Insert: {
          assigned_department_id?: string | null
          created_at?: string
          id: string
          issue_category?: string | null
          location_data?: Json | null
          priority_level?: string | null
          severity?: string | null
          short_description?: string | null
          status?: string | null
          suggested_department?: string | null
          updated_at?: string
        }
        Update: {
          assigned_department_id?: string | null
          created_at?: string
          id?: string
          issue_category?: string | null
          location_data?: Json | null
          priority_level?: string | null
          severity?: string | null
          short_description?: string | null
          status?: string | null
          suggested_department?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      report_assignments: {
        Row: {
          accepted_at: string | null
          assigned_at: string
          assigned_by: string | null
          assignment_status: string | null
          completed_at: string | null
          created_at: string
          department_id: string
          id: string
          report_id: string
          started_at: string | null
          transferred_at: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_at?: string
          assigned_by?: string | null
          assignment_status?: string | null
          completed_at?: string | null
          created_at?: string
          department_id: string
          id?: string
          report_id: string
          started_at?: string | null
          transferred_at?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_at?: string
          assigned_by?: string | null
          assignment_status?: string | null
          completed_at?: string | null
          created_at?: string
          department_id?: string
          id?: string
          report_id?: string
          started_at?: string | null
          transferred_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_assignments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_assignments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "civic_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_history: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string | null
          created_at: string
          id: string
          new_value: Json | null
          previous_value: Json | null
          report_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          report_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_history_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "civic_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_by_role: string | null
          department_id: string | null
          id: string
          message: string | null
          report_id: string
          status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changed_by_role?: string | null
          department_id?: string | null
          id?: string
          message?: string | null
          report_id: string
          status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changed_by_role?: string | null
          department_id?: string | null
          id?: string
          message?: string | null
          report_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_status_history_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_status_history_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "civic_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          auto_assign_confidence_threshold: number | null
          auto_create_missing_departments: boolean | null
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          auto_assign_confidence_threshold?: number | null
          auto_create_missing_departments?: boolean | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          auto_assign_confidence_threshold?: number | null
          auto_create_missing_departments?: boolean | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_department_staff: {
        Args: { p_department_id: string; p_user_id: string }
        Returns: boolean
      }
      is_staff_for_report: {
        Args: { p_report_id: string; p_user_id: string }
        Returns: boolean
      }
      transition_civic_report_status: {
        Args: { p_message?: string; p_report_id: string; p_status: string }
        Returns: {
          changed_at: string
          report_id: string
          status: string
        }[]
      }
    }
    Enums: {
      app_role: "user" | "admin" | "staff"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["user", "admin", "staff"],
    },
  },
} as const
