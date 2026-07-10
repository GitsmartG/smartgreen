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
      api_keys: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key?: string
        }
        Relationships: []
      }
      daily_matches: {
        Row: {
          fetched_at: string
          match_date: string
          payload: Json
          source: string
        }
        Insert: {
          fetched_at?: string
          match_date: string
          payload: Json
          source?: string
        }
        Update: {
          fetched_at?: string
          match_date?: string
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      live_notifications: {
        Row: {
          fetched_at: string
          finished: boolean
          first_seen_at: string
          id: string
          kind: string
          last_seen_at: string
          league: string
          league_id: string
          live: boolean
          match_id: string
          minute: string | null
          player: string | null
          raw_status: string
          result: string | null
          score1: number | null
          score2: number | null
          status: string
          team: string | null
          team1: Json
          team2: Json
          text: string
          title: string
          type: string
        }
        Insert: {
          fetched_at?: string
          finished?: boolean
          first_seen_at?: string
          id: string
          kind: string
          last_seen_at?: string
          league?: string
          league_id?: string
          live?: boolean
          match_id: string
          minute?: string | null
          player?: string | null
          raw_status?: string
          result?: string | null
          score1?: number | null
          score2?: number | null
          status?: string
          team?: string | null
          team1?: Json
          team2?: Json
          text: string
          title: string
          type: string
        }
        Update: {
          fetched_at?: string
          finished?: boolean
          first_seen_at?: string
          id?: string
          kind?: string
          last_seen_at?: string
          league?: string
          league_id?: string
          live?: boolean
          match_id?: string
          minute?: string | null
          player?: string | null
          raw_status?: string
          result?: string | null
          score1?: number | null
          score2?: number | null
          status?: string
          team?: string | null
          team1?: Json
          team2?: Json
          text?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          banca: number
          created_at: string
          created_at_ms: number | null
          entradas: number
          esporte: string
          event: string
          id: string
          league: string
          leg_results: Json | null
          leg_statuses: Json | null
          match_date: string
          odd: number
          palpite: string
          parceiro: string | null
          result_checked_at_ms: number | null
          score1: number | null
          score2: number | null
          start_ms: number | null
          status: string
          team1_logo: string | null
          team2_logo: string | null
          type: string
          updated_at: string
          url: string | null
        }
        Insert: {
          banca?: number
          created_at?: string
          created_at_ms?: number | null
          entradas?: number
          esporte?: string
          event?: string
          id: string
          league?: string
          leg_results?: Json | null
          leg_statuses?: Json | null
          match_date?: string
          odd?: number
          palpite?: string
          parceiro?: string | null
          result_checked_at_ms?: number | null
          score1?: number | null
          score2?: number | null
          start_ms?: number | null
          status?: string
          team1_logo?: string | null
          team2_logo?: string | null
          type?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          banca?: number
          created_at?: string
          created_at_ms?: number | null
          entradas?: number
          esporte?: string
          event?: string
          id?: string
          league?: string
          leg_results?: Json | null
          leg_statuses?: Json | null
          match_date?: string
          odd?: number
          palpite?: string
          parceiro?: string | null
          result_checked_at_ms?: number | null
          score1?: number | null
          score2?: number | null
          start_ms?: number | null
          status?: string
          team1_logo?: string | null
          team2_logo?: string | null
          type?: string
          updated_at?: string
          url?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_users: {
        Args: never
        Returns: {
          access_expires_at: string
          created_at: string
          email: string
          id: string
          last_sign_in_at: string
          name: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      admin_set_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _target: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      request_mobile_api_key: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
