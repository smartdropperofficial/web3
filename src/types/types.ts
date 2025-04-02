export interface Transaction {
  tx_hash: string;
  from_address: string;
  to_address: string;
  amount: string;
  token_address: string;
  timestamp?: string;
}
export interface Transaction {
  tx_hash: string;
  from_address: string;
  to_address: string;
  amount: string;
  token_address: string;
  timestamp?: string;
}

export interface SubscriptionSB {
  id?: number; // bigint
  created_at?: string; // timestamp with time zone
  wallet?: string; // text
  promoter_address?: string; // text
  subscription_plan_id: number; // bigint
  payment_tx?: string; // text
  promoter_withdrawn?: boolean; // boolean
  subscription_tx?: string; // text
  promoter_withdrawn_tx?: string; // text
  budget_left?: number; // numeric(15,2)
  subscription_id?: string; // text
  start?: string; // timestamp with time zone
  end?: string; // timestamp with time zone
  amount_paid?: number; // double precision
  email?: string; // text
  status: SubscriptionStatus;
}
export enum SubscriptionStatus {
  ENABLED = "ENABLED",
  DISABLED = "DISABLED",
  CONFIRMING = "CONFIRMING",
}
export interface CreateSubcriptionOnChainParams {
  payment_tx: string;
  subscription_plan_id: number;
  wallet: string;
  promoter: string;
  subscription_id: string;
  status: SubscriptionStatus;
  created_at: string;
}
