
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "adjustments": {
                  Row: {
                    "adjustment_date": string,"amount_fils": number,"approved_by": string | null,"charge_id": string | null,"contract_id": string,"created_at": string,"created_by": string | null,"id": string,"kind": Database["public"]['Enums']["adjustment_kind"],"org_id": string,"reason": string,"updated_at": string
                  }
                  Insert: {
                    "adjustment_date"?: string,"amount_fils": number,"approved_by"?: string | null,"charge_id"?: string | null,"contract_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["adjustment_kind"],"org_id": string,"reason": string,"updated_at"?: string
                  }
                  Update: {
                    "adjustment_date"?: string,"amount_fils"?: number,"approved_by"?: string | null,"charge_id"?: string | null,"contract_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["adjustment_kind"],"org_id"?: string,"reason"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "adjustments_charge_id_fkey"
      columns: ["charge_id"]
isOneToOne: false
      referencedRelation: "charges"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "adjustments_charge_id_fkey"
      columns: ["charge_id"]
isOneToOne: false
      referencedRelation: "v_charge_balances"
      referencedColumns: ["charge_id"]
    },{
      foreignKeyName: "adjustments_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "adjustments_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "v_contract_balances"
      referencedColumns: ["contract_id"]
    },{
      foreignKeyName: "adjustments_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "v_unit_status_today"
      referencedColumns: ["contract_id"]
    },{
      foreignKeyName: "adjustments_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"attachments": {
                  Row: {
                    "bucket": string,"created_at": string,"created_by": string | null,"entity_id": string,"entity_type": string,"file_name": string,"id": string,"mime": string | null,"org_id": string,"path": string,"size": number | null,"updated_at": string,"uploaded_by": string | null
                  }
                  Insert: {
                    "bucket"?: string,"created_at"?: string,"created_by"?: string | null,"entity_id": string,"entity_type": string,"file_name": string,"id"?: string,"mime"?: string | null,"org_id": string,"path": string,"size"?: number | null,"updated_at"?: string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "bucket"?: string,"created_at"?: string,"created_by"?: string | null,"entity_id"?: string,"entity_type"?: string,"file_name"?: string,"id"?: string,"mime"?: string | null,"org_id"?: string,"path"?: string,"size"?: number | null,"updated_at"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "attachments_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"after": Json | null,"at": string,"before": Json | null,"created_at": string,"created_by": string | null,"entity_id": string | null,"entity_type": string,"id": string,"org_id": string,"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "action": string,"after"?: Json | null,"at"?: string,"before"?: Json | null,"created_at"?: string,"created_by"?: string | null,"entity_id"?: string | null,"entity_type": string,"id"?: string,"org_id": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"after"?: Json | null,"at"?: string,"before"?: Json | null,"created_at"?: string,"created_by"?: string | null,"entity_id"?: string | null,"entity_type"?: string,"id"?: string,"org_id"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"beneficiaries": {
                  Row: {
                    "active": boolean,"created_at": string,"created_by": string | null,"id": string,"kind": Database["public"]['Enums']["beneficiary_kind"],"monthly_salary_fils": number | null,"name": string,"notes": string | null,"org_id": string,"phone": string | null,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["beneficiary_kind"],"monthly_salary_fils"?: number | null,"name": string,"notes"?: string | null,"org_id": string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["beneficiary_kind"],"monthly_salary_fils"?: number | null,"name"?: string,"notes"?: string | null,"org_id"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "beneficiaries_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"charges": {
                  Row: {
                    "amount_fils": number,"contract_id": string,"created_at": string,"created_by": string | null,"description": string | null,"due_date": string,"id": string,"kind": Database["public"]['Enums']["charge_kind"],"org_id": string,"period": string,"unit_id": string | null,"updated_at": string,"void_reason": string | null,"voided": boolean,"waived_value_fils": number
                  }
                  Insert: {
                    "amount_fils": number,"contract_id": string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"due_date": string,"id"?: string,"kind": Database["public"]['Enums']["charge_kind"],"org_id": string,"period": string,"unit_id"?: string | null,"updated_at"?: string,"void_reason"?: string | null,"voided"?: boolean,"waived_value_fils"?: number
                  }
                  Update: {
                    "amount_fils"?: number,"contract_id"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"due_date"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["charge_kind"],"org_id"?: string,"period"?: string,"unit_id"?: string | null,"updated_at"?: string,"void_reason"?: string | null,"voided"?: boolean,"waived_value_fils"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "charges_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "charges_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "v_contract_balances"
      referencedColumns: ["contract_id"]
    },{
      foreignKeyName: "charges_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "v_unit_status_today"
      referencedColumns: ["contract_id"]
    },{
      foreignKeyName: "charges_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "charges_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "charges_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "v_unit_status_today"
      referencedColumns: ["unit_id"]
    }
                  ]
                },"contract_rent_revisions": {
                  Row: {
                    "contract_id": string,"created_at": string,"created_by": string | null,"effective_from": string,"id": string,"monthly_rent_fils": number,"org_id": string,"reason": string | null,"updated_at": string
                  }
                  Insert: {
                    "contract_id": string,"created_at"?: string,"created_by"?: string | null,"effective_from": string,"id"?: string,"monthly_rent_fils": number,"org_id": string,"reason"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "contract_id"?: string,"created_at"?: string,"created_by"?: string | null,"effective_from"?: string,"id"?: string,"monthly_rent_fils"?: number,"org_id"?: string,"reason"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contract_rent_revisions_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contract_rent_revisions_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "v_contract_balances"
      referencedColumns: ["contract_id"]
    },{
      foreignKeyName: "contract_rent_revisions_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "v_unit_status_today"
      referencedColumns: ["contract_id"]
    },{
      foreignKeyName: "contract_rent_revisions_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"contract_templates": {
                  Row: {
                    "active": boolean,"closing": string | null,"created_at": string,"created_by": string | null,"family_id": string,"id": string,"is_default": boolean,"name": string,"org_id": string | null,"preamble": string,"type": Database["public"]['Enums']["contract_type"],"updated_at": string,"version": number
                  }
                  Insert: {
                    "active"?: boolean,"closing"?: string | null,"created_at"?: string,"created_by"?: string | null,"family_id"?: string,"id"?: string,"is_default"?: boolean,"name": string,"org_id"?: string | null,"preamble": string,"type": Database["public"]['Enums']["contract_type"],"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "active"?: boolean,"closing"?: string | null,"created_at"?: string,"created_by"?: string | null,"family_id"?: string,"id"?: string,"is_default"?: boolean,"name"?: string,"org_id"?: string | null,"preamble"?: string,"type"?: Database["public"]['Enums']["contract_type"],"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "contract_templates_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"contract_units": {
                  Row: {
                    "contract_id": string,"created_at": string,"created_by": string | null,"id": string,"is_live": boolean,"occupancy": unknown,"org_id": string,"rent_share_fils": number | null,"unit_id": string,"updated_at": string
                  }
                  Insert: {
                    "contract_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_live"?: boolean,"occupancy"?: unknown,"org_id": string,"rent_share_fils"?: number | null,"unit_id": string,"updated_at"?: string
                  }
                  Update: {
                    "contract_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_live"?: boolean,"occupancy"?: unknown,"org_id"?: string,"rent_share_fils"?: number | null,"unit_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contract_units_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contract_units_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "v_contract_balances"
      referencedColumns: ["contract_id"]
    },{
      foreignKeyName: "contract_units_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "v_unit_status_today"
      referencedColumns: ["contract_id"]
    },{
      foreignKeyName: "contract_units_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contract_units_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contract_units_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "v_unit_status_today"
      referencedColumns: ["unit_id"]
    }
                  ]
                },"contracts": {
                  Row: {
                    "activated_at": string | null,"annual_increase_every_months": number | null,"annual_increase_kind": Database["public"]['Enums']["increase_kind"] | null,"annual_increase_value": number | null,"auto_renew": boolean,"clause_overrides": NonNullable<Json>,"contract_date": string,"contract_no": string,"created_at": string,"created_by": string | null,"custom_clauses": NonNullable<Json>,"deposit_status": Database["public"]['Enums']["deposit_status"],"electricity_fixed_fils": number,"end_date": string,"expected_move_out": string | null,"first_collection_date": string,"free_months": number,"free_months_penalty_window_months": number,"id": string,"monthly_rent_fils": number,"move_out_date": string | null,"notes": string | null,"notice_date": string | null,"notice_period_months": number,"org_id": string,"owner_id": string | null,"property_id": string,"purpose": string,"rendered_clauses": Json | null,"renewal_term_months": number | null,"renewed_from_id": string | null,"security_deposit_fils": number,"signed_file_path": string | null,"start_date": string,"status": Database["public"]['Enums']["contract_status"],"template_id": string | null,"tenant_id": string,"term_months": number,"termination_reason": string | null,"type": Database["public"]['Enums']["contract_type"],"updated_at": string,"utilities_party": Database["public"]['Enums']["utilities_party"]
                  }
                  Insert: {
                    "activated_at"?: string | null,"annual_increase_every_months"?: number | null,"annual_increase_kind"?: Database["public"]['Enums']["increase_kind"] | null,"annual_increase_value"?: number | null,"auto_renew"?: boolean,"clause_overrides"?: NonNullable<Json>,"contract_date": string,"contract_no": string,"created_at"?: string,"created_by"?: string | null,"custom_clauses"?: NonNullable<Json>,"deposit_status"?: Database["public"]['Enums']["deposit_status"],"electricity_fixed_fils"?: number,"end_date": string,"expected_move_out"?: string | null,"first_collection_date": string,"free_months"?: number,"free_months_penalty_window_months"?: number,"id"?: string,"monthly_rent_fils": number,"move_out_date"?: string | null,"notes"?: string | null,"notice_date"?: string | null,"notice_period_months"?: number,"org_id": string,"owner_id"?: string | null,"property_id": string,"purpose"?: string,"rendered_clauses"?: Json | null,"renewal_term_months"?: number | null,"renewed_from_id"?: string | null,"security_deposit_fils"?: number,"signed_file_path"?: string | null,"start_date": string,"status"?: Database["public"]['Enums']["contract_status"],"template_id"?: string | null,"tenant_id": string,"term_months"?: number,"termination_reason"?: string | null,"type": Database["public"]['Enums']["contract_type"],"updated_at"?: string,"utilities_party"?: Database["public"]['Enums']["utilities_party"]
                  }
                  Update: {
                    "activated_at"?: string | null,"annual_increase_every_months"?: number | null,"annual_increase_kind"?: Database["public"]['Enums']["increase_kind"] | null,"annual_increase_value"?: number | null,"auto_renew"?: boolean,"clause_overrides"?: NonNullable<Json>,"contract_date"?: string,"contract_no"?: string,"created_at"?: string,"created_by"?: string | null,"custom_clauses"?: NonNullable<Json>,"deposit_status"?: Database["public"]['Enums']["deposit_status"],"electricity_fixed_fils"?: number,"end_date"?: string,"expected_move_out"?: string | null,"first_collection_date"?: string,"free_months"?: number,"free_months_penalty_window_months"?: number,"id"?: string,"monthly_rent_fils"?: number,"move_out_date"?: string | null,"notes"?: string | null,"notice_date"?: string | null,"notice_period_months"?: number,"org_id"?: string,"owner_id"?: string | null,"property_id"?: string,"purpose"?: string,"rendered_clauses"?: Json | null,"renewal_term_months"?: number | null,"renewed_from_id"?: string | null,"security_deposit_fils"?: number,"signed_file_path"?: string | null,"start_date"?: string,"status"?: Database["public"]['Enums']["contract_status"],"template_id"?: string | null,"tenant_id"?: string,"term_months"?: number,"termination_reason"?: string | null,"type"?: Database["public"]['Enums']["contract_type"],"updated_at"?: string,"utilities_party"?: Database["public"]['Enums']["utilities_party"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "contracts_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "owners"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_renewed_from_id_fkey"
      columns: ["renewed_from_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_renewed_from_id_fkey"
      columns: ["renewed_from_id"]
isOneToOne: false
      referencedRelation: "v_contract_balances"
      referencedColumns: ["contract_id"]
    },{
      foreignKeyName: "contracts_renewed_from_id_fkey"
      columns: ["renewed_from_id"]
isOneToOne: false
      referencedRelation: "v_unit_status_today"
      referencedColumns: ["contract_id"]
    },{
      foreignKeyName: "contracts_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "contract_templates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"deposit_properties": {
                  Row: {
                    "amount_fils": number,"created_at": string,"created_by": string | null,"deposit_id": string,"id": string,"org_id": string,"property_id": string,"updated_at": string
                  }
                  Insert: {
                    "amount_fils": number,"created_at"?: string,"created_by"?: string | null,"deposit_id": string,"id"?: string,"org_id": string,"property_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_fils"?: number,"created_at"?: string,"created_by"?: string | null,"deposit_id"?: string,"id"?: string,"org_id"?: string,"property_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "deposit_properties_deposit_id_fkey"
      columns: ["deposit_id"]
isOneToOne: false
      referencedRelation: "deposits"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deposit_properties_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deposit_properties_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"deposits": {
                  Row: {
                    "amount_fils": number,"attachment_path": string | null,"bank_name": string | null,"created_at": string,"created_by": string | null,"deposit_date": string,"destination": Database["public"]['Enums']["deposit_destination"],"id": string,"notes": string | null,"org_id": string,"owner_id": string | null,"reference": string | null,"updated_at": string
                  }
                  Insert: {
                    "amount_fils": number,"attachment_path"?: string | null,"bank_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"deposit_date": string,"destination": Database["public"]['Enums']["deposit_destination"],"id"?: string,"notes"?: string | null,"org_id": string,"owner_id"?: string | null,"reference"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "amount_fils"?: number,"attachment_path"?: string | null,"bank_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"deposit_date"?: string,"destination"?: Database["public"]['Enums']["deposit_destination"],"id"?: string,"notes"?: string | null,"org_id"?: string,"owner_id"?: string | null,"reference"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "deposits_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deposits_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "owners"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_allocations": {
                  Row: {
                    "amount_fils": number,"created_at": string,"created_by": string | null,"expense_line_id": string,"id": string,"org_id": string,"property_id": string,"unit_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "amount_fils": number,"created_at"?: string,"created_by"?: string | null,"expense_line_id": string,"id"?: string,"org_id": string,"property_id": string,"unit_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "amount_fils"?: number,"created_at"?: string,"created_by"?: string | null,"expense_line_id"?: string,"id"?: string,"org_id"?: string,"property_id"?: string,"unit_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_allocations_expense_line_id_fkey"
      columns: ["expense_line_id"]
isOneToOne: false
      referencedRelation: "expense_lines"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_allocations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_allocations_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_allocations_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_allocations_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "v_unit_status_today"
      referencedColumns: ["unit_id"]
    }
                  ]
                },"expense_categories": {
                  Row: {
                    "active": boolean,"created_at": string,"created_by": string | null,"id": string,"name_ar": string,"name_en": string,"org_id": string,"type": Database["public"]['Enums']["expense_category_type"],"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name_ar": string,"name_en": string,"org_id": string,"type"?: Database["public"]['Enums']["expense_category_type"],"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name_ar"?: string,"name_en"?: string,"org_id"?: string,"type"?: Database["public"]['Enums']["expense_category_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_categories_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_lines": {
                  Row: {
                    "allocation_mode": Database["public"]['Enums']["allocation_mode"],"amount_fils": number,"beneficiary_id": string | null,"category_id": string,"created_at": string,"created_by": string | null,"description": string,"id": string,"org_id": string,"position": number,"updated_at": string,"voucher_id": string
                  }
                  Insert: {
                    "allocation_mode"?: Database["public"]['Enums']["allocation_mode"],"amount_fils": number,"beneficiary_id"?: string | null,"category_id": string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"org_id": string,"position"?: number,"updated_at"?: string,"voucher_id": string
                  }
                  Update: {
                    "allocation_mode"?: Database["public"]['Enums']["allocation_mode"],"amount_fils"?: number,"beneficiary_id"?: string | null,"category_id"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"org_id"?: string,"position"?: number,"updated_at"?: string,"voucher_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_lines_beneficiary_id_fkey"
      columns: ["beneficiary_id"]
isOneToOne: false
      referencedRelation: "beneficiaries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_lines_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "expense_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_lines_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expense_lines_voucher_id_fkey"
      columns: ["voucher_id"]
isOneToOne: false
      referencedRelation: "expense_vouchers"
      referencedColumns: ["id"]
    }
                  ]
                },"expense_vouchers": {
                  Row: {
                    "attachment_paths": (string)[],"created_at": string,"created_by": string | null,"id": string,"notes": string | null,"org_id": string,"paid_from": Database["public"]['Enums']["paid_from"],"recipient_name": string | null,"reference": string | null,"status": Database["public"]['Enums']["voucher_status"],"updated_at": string,"void_reason": string | null,"voucher_date": string,"voucher_no": string
                  }
                  Insert: {
                    "attachment_paths"?: (string)[],"created_at"?: string,"created_by"?: string | null,"id"?: string,"notes"?: string | null,"org_id": string,"paid_from"?: Database["public"]['Enums']["paid_from"],"recipient_name"?: string | null,"reference"?: string | null,"status"?: Database["public"]['Enums']["voucher_status"],"updated_at"?: string,"void_reason"?: string | null,"voucher_date": string,"voucher_no": string
                  }
                  Update: {
                    "attachment_paths"?: (string)[],"created_at"?: string,"created_by"?: string | null,"id"?: string,"notes"?: string | null,"org_id"?: string,"paid_from"?: Database["public"]['Enums']["paid_from"],"recipient_name"?: string | null,"reference"?: string | null,"status"?: Database["public"]['Enums']["voucher_status"],"updated_at"?: string,"void_reason"?: string | null,"voucher_date"?: string,"voucher_no"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_vouchers_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"legal_case_events": {
                  Row: {
                    "attachment_path": string | null,"case_id": string,"created_at": string,"created_by": string | null,"event_date": string,"id": string,"notes": string | null,"org_id": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "attachment_path"?: string | null,"case_id": string,"created_at"?: string,"created_by"?: string | null,"event_date": string,"id"?: string,"notes"?: string | null,"org_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "attachment_path"?: string | null,"case_id"?: string,"created_at"?: string,"created_by"?: string | null,"event_date"?: string,"id"?: string,"notes"?: string | null,"org_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "legal_case_events_case_id_fkey"
      columns: ["case_id"]
isOneToOne: false
      referencedRelation: "legal_cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "legal_case_events_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"legal_cases": {
                  Row: {
                    "amount_claimed_fils": number,"case_no": string | null,"contract_id": string | null,"court": string | null,"created_at": string,"created_by": string | null,"id": string,"lawyer": string | null,"next_hearing_date": string | null,"notes": string | null,"org_id": string,"status": Database["public"]['Enums']["legal_status"],"tenant_id": string,"type": Database["public"]['Enums']["legal_case_type"],"updated_at": string
                  }
                  Insert: {
                    "amount_claimed_fils"?: number,"case_no"?: string | null,"contract_id"?: string | null,"court"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"lawyer"?: string | null,"next_hearing_date"?: string | null,"notes"?: string | null,"org_id": string,"status"?: Database["public"]['Enums']["legal_status"],"tenant_id": string,"type"?: Database["public"]['Enums']["legal_case_type"],"updated_at"?: string
                  }
                  Update: {
                    "amount_claimed_fils"?: number,"case_no"?: string | null,"contract_id"?: string | null,"court"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"lawyer"?: string | null,"next_hearing_date"?: string | null,"notes"?: string | null,"org_id"?: string,"status"?: Database["public"]['Enums']["legal_status"],"tenant_id"?: string,"type"?: Database["public"]['Enums']["legal_case_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "legal_cases_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "legal_cases_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "v_contract_balances"
      referencedColumns: ["contract_id"]
    },{
      foreignKeyName: "legal_cases_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "v_unit_status_today"
      referencedColumns: ["contract_id"]
    },{
      foreignKeyName: "legal_cases_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "legal_cases_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"monthly_closings": {
                  Row: {
                    "cash_difference_note": string | null,"closed_at": string,"closed_by": string | null,"created_at": string,"created_by": string | null,"id": string,"notes": string | null,"org_id": string,"period": string,"updated_at": string
                  }
                  Insert: {
                    "cash_difference_note"?: string | null,"closed_at"?: string,"closed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"notes"?: string | null,"org_id": string,"period": string,"updated_at"?: string
                  }
                  Update: {
                    "cash_difference_note"?: string | null,"closed_at"?: string,"closed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"notes"?: string | null,"org_id"?: string,"period"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "monthly_closings_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_preferences": {
                  Row: {
                    "created_at": string,"created_by": string | null,"email": boolean,"id": string,"in_app": boolean,"org_id": string,"push": boolean,"type": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"email"?: boolean,"id"?: string,"in_app"?: boolean,"org_id": string,"push"?: boolean,"type": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"email"?: boolean,"id"?: string,"in_app"?: boolean,"org_id"?: string,"push"?: boolean,"type"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_preferences_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body_ar": string,"body_en": string,"created_at": string,"created_by": string | null,"dedupe_key": string | null,"dismissed_at": string | null,"entity_id": string | null,"entity_type": string | null,"id": string,"org_id": string,"pushed_at": string | null,"read_at": string | null,"title_ar": string,"title_en": string,"type": string,"updated_at": string,"url": string | null,"user_id": string
                  }
                  Insert: {
                    "body_ar": string,"body_en": string,"created_at"?: string,"created_by"?: string | null,"dedupe_key"?: string | null,"dismissed_at"?: string | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"org_id": string,"pushed_at"?: string | null,"read_at"?: string | null,"title_ar": string,"title_en": string,"type": string,"updated_at"?: string,"url"?: string | null,"user_id": string
                  }
                  Update: {
                    "body_ar"?: string,"body_en"?: string,"created_at"?: string,"created_by"?: string | null,"dedupe_key"?: string | null,"dismissed_at"?: string | null,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: string,"org_id"?: string,"pushed_at"?: string | null,"read_at"?: string | null,"title_ar"?: string,"title_en"?: string,"type"?: string,"updated_at"?: string,"url"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"number_sequences": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"key": string,"last_value": number,"org_id": string,"updated_at": string,"year": number
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"key": string,"last_value"?: number,"org_id": string,"updated_at"?: string,"year": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"key"?: string,"last_value"?: number,"org_id"?: string,"updated_at"?: string,"year"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "number_sequences_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"org_members": {
                  Row: {
                    "active": boolean,"created_at": string,"created_by": string | null,"display_name": string | null,"email": string | null,"id": string,"org_id": string,"phone": string | null,"role": Database["public"]['Enums']["member_role"],"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"display_name"?: string | null,"email"?: string | null,"id"?: string,"org_id": string,"phone"?: string | null,"role": Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"display_name"?: string | null,"email"?: string | null,"id"?: string,"org_id"?: string,"phone"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_members_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"orgs": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"logo_path": string | null,"name": string,"name_en": string | null,"settings": NonNullable<Json>,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"logo_path"?: string | null,"name": string,"name_en"?: string | null,"settings"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"logo_path"?: string | null,"name"?: string,"name_en"?: string | null,"settings"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"owners": {
                  Row: {
                    "address": string | null,"bank_name": string | null,"civil_id": string | null,"created_at": string,"created_by": string | null,"email": string | null,"full_name": string,"iban": string | null,"id": string,"notes": string | null,"org_id": string,"phones": (string)[],"portal_user_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "address"?: string | null,"bank_name"?: string | null,"civil_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"full_name": string,"iban"?: string | null,"id"?: string,"notes"?: string | null,"org_id": string,"phones"?: (string)[],"portal_user_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"bank_name"?: string | null,"civil_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"full_name"?: string,"iban"?: string | null,"id"?: string,"notes"?: string | null,"org_id"?: string,"phones"?: (string)[],"portal_user_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "owners_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_allocations": {
                  Row: {
                    "amount_fils": number,"charge_id": string,"created_at": string,"created_by": string | null,"id": string,"org_id": string,"payment_id": string,"updated_at": string
                  }
                  Insert: {
                    "amount_fils": number,"charge_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"org_id": string,"payment_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_fils"?: number,"charge_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"org_id"?: string,"payment_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_allocations_charge_id_fkey"
      columns: ["charge_id"]
isOneToOne: false
      referencedRelation: "charges"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_allocations_charge_id_fkey"
      columns: ["charge_id"]
isOneToOne: false
      referencedRelation: "v_charge_balances"
      referencedColumns: ["charge_id"]
    },{
      foreignKeyName: "payment_allocations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_allocations_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_fils": number,"attachment_path": string | null,"client_id": string | null,"collected_by": string | null,"contract_id": string,"created_at": string,"created_by": string | null,"id": string,"method": Database["public"]['Enums']["payment_method"],"notes": string | null,"org_id": string,"receipt_no": string | null,"received_at": string,"reference": string | null,"system_no": string | null,"tenant_id": string,"updated_at": string,"void_reason": string | null,"voided": boolean,"voided_at": string | null,"voided_by": string | null
                  }
                  Insert: {
                    "amount_fils": number,"attachment_path"?: string | null,"client_id"?: string | null,"collected_by"?: string | null,"contract_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"method"?: Database["public"]['Enums']["payment_method"],"notes"?: string | null,"org_id": string,"receipt_no"?: string | null,"received_at": string,"reference"?: string | null,"system_no"?: string | null,"tenant_id": string,"updated_at"?: string,"void_reason"?: string | null,"voided"?: boolean,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "amount_fils"?: number,"attachment_path"?: string | null,"client_id"?: string | null,"collected_by"?: string | null,"contract_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"method"?: Database["public"]['Enums']["payment_method"],"notes"?: string | null,"org_id"?: string,"receipt_no"?: string | null,"received_at"?: string,"reference"?: string | null,"system_no"?: string | null,"tenant_id"?: string,"updated_at"?: string,"void_reason"?: string | null,"voided"?: boolean,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "v_contract_balances"
      referencedColumns: ["contract_id"]
    },{
      foreignKeyName: "payments_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "v_unit_status_today"
      referencedColumns: ["contract_id"]
    },{
      foreignKeyName: "payments_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"properties": {
                  Row: {
                    "active": boolean,"area": string | null,"avenue": string | null,"block": string | null,"cover_image_path": string | null,"created_at": string,"created_by": string | null,"default_investment_template_id": string | null,"default_residential_template_id": string | null,"floors": number | null,"house_or_plot": string | null,"id": string,"name": string,"name_en": string | null,"notes": string | null,"org_id": string,"paci_no": string | null,"photos": NonNullable<Json>,"property_type": Database["public"]['Enums']["property_type"],"street": string | null,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"area"?: string | null,"avenue"?: string | null,"block"?: string | null,"cover_image_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"default_investment_template_id"?: string | null,"default_residential_template_id"?: string | null,"floors"?: number | null,"house_or_plot"?: string | null,"id"?: string,"name": string,"name_en"?: string | null,"notes"?: string | null,"org_id": string,"paci_no"?: string | null,"photos"?: NonNullable<Json>,"property_type"?: Database["public"]['Enums']["property_type"],"street"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"area"?: string | null,"avenue"?: string | null,"block"?: string | null,"cover_image_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"default_investment_template_id"?: string | null,"default_residential_template_id"?: string | null,"floors"?: number | null,"house_or_plot"?: string | null,"id"?: string,"name"?: string,"name_en"?: string | null,"notes"?: string | null,"org_id"?: string,"paci_no"?: string | null,"photos"?: NonNullable<Json>,"property_type"?: Database["public"]['Enums']["property_type"],"street"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "properties_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"property_commissions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"effective_from": string,"id": string,"kind": Database["public"]['Enums']["commission_kind"],"org_id": string,"property_id": string,"updated_at": string,"value": number
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"effective_from"?: string,"id"?: string,"kind": Database["public"]['Enums']["commission_kind"],"org_id": string,"property_id": string,"updated_at"?: string,"value": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"effective_from"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["commission_kind"],"org_id"?: string,"property_id"?: string,"updated_at"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "property_commissions_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "property_commissions_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"property_owners": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"org_id": string,"owner_id": string,"property_id": string,"share_pct": number,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"org_id": string,"owner_id": string,"property_id": string,"share_pct"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"org_id"?: string,"owner_id"?: string,"property_id"?: string,"share_pct"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "property_owners_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "property_owners_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "owners"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "property_owners_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"created_by": string | null,"endpoint": string,"failed_count": number,"id": string,"last_used_at": string | null,"locale": string,"org_id": string,"p256dh": string,"updated_at": string,"user_agent": string | null,"user_id": string
                  }
                  Insert: {
                    "auth": string,"created_at"?: string,"created_by"?: string | null,"endpoint": string,"failed_count"?: number,"id"?: string,"last_used_at"?: string | null,"locale"?: string,"org_id": string,"p256dh": string,"updated_at"?: string,"user_agent"?: string | null,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"created_by"?: string | null,"endpoint"?: string,"failed_count"?: number,"id"?: string,"last_used_at"?: string | null,"locale"?: string,"org_id"?: string,"p256dh"?: string,"updated_at"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"recurring_expenses": {
                  Row: {
                    "active": boolean,"allocation": NonNullable<Json>,"amount_fils": number,"beneficiary_id": string | null,"category_id": string,"created_at": string,"created_by": string | null,"day_of_month": number,"description": string,"id": string,"last_generated_period": string | null,"org_id": string,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"allocation"?: NonNullable<Json>,"amount_fils": number,"beneficiary_id"?: string | null,"category_id": string,"created_at"?: string,"created_by"?: string | null,"day_of_month"?: number,"description"?: string,"id"?: string,"last_generated_period"?: string | null,"org_id": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"allocation"?: NonNullable<Json>,"amount_fils"?: number,"beneficiary_id"?: string | null,"category_id"?: string,"created_at"?: string,"created_by"?: string | null,"day_of_month"?: number,"description"?: string,"id"?: string,"last_generated_period"?: string | null,"org_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recurring_expenses_beneficiary_id_fkey"
      columns: ["beneficiary_id"]
isOneToOne: false
      referencedRelation: "beneficiaries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recurring_expenses_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "expense_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recurring_expenses_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"reminders_log": {
                  Row: {
                    "channel": Database["public"]['Enums']["reminder_channel"],"contract_id": string | null,"created_at": string,"created_by": string | null,"id": string,"message": string,"org_id": string,"sent_at": string,"sent_by": string | null,"tenant_id": string,"updated_at": string
                  }
                  Insert: {
                    "channel"?: Database["public"]['Enums']["reminder_channel"],"contract_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"message": string,"org_id": string,"sent_at"?: string,"sent_by"?: string | null,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "channel"?: Database["public"]['Enums']["reminder_channel"],"contract_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"message"?: string,"org_id"?: string,"sent_at"?: string,"sent_by"?: string | null,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminders_log_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reminders_log_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "v_contract_balances"
      referencedColumns: ["contract_id"]
    },{
      foreignKeyName: "reminders_log_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "v_unit_status_today"
      referencedColumns: ["contract_id"]
    },{
      foreignKeyName: "reminders_log_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reminders_log_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"template_clauses": {
                  Row: {
                    "body": string,"condition": string | null,"created_at": string,"created_by": string | null,"default_condition": string | null,"default_enabled": boolean,"id": string,"key": string,"optional": boolean,"org_id": string | null,"position": number,"template_id": string,"updated_at": string
                  }
                  Insert: {
                    "body": string,"condition"?: string | null,"created_at"?: string,"created_by"?: string | null,"default_condition"?: string | null,"default_enabled"?: boolean,"id"?: string,"key": string,"optional"?: boolean,"org_id"?: string | null,"position": number,"template_id": string,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"condition"?: string | null,"created_at"?: string,"created_by"?: string | null,"default_condition"?: string | null,"default_enabled"?: boolean,"id"?: string,"key"?: string,"optional"?: boolean,"org_id"?: string | null,"position"?: number,"template_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "template_clauses_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "template_clauses_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "contract_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"tenants": {
                  Row: {
                    "blacklist_reason": string | null,"blacklisted": boolean,"civil_id": string | null,"created_at": string,"created_by": string | null,"email": string | null,"emergency_contact": string | null,"employer": string | null,"full_name": string,"id": string,"nationality": string | null,"notes": string | null,"org_id": string,"phones": (string)[],"updated_at": string
                  }
                  Insert: {
                    "blacklist_reason"?: string | null,"blacklisted"?: boolean,"civil_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"emergency_contact"?: string | null,"employer"?: string | null,"full_name": string,"id"?: string,"nationality"?: string | null,"notes"?: string | null,"org_id": string,"phones"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "blacklist_reason"?: string | null,"blacklisted"?: boolean,"civil_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"emergency_contact"?: string | null,"employer"?: string | null,"full_name"?: string,"id"?: string,"nationality"?: string | null,"notes"?: string | null,"org_id"?: string,"phones"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenants_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"units": {
                  Row: {
                    "active": boolean,"area_m2": number | null,"asking_rent_fils": number,"available_since": string,"bathrooms": number | null,"bedrooms": number | null,"created_at": string,"created_by": string | null,"elec_meter_no": string | null,"floor": number | null,"id": string,"label": string,"notes": string | null,"org_id": string,"paci_no": string | null,"photos": NonNullable<Json>,"property_id": string,"sort_order": number,"type": Database["public"]['Enums']["unit_type"],"under_maintenance": boolean,"updated_at": string,"water_meter_no": string | null
                  }
                  Insert: {
                    "active"?: boolean,"area_m2"?: number | null,"asking_rent_fils"?: number,"available_since"?: string,"bathrooms"?: number | null,"bedrooms"?: number | null,"created_at"?: string,"created_by"?: string | null,"elec_meter_no"?: string | null,"floor"?: number | null,"id"?: string,"label": string,"notes"?: string | null,"org_id": string,"paci_no"?: string | null,"photos"?: NonNullable<Json>,"property_id": string,"sort_order"?: number,"type"?: Database["public"]['Enums']["unit_type"],"under_maintenance"?: boolean,"updated_at"?: string,"water_meter_no"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"area_m2"?: number | null,"asking_rent_fils"?: number,"available_since"?: string,"bathrooms"?: number | null,"bedrooms"?: number | null,"created_at"?: string,"created_by"?: string | null,"elec_meter_no"?: string | null,"floor"?: number | null,"id"?: string,"label"?: string,"notes"?: string | null,"org_id"?: string,"paci_no"?: string | null,"photos"?: NonNullable<Json>,"property_id"?: string,"sort_order"?: number,"type"?: Database["public"]['Enums']["unit_type"],"under_maintenance"?: boolean,"updated_at"?: string,"water_meter_no"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "units_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "units_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"user_settings": {
                  Row: {
                    "accent": string,"created_at": string,"dashboard_layout": Json | null,"density": string,"digest_time": string,"digits": string,"install_prompt_dismissed_at": string | null,"locale": string,"muted_property_ids": (string)[],"onboarding_done": boolean,"org_id": string | null,"pinned_property_ids": (string)[],"quiet_end": string,"quiet_start": string,"sessions_count": number,"theme": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "accent"?: string,"created_at"?: string,"dashboard_layout"?: Json | null,"density"?: string,"digest_time"?: string,"digits"?: string,"install_prompt_dismissed_at"?: string | null,"locale"?: string,"muted_property_ids"?: (string)[],"onboarding_done"?: boolean,"org_id"?: string | null,"pinned_property_ids"?: (string)[],"quiet_end"?: string,"quiet_start"?: string,"sessions_count"?: number,"theme"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "accent"?: string,"created_at"?: string,"dashboard_layout"?: Json | null,"density"?: string,"digest_time"?: string,"digits"?: string,"install_prompt_dismissed_at"?: string | null,"locale"?: string,"muted_property_ids"?: (string)[],"onboarding_done"?: boolean,"org_id"?: string | null,"pinned_property_ids"?: (string)[],"quiet_end"?: string,"quiet_start"?: string,"sessions_count"?: number,"theme"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_settings_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "v_charge_balances": {
                  Row: {
                    "adjusted_fils": number | null,"allocated_fils": number | null,"amount_fils": number | null,"charge_id": string | null,"contract_id": string | null,"due_date": string | null,"kind": Database["public"]['Enums']["charge_kind"] | null,"org_id": string | null,"outstanding_fils": number | null,"period": string | null,"waived_value_fils": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "charges_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "contracts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "charges_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "v_contract_balances"
      referencedColumns: ["contract_id"]
    },{
      foreignKeyName: "charges_contract_id_fkey"
      columns: ["contract_id"]
isOneToOne: false
      referencedRelation: "v_unit_status_today"
      referencedColumns: ["contract_id"]
    },{
      foreignKeyName: "charges_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"v_contract_balances": {
                  Row: {
                    "arrears_fils": number | null,"contract_id": string | null,"credit_fils": number | null,"last_payment_date": string | null,"oldest_due_date": string | null,"org_id": string | null,"property_id": string | null,"status": Database["public"]['Enums']["contract_status"] | null,"tenant_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contracts_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"v_property_month_summary": {
                  Row: {
                    "allocated_fils": number | null,"expected_fils": number | null,"org_id": string | null,"outstanding_fils": number | null,"period": string | null,"property_id": string | null,"waived_fils": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "charges_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"v_unit_status_today": {
                  Row: {
                    "contract_id": string | null,"org_id": string | null,"property_id": string | null,"status": string | null,"unit_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "units_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "units_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "assert_period_open":
{ Args: { "p_date": string,"p_org": string }; Returns: undefined
                           },
"create_org":
{ Args: { "p_name": string,"p_name_en"?: string }; Returns: string
                           },
"current_org_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"has_role":
{ Args: { "p_org": string,"p_roles": (Database["public"]['Enums']["member_role"])[] }; Returns: boolean
                           },
"is_manager":
{ Args: { "p_org": string }; Returns: boolean
                           },
"is_member":
{ Args: { "p_org": string }; Returns: boolean
                           },
"is_period_closed":
{ Args: { "p_org": string,"p_period": string }; Returns: boolean
                           },
"is_staff":
{ Args: { "p_org": string }; Returns: boolean
                           },
"next_number":
{ Args: { "p_key": string,"p_org": string,"p_year"?: number }; Returns: number
                           },
"owner_can_see_contract":
{ Args: { "p_contract": string }; Returns: boolean
                           },
"owner_can_see_property":
{ Args: { "p_property": string }; Returns: boolean
                           },
"owner_property_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"void_payment":
{ Args: { "p_payment": string,"p_reason": string }; Returns: undefined
                           }
          }
          Enums: {
            "adjustment_kind": "discount"|"write_off"|"correction","allocation_mode": "single"|"split_even"|"split_by_units"|"split_by_rent"|"manual_percent"|"manual_amount","beneficiary_kind": "staff"|"vendor"|"asset"|"other","charge_kind": "rent"|"free"|"electricity_fixed"|"penalty"|"maintenance_recharge"|"other","commission_kind": "percent"|"fixed","contract_status": "draft"|"active"|"notice_given"|"ended"|"terminated"|"renewed","contract_type": "residential"|"investment","deposit_destination": "owner_bank"|"office_bank"|"cash_to_owner","deposit_status": "none"|"held"|"refunded"|"forfeited_partially"|"forfeited","expense_category_type": "operating"|"capital"|"payroll"|"owner_draw","increase_kind": "percent"|"fixed","legal_case_type": "eviction"|"rent_claim"|"other","legal_status": "none"|"filed"|"in_progress"|"judgment"|"enforcement"|"closed","member_role": "admin"|"accountant"|"collector"|"viewer"|"owner","paid_from": "cash_box"|"bank"|"cheque","payment_method": "cash"|"knet"|"bank_transfer"|"cheque"|"link","property_type": "residential"|"investment"|"mixed"|"industrial","reminder_channel": "whatsapp"|"copy"|"sms"|"call","unit_type": "apartment"|"shop"|"room"|"basement"|"basement_front_half"|"basement_back_half"|"roof"|"office"|"warehouse"|"plot"|"other","utilities_party": "owner"|"tenant","voucher_status": "draft"|"posted"|"void"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "adjustment_kind": ["discount", "write_off", "correction"],"allocation_mode": ["single", "split_even", "split_by_units", "split_by_rent", "manual_percent", "manual_amount"],"beneficiary_kind": ["staff", "vendor", "asset", "other"],"charge_kind": ["rent", "free", "electricity_fixed", "penalty", "maintenance_recharge", "other"],"commission_kind": ["percent", "fixed"],"contract_status": ["draft", "active", "notice_given", "ended", "terminated", "renewed"],"contract_type": ["residential", "investment"],"deposit_destination": ["owner_bank", "office_bank", "cash_to_owner"],"deposit_status": ["none", "held", "refunded", "forfeited_partially", "forfeited"],"expense_category_type": ["operating", "capital", "payroll", "owner_draw"],"increase_kind": ["percent", "fixed"],"legal_case_type": ["eviction", "rent_claim", "other"],"legal_status": ["none", "filed", "in_progress", "judgment", "enforcement", "closed"],"member_role": ["admin", "accountant", "collector", "viewer", "owner"],"paid_from": ["cash_box", "bank", "cheque"],"payment_method": ["cash", "knet", "bank_transfer", "cheque", "link"],"property_type": ["residential", "investment", "mixed", "industrial"],"reminder_channel": ["whatsapp", "copy", "sms", "call"],"unit_type": ["apartment", "shop", "room", "basement", "basement_front_half", "basement_back_half", "roof", "office", "warehouse", "plot", "other"],"utilities_party": ["owner", "tenant"],"voucher_status": ["draft", "posted", "void"]
          }
        }
} as const

