import { OrderStatus } from "../enums/enums";

export interface OrdersSB {
  // id?: number;
  created_at?: string; // timestamp with time zone
  wallet_address?: string;
  country?: string;
  status?: OrderStatus;
  order_id?: string;
  shipping_info?: ShippingInfoSB; // puoi usare un tipo più specifico se conosci la struttura JSON
  request_id?: string;
  tax_request_id?: string;
  tax_amount?: number;
  total_amount?: number;
  subtotal_amount?: number;
  amount_paid?: number;
  shipping_amount?: number;
  products?: ProductSB[]; // array di JSON, specifica il tipo se hai una struttura nota
  tracking?: string;
  retailer?: "AMAZON" | "EBAY" | "WALMART" | string; // enum "Retailer"
  total_items?: number;
  zone?: string;
  currency?: string;
  custom_error?: string;
  commission?: number;
  email?: string;
  ticket_id?: string;
  read?: boolean;
  modified_at?: string; // timestamp senza time zone
  order_creation_tx?: string;
  pre_order_amount?: number;
  pre_order_payment_tx?: string;
  tax_order_amount?: number;
  tax_order_payment_tx?: string;
}
export interface OrderSB {
  created_at?: Date; // timestamp with time zone
  wallet_address?: string; // text
  order_id?: string; // text
  pre_order_payment_tx?: string; // text
  amount_paid?: number; // double precision
  shipping_info?: ShippingInfoSB; // JSONB
  tax_request_id?: string;
  shipping_amount?: number;
  total_orders?: number; // bigint
  zone?: string; // text
  currency?: string; // text
  email?: string; // text
  read?: boolean; // boolean
  pre_order_amount?: number; // double precision
  modified_at?: Date; // timestamp with time zone
  basket_ids?: string[]; // bigint[]
  status?: OrderStatus; // enum "OrderStatus"
}
export interface TicketSB {
  id: string;
  subject: string;
  status: string;
  created_at: string;
}

export interface RefundSB {
  asin: string;
  transaction: string;
}
export interface MessageSB {
  id?: string; // UUID per identificare univocamente ogni messaggio
  sender: string; // Indirizzo del wallet del mittente
  ticket_id: string; // ID del ticket associato al messaggio
  customer_email?: string | null | undefined;
  content: string; // Contenuto del messaggio
  msg_timestamp: string; // Timestamp del messaggio
  read: boolean; // Indica se il messaggio è stato letto
  status: string; // Stato del messaggio (es: "sent", "received", etc.),
  order_id: string;
}

export interface ShippingInfoSB {
  first_name: string;
  last_name: string;
  address_line1: string;
  address_line2: string;
  zip_code: string;
  city: string;
  state: string;
  phone_number: string;
  email: string;
}

export interface ProductSB {
  asin: string;
  image: string;
  price: number;
  symbol: string;
  title: string;
  url: string;
  quantity: number;
}
