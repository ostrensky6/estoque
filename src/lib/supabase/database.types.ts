export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      analises: {
        Row: {
          ativo: boolean
          codigo: string
          descricao: string | null
          nome: string | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          descricao?: string | null
          nome?: string | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          descricao?: string | null
          nome?: string | null
        }
        Relationships: []
      }
      auditoria: {
        Row: {
          acao: string
          criado_em: string
          id: number
          justificativa: string | null
          registro_id: string | null
          tabela: string
          usuario: string | null
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          criado_em?: string
          id?: never
          justificativa?: string | null
          registro_id?: string | null
          tabela: string
          usuario?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          criado_em?: string
          id?: never
          justificativa?: string | null
          registro_id?: string | null
          tabela?: string
          usuario?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      equipamento_analise: {
        Row: {
          codigo_analise: string
          equipamento_id: number
          id: number
          peso_alocacao: number
        }
        Insert: {
          codigo_analise: string
          equipamento_id: number
          id?: never
          peso_alocacao?: number
        }
        Update: {
          codigo_analise?: string
          equipamento_id?: number
          id?: never
          peso_alocacao?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipamento_analise_codigo_analise_fkey"
            columns: ["codigo_analise"]
            isOneToOne: false
            referencedRelation: "analises"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "equipamento_analise_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      equipamentos: {
        Row: {
          custo_unitario: number
          data_aquisicao: string | null
          id: number
          manutencao_anual_fixa: number | null
          nome: string
          percentual_manutencao_anual: number
          possui: boolean
          quantidade: number
          vida_util_anos: number | null
        }
        Insert: {
          custo_unitario?: number
          data_aquisicao?: string | null
          id?: never
          manutencao_anual_fixa?: number | null
          nome: string
          percentual_manutencao_anual?: number
          possui?: boolean
          quantidade?: number
          vida_util_anos?: number | null
        }
        Update: {
          custo_unitario?: number
          data_aquisicao?: string | null
          id?: never
          manutencao_anual_fixa?: number | null
          nome?: string
          percentual_manutencao_anual?: number
          possui?: boolean
          quantidade?: number
          vida_util_anos?: number | null
        }
        Relationships: []
      }
      estoque_movimentacoes: {
        Row: {
          criado_em: string
          custo_unitario: number | null
          data: string
          id: number
          insumo_id: number
          lote_id: number | null
          motivo: string | null
          quantidade: number
          referencia: string | null
          tipo: string
        }
        Insert: {
          criado_em?: string
          custo_unitario?: number | null
          data?: string
          id?: never
          insumo_id: number
          lote_id?: number | null
          motivo?: string | null
          quantidade: number
          referencia?: string | null
          tipo: string
        }
        Update: {
          criado_em?: string
          custo_unitario?: number | null
          data?: string
          id?: never
          insumo_id?: number
          lote_id?: number | null
          motivo?: string | null
          quantidade?: number
          referencia?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_estoque_saldo"
            referencedColumns: ["insumo_id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_estoque"
            referencedColumns: ["id"]
          },
        ]
      }
      etapas: {
        Row: {
          amostras_por_execucao: number | null
          atividade_opcional: boolean
          codigo_analise: string
          dia_fim_max: number | null
          dia_inicio: string | null
          execucoes_por_dia: number | null
          id: number
          nome_atividade: string
          nome_etapa: string
          ordem: number | null
          tempo_bancada_h: number | null
          tempo_maquina_h: number | null
          tipo_limitacao: string | null
        }
        Insert: {
          amostras_por_execucao?: number | null
          atividade_opcional?: boolean
          codigo_analise: string
          dia_fim_max?: number | null
          dia_inicio?: string | null
          execucoes_por_dia?: number | null
          id?: never
          nome_atividade: string
          nome_etapa: string
          ordem?: number | null
          tempo_bancada_h?: number | null
          tempo_maquina_h?: number | null
          tipo_limitacao?: string | null
        }
        Update: {
          amostras_por_execucao?: number | null
          atividade_opcional?: boolean
          codigo_analise?: string
          dia_fim_max?: number | null
          dia_inicio?: string | null
          execucoes_por_dia?: number | null
          id?: never
          nome_atividade?: string
          nome_etapa?: string
          ordem?: number | null
          tempo_bancada_h?: number | null
          tempo_maquina_h?: number | null
          tipo_limitacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "etapas_codigo_analise_fkey"
            columns: ["codigo_analise"]
            isOneToOne: false
            referencedRelation: "analises"
            referencedColumns: ["codigo"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          catalogo_padrao: string | null
          contato: string | null
          id: number
          nome: string
          prazo_max_dias: number | null
          prazo_medio_dias: number | null
        }
        Insert: {
          ativo?: boolean
          catalogo_padrao?: string | null
          contato?: string | null
          id?: never
          nome: string
          prazo_max_dias?: number | null
          prazo_medio_dias?: number | null
        }
        Update: {
          ativo?: boolean
          catalogo_padrao?: string | null
          contato?: string | null
          id?: never
          nome?: string
          prazo_max_dias?: number | null
          prazo_medio_dias?: number | null
        }
        Relationships: []
      }
      insumo_analise: {
        Row: {
          base_calculo: string | null
          codigo_analise: string
          especificacao_insumo: string | null
          grupo_escolha: string | null
          id: number
          insumo_id: number | null
          modo_cobranca: string | null
          nome_atividade: string
          nome_etapa: string
          quantidade_por_amostra: number | null
          unidade: string | null
        }
        Insert: {
          base_calculo?: string | null
          codigo_analise: string
          especificacao_insumo?: string | null
          grupo_escolha?: string | null
          id?: never
          insumo_id?: number | null
          modo_cobranca?: string | null
          nome_atividade: string
          nome_etapa: string
          quantidade_por_amostra?: number | null
          unidade?: string | null
        }
        Update: {
          base_calculo?: string | null
          codigo_analise?: string
          especificacao_insumo?: string | null
          grupo_escolha?: string | null
          id?: never
          insumo_id?: number | null
          modo_cobranca?: string | null
          nome_atividade?: string
          nome_etapa?: string
          quantidade_por_amostra?: number | null
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insumo_analise_codigo_analise_fkey"
            columns: ["codigo_analise"]
            isOneToOne: false
            referencedRelation: "analises"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "insumo_analise_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumo_analise_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_estoque_saldo"
            referencedColumns: ["insumo_id"]
          },
        ]
      }
      insumos: {
        Row: {
          categoria_compra: string | null
          codigo_fabricante: string | null
          codigo_interno: string | null
          condicao_armazenamento: string | null
          custo_total_embalagem: number | null
          custo_unitario: number | null
          data_aquisicao: string | null
          especificacao: string
          estoque_seguranca: number
          fabricante: string | null
          fornecedor_alt_id: number | null
          fornecedor_id: number | null
          id: number
          lead_time_dias: number | null
          nome_item: string | null
          ponto_reposicao: number
          prazo_entrega_max_dias: number | null
          quantidade_embalagem: number | null
          quantidade_minima_compra: number | null
          sds_url: string | null
          unidade: string | null
          validade_apos_abertura_dias: number | null
        }
        Insert: {
          categoria_compra?: string | null
          codigo_fabricante?: string | null
          codigo_interno?: string | null
          condicao_armazenamento?: string | null
          custo_total_embalagem?: number | null
          custo_unitario?: number | null
          data_aquisicao?: string | null
          especificacao: string
          estoque_seguranca?: number
          fabricante?: string | null
          fornecedor_alt_id?: number | null
          fornecedor_id?: number | null
          id?: never
          lead_time_dias?: number | null
          nome_item?: string | null
          ponto_reposicao?: number
          prazo_entrega_max_dias?: number | null
          quantidade_embalagem?: number | null
          quantidade_minima_compra?: number | null
          sds_url?: string | null
          unidade?: string | null
          validade_apos_abertura_dias?: number | null
        }
        Update: {
          categoria_compra?: string | null
          codigo_fabricante?: string | null
          codigo_interno?: string | null
          condicao_armazenamento?: string | null
          custo_total_embalagem?: number | null
          custo_unitario?: number | null
          data_aquisicao?: string | null
          especificacao?: string
          estoque_seguranca?: number
          fabricante?: string | null
          fornecedor_alt_id?: number | null
          fornecedor_id?: number | null
          id?: never
          lead_time_dias?: number | null
          nome_item?: string | null
          ponto_reposicao?: number
          prazo_entrega_max_dias?: number | null
          quantidade_embalagem?: number | null
          quantidade_minima_compra?: number | null
          sds_url?: string | null
          unidade?: string | null
          validade_apos_abertura_dias?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "insumos_fornecedor_alt_id_fkey"
            columns: ["fornecedor_alt_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      locais: {
        Row: {
          condicao_armazenamento: string | null
          id: number
          nome: string
          parent_id: number | null
          tipo: string | null
        }
        Insert: {
          condicao_armazenamento?: string | null
          id?: never
          nome: string
          parent_id?: number | null
          tipo?: string | null
        }
        Update: {
          condicao_armazenamento?: string | null
          id?: never
          nome?: string
          parent_id?: number | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locais_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "locais"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_estoque: {
        Row: {
          certificado_analise: string | null
          codigo_lote: string | null
          condicao_recebimento: string | null
          criado_em: string
          criterio_aceitacao: string | null
          custo_unitario: number | null
          data_abertura: string | null
          data_entrada: string
          fornecedor: string | null
          id: number
          insumo_id: number
          local_id: number | null
          motivo_bloqueio: string | null
          nota_fiscal: string | null
          projeto: string | null
          quantidade_atual: number
          quantidade_inicial: number
          responsavel_liberacao: string | null
          responsavel_recebimento: string | null
          status: string
          validade: string | null
          validade_apos_abertura: string | null
        }
        Insert: {
          certificado_analise?: string | null
          codigo_lote?: string | null
          condicao_recebimento?: string | null
          criado_em?: string
          criterio_aceitacao?: string | null
          custo_unitario?: number | null
          data_abertura?: string | null
          data_entrada?: string
          fornecedor?: string | null
          id?: never
          insumo_id: number
          local_id?: number | null
          motivo_bloqueio?: string | null
          nota_fiscal?: string | null
          projeto?: string | null
          quantidade_atual: number
          quantidade_inicial: number
          responsavel_liberacao?: string | null
          responsavel_recebimento?: string | null
          status?: string
          validade?: string | null
          validade_apos_abertura?: string | null
        }
        Update: {
          certificado_analise?: string | null
          codigo_lote?: string | null
          condicao_recebimento?: string | null
          criado_em?: string
          criterio_aceitacao?: string | null
          custo_unitario?: number | null
          data_abertura?: string | null
          data_entrada?: string
          fornecedor?: string | null
          id?: never
          insumo_id?: number
          local_id?: number | null
          motivo_bloqueio?: string | null
          nota_fiscal?: string | null
          projeto?: string | null
          quantidade_atual?: number
          quantidade_inicial?: number
          responsavel_liberacao?: string | null
          responsavel_recebimento?: string | null
          status?: string
          validade?: string | null
          validade_apos_abertura?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_estoque_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_estoque_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_estoque_saldo"
            referencedColumns: ["insumo_id"]
          },
          {
            foreignKeyName: "lotes_estoque_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locais"
            referencedColumns: ["id"]
          },
        ]
      }
      overhead: {
        Row: {
          custo_mensal: number
          horas_bancada_mes: number
          id: number
          item: string
          percentual_compensada: number
        }
        Insert: {
          custo_mensal?: number
          horas_bancada_mes?: number
          id?: never
          item: string
          percentual_compensada?: number
        }
        Update: {
          custo_mensal?: number
          horas_bancada_mes?: number
          id?: never
          item?: string
          percentual_compensada?: number
        }
        Relationships: []
      }
      parametros: {
        Row: {
          atualizado_em: string
          chave: string
          descricao: string | null
          unidade: string | null
          valor: number
        }
        Insert: {
          atualizado_em?: string
          chave: string
          descricao?: string | null
          unidade?: string | null
          valor: number
        }
        Update: {
          atualizado_em?: string
          chave?: string
          descricao?: string | null
          unidade?: string | null
          valor?: number
        }
        Relationships: []
      }
      pedidos_compra: {
        Row: {
          aprovador: string | null
          criado_em: string
          data_aprovacao: string | null
          data_prevista_entrega: string | null
          data_solicitacao: string
          fornecedor_id: number | null
          id: number
          observacao: string | null
          projeto: string | null
          solicitante: string | null
          status: string
        }
        Insert: {
          aprovador?: string | null
          criado_em?: string
          data_aprovacao?: string | null
          data_prevista_entrega?: string | null
          data_solicitacao?: string
          fornecedor_id?: number | null
          id?: never
          observacao?: string | null
          projeto?: string | null
          solicitante?: string | null
          status?: string
        }
        Update: {
          aprovador?: string | null
          criado_em?: string
          data_aprovacao?: string | null
          data_prevista_entrega?: string | null
          data_solicitacao?: string
          fornecedor_id?: number | null
          id?: never
          observacao?: string | null
          projeto?: string | null
          solicitante?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_compra_itens: {
        Row: {
          custo_unitario_estimado: number | null
          id: number
          insumo_id: number
          lote_id: number | null
          pedido_id: number
          quantidade: number
        }
        Insert: {
          custo_unitario_estimado?: number | null
          id?: never
          insumo_id: number
          lote_id?: number | null
          pedido_id: number
          quantidade: number
        }
        Update: {
          custo_unitario_estimado?: number | null
          id?: never
          insumo_id?: number
          lote_id?: number | null
          pedido_id?: number
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_itens_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_itens_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_estoque_saldo"
            referencedColumns: ["insumo_id"]
          },
          {
            foreignKeyName: "pedidos_compra_itens_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          criado_em: string
          email: string | null
          id: string
          nome: string | null
          papel: string
        }
        Insert: {
          criado_em?: string
          email?: string | null
          id: string
          nome?: string | null
          papel?: string
        }
        Update: {
          criado_em?: string
          email?: string | null
          id?: string
          nome?: string | null
          papel?: string
        }
        Relationships: []
      }
      planejamento: {
        Row: {
          criado_em: string
          data_alvo: string | null
          id: number
          nome: string | null
          observacao: string | null
          projeto: string | null
          responsavel: string | null
        }
        Insert: {
          criado_em?: string
          data_alvo?: string | null
          id?: never
          nome?: string | null
          observacao?: string | null
          projeto?: string | null
          responsavel?: string | null
        }
        Update: {
          criado_em?: string
          data_alvo?: string | null
          id?: never
          nome?: string | null
          observacao?: string | null
          projeto?: string | null
          responsavel?: string | null
        }
        Relationships: []
      }
      planejamento_itens: {
        Row: {
          codigo_analise: string
          id: number
          n_amostras: number
          n_controles: number
          perda_percentual: number
          planejamento_id: number
          repeticoes: number
        }
        Insert: {
          codigo_analise: string
          id?: never
          n_amostras?: number
          n_controles?: number
          perda_percentual?: number
          planejamento_id: number
          repeticoes?: number
        }
        Update: {
          codigo_analise?: string
          id?: never
          n_amostras?: number
          n_controles?: number
          perda_percentual?: number
          planejamento_id?: number
          repeticoes?: number
        }
        Relationships: [
          {
            foreignKeyName: "planejamento_itens_codigo_analise_fkey"
            columns: ["codigo_analise"]
            isOneToOne: false
            referencedRelation: "analises"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "planejamento_itens_planejamento_id_fkey"
            columns: ["planejamento_id"]
            isOneToOne: false
            referencedRelation: "planejamento"
            referencedColumns: ["id"]
          },
        ]
      }
      reservas_estoque: {
        Row: {
          criado_em: string
          id: number
          insumo_id: number
          planejamento_id: number | null
          quantidade: number
          status: string
        }
        Insert: {
          criado_em?: string
          id?: never
          insumo_id: number
          planejamento_id?: number | null
          quantidade: number
          status?: string
        }
        Update: {
          criado_em?: string
          id?: never
          insumo_id?: number
          planejamento_id?: number | null
          quantidade?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservas_estoque_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_estoque_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_estoque_saldo"
            referencedColumns: ["insumo_id"]
          },
          {
            foreignKeyName: "reservas_estoque_planejamento_id_fkey"
            columns: ["planejamento_id"]
            isOneToOne: false
            referencedRelation: "planejamento"
            referencedColumns: ["id"]
          },
        ]
      }
      tecnicos: {
        Row: {
          horas_mes_base: number
          id: number
          nome: string
          percentual_dedicado: number
          processo: string | null
          valor_mes: number
        }
        Insert: {
          horas_mes_base?: number
          id?: never
          nome: string
          percentual_dedicado?: number
          processo?: string | null
          valor_mes?: number
        }
        Update: {
          horas_mes_base?: number
          id?: never
          nome?: string
          percentual_dedicado?: number
          processo?: string | null
          valor_mes?: number
        }
        Relationships: []
      }
    }
    Views: {
      v_alertas_estoque: {
        Row: {
          especificacao: string | null
          insumo_id: number | null
          referencia: number | null
          tipo: string | null
          validade: string | null
          valor: number | null
        }
        Relationships: []
      }
      v_estoque_saldo: {
        Row: {
          bloqueado: number | null
          categoria_compra: string | null
          disponivel: number | null
          em_maos: number | null
          em_quarentena: number | null
          especificacao: string | null
          estoque_seguranca: number | null
          insumo_id: number | null
          lead_time_dias: number | null
          nome_item: string | null
          ponto_reposicao: number | null
          reservado: number | null
          unidade: string | null
          vencido: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      aceitar_lote: {
        Args: { p_criterio?: string; p_lote_id: number; p_responsavel?: string }
        Returns: undefined
      }
      bloquear_lote: {
        Args: { p_lote_id: number; p_motivo: string }
        Returns: undefined
      }
      current_papel: { Args: never; Returns: string }
      dar_baixa_plano: { Args: { p_planejamento_id: number }; Returns: Json }
      desbloquear_lote: { Args: { p_lote_id: number }; Returns: undefined }
      descartar_lote: {
        Args: { p_justificativa: string; p_lote_id: number }
        Returns: undefined
      }
      liberar_plano: { Args: { p_planejamento_id: number }; Returns: undefined }
      receber_lote: {
        Args: {
          p_codigo?: string
          p_custo?: number
          p_fornecedor?: string
          p_insumo_id: number
          p_local_id?: number
          p_nota_fiscal?: string
          p_projeto?: string
          p_quantidade: number
          p_validade?: string
        }
        Returns: number
      }
      reservar_plano: {
        Args: { p_itens: Json; p_planejamento_id: number }
        Returns: undefined
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

