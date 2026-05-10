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
      disease_pages: {
        Row: {
          causes: string
          complications: string | null
          created_at: string
          created_by: string | null
          description: string | null
          diagnosis: string | null
          home_remedies: string
          id: string
          name: string
          overview: string
          prevention: string | null
          prognosis: string | null
          risk_factors: string | null
          slug: string
          source_name: string | null
          source_url: string | null
          symptoms: string
          treatment: string | null
          updated_at: string
          when_to_see_doctor: string
        }
        Insert: {
          causes: string
          complications?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          diagnosis?: string | null
          home_remedies: string
          id?: string
          name: string
          overview: string
          prevention?: string | null
          prognosis?: string | null
          risk_factors?: string | null
          slug: string
          source_name?: string | null
          source_url?: string | null
          symptoms: string
          treatment?: string | null
          updated_at?: string
          when_to_see_doctor: string
        }
        Update: {
          causes?: string
          complications?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          diagnosis?: string | null
          home_remedies?: string
          id?: string
          name?: string
          overview?: string
          prevention?: string | null
          prognosis?: string | null
          risk_factors?: string | null
          slug?: string
          source_name?: string | null
          source_url?: string | null
          symptoms?: string
          treatment?: string | null
          updated_at?: string
          when_to_see_doctor?: string
        }
        Relationships: []
      }
      health_metrics: {
        Row: {
          created_at: string
          height_cm: number | null
          id: string
          mood: number | null
          notes: string | null
          recorded_on: string
          sleep_hours: number | null
          steps: number | null
          updated_at: string
          user_id: string
          water_ml: number | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          height_cm?: number | null
          id?: string
          mood?: number | null
          notes?: string | null
          recorded_on?: string
          sleep_hours?: number | null
          steps?: number | null
          updated_at?: string
          user_id: string
          water_ml?: number | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          height_cm?: number | null
          id?: string
          mood?: number | null
          notes?: string | null
          recorded_on?: string
          sleep_hours?: number | null
          steps?: number | null
          updated_at?: string
          user_id?: string
          water_ml?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      medications: {
        Row: {
          common_side_effects: string[]
          created_at: string
          dosage: string | null
          ended_on: string | null
          frequency: string | null
          id: string
          kind: Database["public"]["Enums"]["medication_kind"]
          name: string
          notes: string | null
          profile_id: string
          started_on: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          common_side_effects?: string[]
          created_at?: string
          dosage?: string | null
          ended_on?: string | null
          frequency?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["medication_kind"]
          name: string
          notes?: string | null
          profile_id: string
          started_on?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          common_side_effects?: string[]
          created_at?: string
          dosage?: string | null
          ended_on?: string | null
          frequency?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["medication_kind"]
          name?: string
          notes?: string | null
          profile_id?: string
          started_on?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_dependents"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          created_at: string
          id: string
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_dependents: {
        Row: {
          created_at: string
          date_of_birth: string | null
          id: string
          is_default: boolean
          name: string
          notes: string | null
          owner_id: string
          relation: Database["public"]["Enums"]["profile_relation"]
          sex: Database["public"]["Enums"]["profile_sex"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          id?: string
          is_default?: boolean
          name: string
          notes?: string | null
          owner_id: string
          relation?: Database["public"]["Enums"]["profile_relation"]
          sex?: Database["public"]["Enums"]["profile_sex"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          id?: string
          is_default?: boolean
          name?: string
          notes?: string | null
          owner_id?: string
          relation?: Database["public"]["Enums"]["profile_relation"]
          sex?: Database["public"]["Enums"]["profile_sex"]
          updated_at?: string
        }
        Relationships: []
      }
      symptom_logs: {
        Row: {
          created_at: string
          id: string
          logged_at: string
          notes: string | null
          profile_id: string
          severity: number
          symptom: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          logged_at?: string
          notes?: string | null
          profile_id: string
          severity?: number
          symptom: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          logged_at?: string
          notes?: string | null
          profile_id?: string
          severity?: number
          symptom?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "symptom_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_dependents"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      medication_kind: "prescription" | "otc" | "supplement"
      profile_relation: "self" | "child" | "parent" | "partner" | "other"
      profile_sex: "male" | "female" | "other" | "unspecified"
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
      medication_kind: ["prescription", "otc", "supplement"],
      profile_relation: ["self", "child", "parent", "partner", "other"],
      profile_sex: ["male", "female", "other", "unspecified"],
    },
  },
} as const
