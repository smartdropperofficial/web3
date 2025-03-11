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
export enum OrderStatus {
  BASKET = "BASKET",
  CREATED = "CREATED",
  AWAITING_TAX = "AWAITING_TAX",
  AWAITING_PAYMENT = "AWAITING_PAYMENT",
  CONFIRMATION_PENDING = "CONFIRMATION_PENDING",
  ORDER_CONFIRMED = "ORDER_CONFIRMED",
  SENT_TO_AMAZON = "SENT_TO_AMAZON",
  RETURNED_TO_AMAZON = "RETURNED_TO_AMAZON",
  RETURNED = "RETURNED",
  CANCELED = "CANCELED",
  COMPLETED = "COMPLETED",
  SHIPPING_ADDRESS_REFUSED = "SHIPPING_ADDRESS_REFUSED",
  PRODUCT_UNAVAILABLE = "PRODUCT_UNAVAILABLE",
  ERROR = "ERROR",
  INSUFFICIENT_ZMA_BALANCE = "INSUFFICIENT_ZMA_BALANCE",
}
export enum SubscriptionStatus {
  ENABLED = "ENABLED",
  DISABLED = "DISABLED",
  CONFIRMING = "CONFIRMING",
}
