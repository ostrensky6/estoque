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
          nome_simplificado: string | null
          status: string | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          descricao?: string | null
          nome?: string | null
          nome_simplificado?: string | null
          status?: string | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          descricao?: string | null
          nome?: string | null
          nome_simplificado?: string | null
          status?: string | null
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
      clientes: {
        Row: {
          ativo: boolean
          cnpj: string | null
          contato: string | null
          criado_em: string
          email: string | null
          endereco: string | null
          id: number
          nome: string
          observacoes: string | null
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          contato?: string | null
          criado_em?: string
          email?: string | null
          endereco?: string | null
          id?: never
          nome: string
          observacoes?: string | null
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          contato?: string | null
          criado_em?: string
          email?: string | null
          endereco?: string | null
          id?: never
          nome?: string
          observacoes?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      demandas_propostas: {
        Row: {
          cliente_cnpj: string | null
          cliente_contato: string | null
          cliente_id: number | null
          cliente_nome: string | null
          completude_atualizada_em: string | null
          completude_snapshot: Json
          criado_em: string
          data_solicitacao: string
          descricao: string | null
          escopo_preliminar: string | null
          id: number
          instituicao: string | null
          matriz_amostra: string | null
          modalidade: string
          observacoes: string | null
          origem: string | null
          prazo_esperado: string | null
          prazo_tecnico_dias: number | null
          prioridade: string
          projeto_id: number | null
          quantidade_amostras_estimada: number | null
          responsavel_interno: string | null
          status: string
          titulo: string
        }
        Insert: {
          cliente_cnpj?: string | null
          cliente_contato?: string | null
          cliente_id?: number | null
          cliente_nome?: string | null
          completude_atualizada_em?: string | null
          completude_snapshot?: Json
          criado_em?: string
          data_solicitacao?: string
          descricao?: string | null
          escopo_preliminar?: string | null
          id?: never
          instituicao?: string | null
          matriz_amostra?: string | null
          modalidade?: string
          observacoes?: string | null
          origem?: string | null
          prazo_esperado?: string | null
          prazo_tecnico_dias?: number | null
          prioridade?: string
          projeto_id?: number | null
          quantidade_amostras_estimada?: number | null
          responsavel_interno?: string | null
          status?: string
          titulo: string
        }
        Update: {
          cliente_cnpj?: string | null
          cliente_contato?: string | null
          cliente_id?: number | null
          cliente_nome?: string | null
          completude_atualizada_em?: string | null
          completude_snapshot?: Json
          criado_em?: string
          data_solicitacao?: string
          descricao?: string | null
          escopo_preliminar?: string | null
          id?: never
          instituicao?: string | null
          matriz_amostra?: string | null
          modalidade?: string
          observacoes?: string | null
          origem?: string | null
          prazo_esperado?: string | null
          prazo_tecnico_dias?: number | null
          prioridade?: string
          projeto_id?: number | null
          quantidade_amostras_estimada?: number | null
          responsavel_interno?: string | null
          status?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "demandas_propostas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_propostas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
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
      equipamento_manutencoes: {
        Row: {
          criado_em: string
          custo: number | null
          data: string | null
          descricao: string | null
          equipamento_id: number
          id: number
          responsavel: string | null
        }
        Insert: {
          criado_em?: string
          custo?: number | null
          data?: string | null
          descricao?: string | null
          equipamento_id: number
          id?: never
          responsavel?: string | null
        }
        Update: {
          criado_em?: string
          custo?: number | null
          data?: string | null
          descricao?: string | null
          equipamento_id?: number
          id?: never
          responsavel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipamento_manutencoes_equipamento_id_fkey"
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
          data_baixa: string | null
          id: number
          manutencao_anual_fixa: number | null
          nome: string
          numero_patrimonio: string | null
          numero_serie: string | null
          percentual_manutencao_anual: number
          possui: boolean
          professor_id: number | null
          proprietario: string
          quantidade: number
          situacao: string
          vida_util_anos: number | null
        }
        Insert: {
          custo_unitario?: number
          data_aquisicao?: string | null
          data_baixa?: string | null
          id?: never
          manutencao_anual_fixa?: number | null
          nome: string
          numero_patrimonio?: string | null
          numero_serie?: string | null
          percentual_manutencao_anual?: number
          possui?: boolean
          professor_id?: number | null
          proprietario?: string
          quantidade?: number
          situacao?: string
          vida_util_anos?: number | null
        }
        Update: {
          custo_unitario?: number
          data_aquisicao?: string | null
          data_baixa?: string | null
          id?: never
          manutencao_anual_fixa?: number | null
          nome?: string
          numero_patrimonio?: string | null
          numero_serie?: string | null
          percentual_manutencao_anual?: number
          possui?: boolean
          professor_id?: number | null
          proprietario?: string
          quantidade?: number
          situacao?: string
          vida_util_anos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipamentos_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professores"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "estoque_movimentacoes_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_previsao_suprimentos"
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
      eventos_status: {
        Row: {
          criado_em: string
          de_status: string | null
          entidade: string
          entidade_id: number
          id: number
          observacao: string | null
          para_status: string
          usuario: string | null
        }
        Insert: {
          criado_em?: string
          de_status?: string | null
          entidade: string
          entidade_id: number
          id?: never
          observacao?: string | null
          para_status: string
          usuario?: string | null
        }
        Update: {
          criado_em?: string
          de_status?: string | null
          entidade?: string
          entidade_id?: number
          id?: never
          observacao?: string | null
          para_status?: string
          usuario?: string | null
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          ativo: boolean
          catalogo_padrao: string | null
          cnpj: string | null
          contato: string | null
          email: string | null
          endereco: string | null
          id: number
          nome: string
          observacoes: string | null
          prazo_max_dias: number | null
          prazo_medio_dias: number | null
          site: string | null
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          catalogo_padrao?: string | null
          cnpj?: string | null
          contato?: string | null
          email?: string | null
          endereco?: string | null
          id?: never
          nome: string
          observacoes?: string | null
          prazo_max_dias?: number | null
          prazo_medio_dias?: number | null
          site?: string | null
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          catalogo_padrao?: string | null
          cnpj?: string | null
          contato?: string | null
          email?: string | null
          endereco?: string | null
          id?: never
          nome?: string
          observacoes?: string | null
          prazo_max_dias?: number | null
          prazo_medio_dias?: number | null
          site?: string | null
          telefone?: string | null
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
          {
            foreignKeyName: "insumo_analise_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_previsao_suprimentos"
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
          fator_conversao: number
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
          fator_conversao?: number
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
          fator_conversao?: number
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
            foreignKeyName: "lotes_estoque_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_previsao_suprimentos"
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
      notificacoes: {
        Row: {
          canal: string
          corpo: string | null
          criado_em: string
          dedupe_key: string | null
          entidade_id: number | null
          entidade_tipo: string | null
          id: number
          lida_em: string | null
          papel_destino: string | null
          status: string
          tipo: string
          titulo: string
          usuario_destino: string | null
        }
        Insert: {
          canal?: string
          corpo?: string | null
          criado_em?: string
          dedupe_key?: string | null
          entidade_id?: number | null
          entidade_tipo?: string | null
          id?: never
          lida_em?: string | null
          papel_destino?: string | null
          status?: string
          tipo: string
          titulo: string
          usuario_destino?: string | null
        }
        Update: {
          canal?: string
          corpo?: string | null
          criado_em?: string
          dedupe_key?: string | null
          entidade_id?: number | null
          entidade_tipo?: string | null
          id?: never
          lida_em?: string | null
          papel_destino?: string | null
          status?: string
          tipo?: string
          titulo?: string
          usuario_destino?: string | null
        }
        Relationships: []
      }
      orcamento_itens: {
        Row: {
          codigo_analise: string
          custo_unitario: number
          id: number
          n_amostras: number
          orcamento_id: number
          preco_unitario: number
        }
        Insert: {
          codigo_analise: string
          custo_unitario?: number
          id?: never
          n_amostras?: number
          orcamento_id: number
          preco_unitario?: number
        }
        Update: {
          codigo_analise?: string
          custo_unitario?: number
          id?: never
          n_amostras?: number
          orcamento_id?: number
          preco_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_codigo_analise_fkey"
            columns: ["codigo_analise"]
            isOneToOne: false
            referencedRelation: "analises"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_projeto_analises: {
        Row: {
          codigo_analise: string
          custo_unitario: number
          id: number
          n_amostras: number
          orcamento_projeto_id: number
          preco_unitario: number
        }
        Insert: {
          codigo_analise: string
          custo_unitario?: number
          id?: never
          n_amostras?: number
          orcamento_projeto_id: number
          preco_unitario?: number
        }
        Update: {
          codigo_analise?: string
          custo_unitario?: number
          id?: never
          n_amostras?: number
          orcamento_projeto_id?: number
          preco_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_projeto_analises_codigo_analise_fkey"
            columns: ["codigo_analise"]
            isOneToOne: false
            referencedRelation: "analises"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "orcamento_projeto_analises_orcamento_projeto_id_fkey"
            columns: ["orcamento_projeto_id"]
            isOneToOne: false
            referencedRelation: "orcamento_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_projeto_anexos: {
        Row: {
          content_type: string | null
          criado_em: string
          criado_por: string | null
          id: number
          nome_arquivo: string
          orcamento_projeto_id: number
          path: string
          tamanho: number | null
        }
        Insert: {
          content_type?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: never
          nome_arquivo: string
          orcamento_projeto_id: number
          path: string
          tamanho?: number | null
        }
        Update: {
          content_type?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: never
          nome_arquivo?: string
          orcamento_projeto_id?: number
          path?: string
          tamanho?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_projeto_anexos_orcamento_projeto_id_fkey"
            columns: ["orcamento_projeto_id"]
            isOneToOne: false
            referencedRelation: "orcamento_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_projeto_catalogo: {
        Row: {
          ativo: boolean
          atualizado_em: string
          categoria: string | null
          criado_em: string
          descricao: string
          id: string
          origem: string
          preco_unitario: number
          rubrica: string
          unidade: string | null
          valid_from: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string | null
          criado_em?: string
          descricao: string
          id: string
          origem?: string
          preco_unitario?: number
          rubrica: string
          unidade?: string | null
          valid_from?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string | null
          criado_em?: string
          descricao?: string
          id?: string
          origem?: string
          preco_unitario?: number
          rubrica?: string
          unidade?: string | null
          valid_from?: string | null
        }
        Relationships: []
      }
      orcamento_projeto_custos: {
        Row: {
          catalogo_item_id: string | null
          atividade: string | null
          categoria: string
          categoria_institucional: string | null
          custo_unitario: number
          descricao: string
          entrega: string | null
          etapa: string | null
          id: number
          meses_selecionados: number[]
          nomenclatura_origem: string
          orcamento_projeto_id: number
          origem: string
          preco_unitario: number
          quantidade: number
          rubrica: string | null
          unidade: string | null
        }
        Insert: {
          catalogo_item_id?: string | null
          atividade?: string | null
          categoria: string
          categoria_institucional?: string | null
          custo_unitario?: number
          descricao: string
          entrega?: string | null
          etapa?: string | null
          id?: never
          meses_selecionados?: number[]
          nomenclatura_origem?: string
          orcamento_projeto_id: number
          origem?: string
          preco_unitario?: number
          quantidade?: number
          rubrica?: string | null
          unidade?: string | null
        }
        Update: {
          catalogo_item_id?: string | null
          atividade?: string | null
          categoria?: string
          categoria_institucional?: string | null
          custo_unitario?: number
          descricao?: string
          entrega?: string | null
          etapa?: string | null
          id?: never
          meses_selecionados?: number[]
          nomenclatura_origem?: string
          orcamento_projeto_id?: number
          origem?: string
          preco_unitario?: number
          quantidade?: number
          rubrica?: string | null
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_projeto_custos_catalogo_item_id_fkey"
            columns: ["catalogo_item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_projeto_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_projeto_custos_orcamento_projeto_id_fkey"
            columns: ["orcamento_projeto_id"]
            isOneToOne: false
            referencedRelation: "orcamento_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_projeto_links: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          criado_em: string
          criado_por: string | null
          expira_em: string | null
          id: number
          orcamento_projeto_id: number
          revogado: boolean
          token_hash: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          expira_em?: string | null
          id?: never
          orcamento_projeto_id: number
          revogado?: boolean
          token_hash: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          expira_em?: string | null
          id?: never
          orcamento_projeto_id?: number
          revogado?: boolean
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_projeto_links_orcamento_projeto_id_fkey"
            columns: ["orcamento_projeto_id"]
            isOneToOne: false
            referencedRelation: "orcamento_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_projeto_templates: {
        Row: {
          criado_em: string
          descricao: string | null
          id: number
          itens: Json
          nome: string
          origem: string
          parametros: Json
        }
        Insert: {
          criado_em?: string
          descricao?: string | null
          id?: never
          itens?: Json
          nome: string
          origem?: string
          parametros?: Json
        }
        Update: {
          criado_em?: string
          descricao?: string | null
          id?: never
          itens?: Json
          nome?: string
          origem?: string
          parametros?: Json
        }
        Relationships: []
      }
      orcamento_projetos: {
        Row: {
          cliente_cnpj: string | null
          cliente_contato: string | null
          cliente_detalhes: string | null
          cliente_email: string | null
          cliente_endereco: string | null
          cliente_id: number | null
          cliente_nome: string | null
          cliente_telefone: string | null
          coordenador: string | null
          criado_em: string
          cronograma: string | null
          data_orcamento: string
          demanda_id: number | null
          escopo: string | null
          id: number
          impostos: number
          impostos_legacy: number
          incubacao: number
          investimentos: number
          lucro: number
          margem_lucro: number
          numero: string | null
          observacoes: string | null
          project_months: number
          projeto_sem_custo_justificativa: string | null
          projeto_id: number | null
          proprietario: string | null
          reserva: number
          responsavel: string | null
          status: string
          titulo: string
          travel_inputs: Json
          validade_dias: number
        }
        Insert: {
          cliente_cnpj?: string | null
          cliente_contato?: string | null
          cliente_detalhes?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_id?: number | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          coordenador?: string | null
          criado_em?: string
          cronograma?: string | null
          data_orcamento?: string
          demanda_id?: number | null
          escopo?: string | null
          id?: never
          impostos?: number
          impostos_legacy?: number
          incubacao?: number
          investimentos?: number
          lucro?: number
          margem_lucro?: number
          numero?: string | null
          observacoes?: string | null
          project_months?: number
          projeto_sem_custo_justificativa?: string | null
          projeto_id?: number | null
          proprietario?: string | null
          reserva?: number
          responsavel?: string | null
          status?: string
          titulo: string
          travel_inputs?: Json
          validade_dias?: number
        }
        Update: {
          cliente_cnpj?: string | null
          cliente_contato?: string | null
          cliente_detalhes?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_id?: number | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          coordenador?: string | null
          criado_em?: string
          cronograma?: string | null
          data_orcamento?: string
          demanda_id?: number | null
          escopo?: string | null
          id?: never
          impostos?: number
          impostos_legacy?: number
          incubacao?: number
          investimentos?: number
          lucro?: number
          margem_lucro?: number
          numero?: string | null
          observacoes?: string | null
          project_months?: number
          projeto_sem_custo_justificativa?: string | null
          projeto_id?: number | null
          proprietario?: string | null
          reserva?: number
          responsavel?: string | null
          status?: string
          titulo?: string
          travel_inputs?: Json
          validade_dias?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_projetos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_projetos_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas_propostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_projetos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_final_versoes: {
        Row: {
          criado_em: string
          criado_por: string | null
          cancelado_em: string | null
          cancelado_motivo: string | null
          demanda_id: number
          duplicada_de_id: number | null
          id: number
          numero: string
          snapshot: Json
          status: string
          total_final: number
          total_laboratorio_custo: number
          total_laboratorio_preco: number
          total_projeto_custo: number
          total_projeto_final: number
          validade_dias: number
          valido_ate: string | null
          versao: number
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          cancelado_em?: string | null
          cancelado_motivo?: string | null
          demanda_id: number
          duplicada_de_id?: number | null
          id?: never
          numero: string
          snapshot?: Json
          status?: string
          total_final?: number
          total_laboratorio_custo?: number
          total_laboratorio_preco?: number
          total_projeto_custo?: number
          total_projeto_final?: number
          validade_dias?: number
          valido_ate?: string | null
          versao: number
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          cancelado_em?: string | null
          cancelado_motivo?: string | null
          demanda_id?: number
          duplicada_de_id?: number | null
          id?: never
          numero?: string
          snapshot?: Json
          status?: string
          total_final?: number
          total_laboratorio_custo?: number
          total_laboratorio_preco?: number
          total_projeto_custo?: number
          total_projeto_final?: number
          validade_dias?: number
          valido_ate?: string | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_final_versoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_final_versoes_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas_propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_parametros_aplicados: {
        Row: {
          alertas_snapshot: Json
          criado_em: string
          criado_por: string | null
          demanda_id: number | null
          formula_snapshot: Json
          id: number
          laboratorio_modo: string
          metodo_calculo: string
          orcamento_final_versao_id: number | null
          orcamento_laboratorial_id: number | null
          orcamento_projeto_id: number | null
          origem: string
          parametros_snapshot: Json
          subtotal_custos: number
          subtotal_laboratorio: number
          subtotal_projeto: number
          total_final: number
          total_parametros: number
          versao: number
        }
        Insert: {
          alertas_snapshot?: Json
          criado_em?: string
          criado_por?: string | null
          demanda_id?: number | null
          formula_snapshot?: Json
          id?: never
          laboratorio_modo?: string
          metodo_calculo: string
          orcamento_final_versao_id?: number | null
          orcamento_laboratorial_id?: number | null
          orcamento_projeto_id?: number | null
          origem?: string
          parametros_snapshot?: Json
          subtotal_custos?: number
          subtotal_laboratorio?: number
          subtotal_projeto?: number
          total_final?: number
          total_parametros?: number
          versao?: number
        }
        Update: {
          alertas_snapshot?: Json
          criado_em?: string
          criado_por?: string | null
          demanda_id?: number | null
          formula_snapshot?: Json
          id?: never
          laboratorio_modo?: string
          metodo_calculo?: string
          orcamento_final_versao_id?: number | null
          orcamento_laboratorial_id?: number | null
          orcamento_projeto_id?: number | null
          origem?: string
          parametros_snapshot?: Json
          subtotal_custos?: number
          subtotal_laboratorio?: number
          subtotal_projeto?: number
          total_final?: number
          total_parametros?: number
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_parametros_aplicados_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas_propostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_parametros_aplicados_orcamento_final_versao_id_fkey"
            columns: ["orcamento_final_versao_id"]
            isOneToOne: false
            referencedRelation: "orcamento_final_versoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_parametros_aplicados_orcamento_laboratorial_id_fkey"
            columns: ["orcamento_laboratorial_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_parametros_aplicados_orcamento_projeto_id_fkey"
            columns: ["orcamento_projeto_id"]
            isOneToOne: false
            referencedRelation: "orcamento_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          cliente_cnpj: string | null
          cliente_contato: string | null
          cliente_endereco: string | null
          cliente_id: number | null
          cliente_nome: string
          criado_em: string
          data_orcamento: string
          demanda_id: number | null
          id: number
          observacoes: string | null
          projeto_id: number | null
          responsavel: string | null
          status: string
          status_operacional: string
          status_operacional_atualizado_em: string | null
          custo_snapshot: Json
          tipo: string
          validade_dias: number
        }
        Insert: {
          cliente_cnpj?: string | null
          cliente_contato?: string | null
          cliente_endereco?: string | null
          cliente_id?: number | null
          cliente_nome: string
          criado_em?: string
          data_orcamento?: string
          demanda_id?: number | null
          id?: never
          observacoes?: string | null
          projeto_id?: number | null
          responsavel?: string | null
          status?: string
          status_operacional?: string
          status_operacional_atualizado_em?: string | null
          custo_snapshot?: Json
          tipo?: string
          validade_dias?: number
        }
        Update: {
          cliente_cnpj?: string | null
          cliente_contato?: string | null
          cliente_endereco?: string | null
          cliente_id?: number | null
          cliente_nome?: string
          criado_em?: string
          data_orcamento?: string
          demanda_id?: number | null
          id?: never
          observacoes?: string | null
          projeto_id?: number | null
          responsavel?: string | null
          status?: string
          status_operacional?: string
          status_operacional_atualizado_em?: string | null
          custo_snapshot?: Json
          tipo?: string
          validade_dias?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas_propostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
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
      parametros_economicos_versoes: {
        Row: {
          criado_em: string
          criado_por: string | null
          escopo: string
          id: number
          orcamento_projeto_id: number | null
          origem: string
          parametros: Json
          versao: number
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          escopo: string
          id?: never
          orcamento_projeto_id?: number | null
          origem?: string
          parametros: Json
          versao: number
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          escopo?: string
          id?: never
          orcamento_projeto_id?: number | null
          origem?: string
          parametros?: Json
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "parametros_economicos_versoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parametros_economicos_versoes_orcamento_projeto_id_fkey"
            columns: ["orcamento_projeto_id"]
            isOneToOne: false
            referencedRelation: "orcamento_projetos"
            referencedColumns: ["id"]
          },
        ]
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
          projeto_id: number | null
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
          projeto_id?: number | null
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
          projeto_id?: number | null
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
          {
            foreignKeyName: "pedidos_compra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_compra_itens: {
        Row: {
          custo_unitario_estimado: number | null
          divergencia_recebimento: string | null
          id: number
          insumo_id: number
          lote_id: number | null
          pedido_id: number
          quantidade: number
          quantidade_recebida: number | null
        }
        Insert: {
          custo_unitario_estimado?: number | null
          divergencia_recebimento?: string | null
          id?: never
          insumo_id: number
          lote_id?: number | null
          pedido_id: number
          quantidade: number
          quantidade_recebida?: number | null
        }
        Update: {
          custo_unitario_estimado?: number | null
          divergencia_recebimento?: string | null
          id?: never
          insumo_id?: number
          lote_id?: number | null
          pedido_id?: number
          quantidade?: number
          quantidade_recebida?: number | null
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
            foreignKeyName: "pedidos_compra_itens_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_previsao_suprimentos"
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
      pedidos_internos: {
        Row: {
          analisado_em: string | null
          aprovacao_final_em: string | null
          atualizado_em: string
          comprador_responsavel: string | null
          concluido_em: string | null
          conformidade_admin: string | null
          criado_em: string
          data_necessidade: string | null
          encaminhado_em: string | null
          enviado_validacao_em: string | null
          fechado_em: string | null
          fonte_recurso: string | null
          formalizado_em: string | null
          id: number
          justificativa: string | null
          observacao_compras: string | null
          orcamento_previo_total: number | null
          orcamentos_em: string | null
          pagamento_nf_em: string | null
          pedido_compra_id: number | null
          planejamento_id: number | null
          projeto_id: number | null
          recebido_em: string | null
          recebido_por: string | null
          rubrica: string | null
          solicitante: string | null
          status: string
          titulo: string
          urgencia: string
          validado_em: string | null
        }
        Insert: {
          analisado_em?: string | null
          aprovacao_final_em?: string | null
          atualizado_em?: string
          comprador_responsavel?: string | null
          concluido_em?: string | null
          conformidade_admin?: string | null
          criado_em?: string
          data_necessidade?: string | null
          encaminhado_em?: string | null
          enviado_validacao_em?: string | null
          fechado_em?: string | null
          fonte_recurso?: string | null
          formalizado_em?: string | null
          id?: never
          justificativa?: string | null
          observacao_compras?: string | null
          orcamento_previo_total?: number | null
          orcamentos_em?: string | null
          pagamento_nf_em?: string | null
          pedido_compra_id?: number | null
          planejamento_id?: number | null
          projeto_id?: number | null
          recebido_em?: string | null
          recebido_por?: string | null
          rubrica?: string | null
          solicitante?: string | null
          status?: string
          titulo: string
          urgencia?: string
          validado_em?: string | null
        }
        Update: {
          analisado_em?: string | null
          aprovacao_final_em?: string | null
          atualizado_em?: string
          comprador_responsavel?: string | null
          concluido_em?: string | null
          conformidade_admin?: string | null
          criado_em?: string
          data_necessidade?: string | null
          encaminhado_em?: string | null
          enviado_validacao_em?: string | null
          fechado_em?: string | null
          fonte_recurso?: string | null
          formalizado_em?: string | null
          id?: never
          justificativa?: string | null
          observacao_compras?: string | null
          orcamento_previo_total?: number | null
          orcamentos_em?: string | null
          pagamento_nf_em?: string | null
          pedido_compra_id?: number | null
          planejamento_id?: number | null
          projeto_id?: number | null
          recebido_em?: string | null
          recebido_por?: string | null
          rubrica?: string | null
          solicitante?: string | null
          status?: string
          titulo?: string
          urgencia?: string
          validado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_internos_pedido_compra_id_fkey"
            columns: ["pedido_compra_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_internos_planejamento_id_fkey"
            columns: ["planejamento_id"]
            isOneToOne: false
            referencedRelation: "planejamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_internos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_internos_anexos: {
        Row: {
          criado_em: string
          etapa: string | null
          id: number
          observacao: string | null
          pedido_interno_id: number
          tipo: string
          titulo: string
          url: string | null
          usuario: string | null
        }
        Insert: {
          criado_em?: string
          etapa?: string | null
          id?: never
          observacao?: string | null
          pedido_interno_id: number
          tipo?: string
          titulo: string
          url?: string | null
          usuario?: string | null
        }
        Update: {
          criado_em?: string
          etapa?: string | null
          id?: never
          observacao?: string | null
          pedido_interno_id?: number
          tipo?: string
          titulo?: string
          url?: string | null
          usuario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_internos_anexos_pedido_interno_id_fkey"
            columns: ["pedido_interno_id"]
            isOneToOne: false
            referencedRelation: "pedidos_internos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_internos_aprovacoes: {
        Row: {
          comentario: string | null
          criado_em: string
          decisao: string
          etapa: string
          id: number
          papel: string | null
          pedido_interno_id: number
          responsavel: string | null
          status_destino: string | null
          status_origem: string | null
        }
        Insert: {
          comentario?: string | null
          criado_em?: string
          decisao: string
          etapa: string
          id?: never
          papel?: string | null
          pedido_interno_id: number
          responsavel?: string | null
          status_destino?: string | null
          status_origem?: string | null
        }
        Update: {
          comentario?: string | null
          criado_em?: string
          decisao?: string
          etapa?: string
          id?: never
          papel?: string | null
          pedido_interno_id?: number
          responsavel?: string | null
          status_destino?: string | null
          status_origem?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_internos_aprovacoes_pedido_interno_id_fkey"
            columns: ["pedido_interno_id"]
            isOneToOne: false
            referencedRelation: "pedidos_internos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_internos_comunicacoes: {
        Row: {
          assunto: string | null
          criado_em: string
          destinatarios: string | null
          etapa: string | null
          id: number
          observacao: string | null
          pedido_interno_id: number
          referencia: string | null
          remetente: string | null
          tipo: string
          usuario: string | null
        }
        Insert: {
          assunto?: string | null
          criado_em?: string
          destinatarios?: string | null
          etapa?: string | null
          id?: never
          observacao?: string | null
          pedido_interno_id: number
          referencia?: string | null
          remetente?: string | null
          tipo?: string
          usuario?: string | null
        }
        Update: {
          assunto?: string | null
          criado_em?: string
          destinatarios?: string | null
          etapa?: string | null
          id?: never
          observacao?: string | null
          pedido_interno_id?: number
          referencia?: string | null
          remetente?: string | null
          tipo?: string
          usuario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_internos_comunicacoes_pedido_interno_id_fkey"
            columns: ["pedido_interno_id"]
            isOneToOne: false
            referencedRelation: "pedidos_internos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_internos_itens: {
        Row: {
          criado_em: string
          divergencia_recebimento: string | null
          especificacao: string
          fornecedor_sugerido: string | null
          id: number
          insumo_id: number | null
          lote_id: number | null
          modelo: string | null
          observacao: string | null
          orcamento_previo: number | null
          pedido_interno_id: number
          quantidade: number
          quantidade_recebida: number | null
          recebido_em: string | null
          recebido_por: string | null
          tipo: string
          unidade: string | null
          volume: string | null
        }
        Insert: {
          criado_em?: string
          divergencia_recebimento?: string | null
          especificacao: string
          fornecedor_sugerido?: string | null
          id?: never
          insumo_id?: number | null
          lote_id?: number | null
          modelo?: string | null
          observacao?: string | null
          orcamento_previo?: number | null
          pedido_interno_id: number
          quantidade?: number
          quantidade_recebida?: number | null
          recebido_em?: string | null
          recebido_por?: string | null
          tipo?: string
          unidade?: string | null
          volume?: string | null
        }
        Update: {
          criado_em?: string
          divergencia_recebimento?: string | null
          especificacao?: string
          fornecedor_sugerido?: string | null
          id?: never
          insumo_id?: number | null
          lote_id?: number | null
          modelo?: string | null
          observacao?: string | null
          orcamento_previo?: number | null
          pedido_interno_id?: number
          quantidade?: number
          quantidade_recebida?: number | null
          recebido_em?: string | null
          recebido_por?: string | null
          tipo?: string
          unidade?: string | null
          volume?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_internos_itens_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_internos_itens_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_estoque_saldo"
            referencedColumns: ["insumo_id"]
          },
          {
            foreignKeyName: "pedidos_internos_itens_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_previsao_suprimentos"
            referencedColumns: ["insumo_id"]
          },
          {
            foreignKeyName: "pedidos_internos_itens_pedido_interno_id_fkey"
            columns: ["pedido_interno_id"]
            isOneToOne: false
            referencedRelation: "pedidos_internos"
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
          senha_provisoria: boolean
          suspenso: boolean
        }
        Insert: {
          criado_em?: string
          email?: string | null
          id: string
          nome?: string | null
          papel?: string
          senha_provisoria?: boolean
          suspenso?: boolean
        }
        Update: {
          criado_em?: string
          email?: string | null
          id?: string
          nome?: string | null
          papel?: string
          senha_provisoria?: boolean
          suspenso?: boolean
        }
        Relationships: []
      }
      planejamento: {
        Row: {
          concluido_em: string | null
          criado_em: string
          data_alvo: string | null
          id: number
          iniciado_em: string | null
          nome: string | null
          observacao: string | null
          projeto: string | null
          projeto_id: number | null
          reservado_em: string | null
          responsavel: string | null
          status_operacional: string
        }
        Insert: {
          concluido_em?: string | null
          criado_em?: string
          data_alvo?: string | null
          id?: never
          iniciado_em?: string | null
          nome?: string | null
          observacao?: string | null
          projeto?: string | null
          projeto_id?: number | null
          reservado_em?: string | null
          responsavel?: string | null
          status_operacional?: string
        }
        Update: {
          concluido_em?: string | null
          criado_em?: string
          data_alvo?: string | null
          id?: never
          iniciado_em?: string | null
          nome?: string | null
          observacao?: string | null
          projeto?: string | null
          projeto_id?: number | null
          reservado_em?: string | null
          responsavel?: string | null
          status_operacional?: string
        }
        Relationships: [
          {
            foreignKeyName: "planejamento_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
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
      professores: {
        Row: {
          ativo: boolean
          criado_em: string
          departamento: string | null
          email: string | null
          id: number
          nome: string
          observacoes: string | null
          siape: string | null
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          departamento?: string | null
          email?: string | null
          id?: never
          nome: string
          observacoes?: string | null
          siape?: string | null
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          departamento?: string | null
          email?: string | null
          id?: never
          nome?: string
          observacoes?: string | null
          siape?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      projetos: {
        Row: {
          cliente_id: number | null
          coordenador: string | null
          criado_em: string
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          id: number
          nome: string
          status: string
        }
        Insert: {
          cliente_id?: number | null
          coordenador?: string | null
          criado_em?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: never
          nome: string
          status?: string
        }
        Update: {
          cliente_id?: number | null
          coordenador?: string | null
          criado_em?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: never
          nome?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "projetos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
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
            foreignKeyName: "reservas_estoque_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "v_previsao_suprimentos"
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
      v_dashboard_executivo: {
        Row: {
          compras_abertas_valor: number | null
          gasto_por_projeto_mes: Json | null
          lotes_vencendo_horizonte: number | null
          margem_media_pct: number | null
          orcamentos_aprovados: number | null
          orcamentos_enviados: number | null
          orcamentos_perdidos: number | null
          orcamentos_rascunho: number | null
          valor_estoque_ativo: number | null
          valor_vencendo_horizonte: number | null
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
      v_previsao_suprimentos: {
        Row: {
          categoria_compra: string | null
          consumo_janela: number | null
          consumo_medio_diario: number | null
          custo_unitario: number | null
          dias_cobertura: number | null
          disponivel: number | null
          em_maos: number | null
          especificacao: string | null
          estoque_seguranca: number | null
          fornecedor_id: number | null
          fornecedor_nome: string | null
          insumo_id: number | null
          janela_dias: number | null
          lead_time_dias: number | null
          ponto_reposicao_configurado: number | null
          ponto_reposicao_sugerido: number | null
          qtd_pedida_aberta: number | null
          qtd_sugerida_compra: number | null
          reservado: number | null
          unidade: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insumos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aceitar_lote: {
        Args: { p_criterio?: string; p_lote_id: number; p_responsavel?: string }
        Returns: undefined
      }
      aprovar_orcamento_publico: {
        Args: { p_nome: string; p_token: string }
        Returns: boolean
      }
      bloquear_lote: {
        Args: { p_lote_id: number; p_motivo: string }
        Returns: undefined
      }
      emitir_orcamento_final_transacional: {
        Args: {
          p_demanda_id: number
          p_validade_dias: number
          p_total_laboratorio_custo: number
          p_total_laboratorio_preco: number
          p_total_projeto_custo: number
          p_total_projeto_final: number
          p_total_final: number
          p_snapshot: Json
          p_parametros: Json
          p_criado_por: string | null
          p_usuario_email: string | null
        }
        Returns: Json
      }
      current_papel: { Args: never; Returns: string }
      dar_baixa_plano: { Args: { p_planejamento_id: number }; Returns: Json }
      desbloquear_lote: { Args: { p_lote_id: number }; Returns: undefined }
      descartar_lote: {
        Args: { p_justificativa: string; p_lote_id: number }
        Returns: undefined
      }
      entrada_inventario: {
        Args: {
          p_codigo?: string
          p_custo?: number
          p_fornecedor?: string
          p_insumo_id: number
          p_motivo?: string
          p_quantidade: number
          p_validade?: string
        }
        Returns: number
      }
      fn_exige_papel: { Args: { p_min: string }; Returns: undefined }
      gerar_reposicao_automatica: { Args: never; Returns: Json }
      ler_orcamento_publico: { Args: { p_token: string }; Returns: Json }
      liberar_plano: { Args: { p_planejamento_id: number }; Returns: undefined }
      papel_minimo: { Args: { p_min: string }; Returns: boolean }
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

