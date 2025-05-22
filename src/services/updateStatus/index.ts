import { Contract, formatUnits, isAddress, parseUnits } from "ethers";

import { supabase } from "../../config/supabase";
import { initializeTaxWallet } from "../../utils/web3";
import subscriptionManagementABI from "../../abi/subscriptionManagementABI.json";
import {
  CreateSubcriptionOnChainParams,
  OrderSB,
  OrdersSB,
  OrderStatus,
} from "../../types/types";

export const createSubscriptionOnBlockchain = async ({
  subscription_id,
  subscription_plan_id,
  wallet,
  payment_tx,
  promoter,
  created_at,
}: CreateSubcriptionOnChainParams): Promise<any> => {
  try {
    const { data: config, error: existingError } = await supabase
      .from("config")
      .select("subscription_management_contract")
      .maybeSingle();

    if (existingError) {
      console.error(
        "createOrderOnBlockchain - Error checking existing subscription on Supabase:",
        existingError
      );
      return "";
    }

    const getCurrentTimestamp = (): number => {
      return Math.floor(new Date(created_at!).getTime() / 1000); // Convert to seconds
    };

    // Step 3: Creazione della sottoscrizione sulla blockchain
    const ownerWallet = initializeTaxWallet();
    const ownerContract = new Contract(
      config?.subscription_management_contract!,
      subscriptionManagementABI,
      ownerWallet
    );

    // // Verifica che tutti gli argomenti siano definiti
    if (!subscription_id) {
      throw new Error("createOrderOnBlockchain- Invalid subscription ID");
    }
    if (subscription_plan_id < 0) {
      throw new Error("createOrderOnBlockchain - Invalid subscription type ID");
    }
    if (!isAddress(wallet)) {
      throw new Error("createOrderOnBlockchain - Invalid subscriber address");
    }
    if (!payment_tx) {
      throw new Error("createOrderOnBlockchain - Invalid payment transaction");
    }

    // Chiamata alla nuova funzione per stimare e creare la transazione
    console.log(
      "🚀 createOrderOnBlockchain -  ~ supabaseSubscription.subscription_id,:",
      subscription_id
    );

    const startDate = getCurrentTimestamp();

    const txHash = await estimateAndCreateSubscriptionTransaction(
      ownerContract,
      subscription_id,
      subscription_plan_id,
      wallet,
      payment_tx,
      promoter,
      startDate
    );
    const { data: sub, error: errorSub } = await supabase
      .from("subscription")
      .update({ subscription_tx: txHash })
      .eq("subscription_id", subscription_id);

    if (errorSub) {
      console.error(
        "createOrderOnBlockchain - Error updating subscription transaction on Supabase:",
        errorSub
      );
      return "";
    }
    return { tx: txHash };
  } catch (error: any) {
    console.error(
      "createOrderOnBlockchain -  Error in createSubscription:",
      error
    );
    throw { message: error.reason };
  }
};
export async function estimateAndCreateSubscriptionTransaction(
  ownerContract: Contract,
  subscriptionId: string,
  subscriptionTypeId: number,
  subscriber: string,
  paymentTx: string,
  promoterAddress = "0x0000000000000000000000000000000000000000",
  startDate: number
): Promise<string> {
  console.log("🚀 estimateAndCreateSubscriptionTransaction START");
  console.log("🔹 startDate:", startDate);
  console.log("🔹 paymentTx:", paymentTx);
  console.log("🔹 subscriber:", subscriber);
  console.log("🔹 subscriptionId:", subscriptionId);
  console.log("🔹 promoterAddress:", promoterAddress);

  // ✅ Verifica se promoterAddress è un indirizzo valido
  if (!isAddress(promoterAddress)) {
    console.warn("⚠️ promoterAddress non valido, impostato su default.");
    promoterAddress = "0x0000000000000000000000000000000000000000";
  }

  try {
    // ✅ Ottenere il provider dal contract runner
    const provider = ownerContract.runner?.provider;
    if (!provider) {
      throw new Error("No provider found on the contract signer.");
    }

    // ✅ Ottenere il gas price direttamente dal provider (Ethers v6 usa getFeeData)
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? parseUnits("30", "gwei"); // Default 30 Gwei se nullo
    console.log("🚀 ~ gasPrice:", formatUnits(gasPrice, "gwei"), "Gwei");

    // ✅ Stima del gas limit
    let gasLimitEstimate;
    try {
      gasLimitEstimate = await ownerContract.subscribe.estimateGas(
        subscriptionId,
        subscriptionTypeId,
        subscriber,
        paymentTx,
        promoterAddress,
        startDate
      );
      console.log("✅ ~ gasLimit stimato:", gasLimitEstimate.toString());
    } catch (error) {
      console.error("❌ Errore nella stima del gas:", error);
      throw new Error("Gas estimation failed. Check parameters.");
    }

    // ✅ Applichiamo un buffer di sicurezza del 10% e un minimo garantito
    const bufferMultiplier = 11n; // 10% extra gas buffer
    const divisor = 10n;

    const finalGasLimit = (gasLimitEstimate * bufferMultiplier) / divisor;
    console.log("✅ ~ finalGasLimit:", finalGasLimit.toString());

    // ✅ Creazione e invio della transazione sulla blockchain
    let tx;
    try {
      tx = await ownerContract.subscribe(
        subscriptionId,
        subscriptionTypeId,
        subscriber,
        paymentTx,
        promoterAddress,
        startDate,
        {
          gasPrice,
          gasLimit: finalGasLimit,
        }
      );
      console.log("🚀 Subscription created on chain! Hash:", tx.hash);
    } catch (error: any) {
      console.error("❌ Errore nell'invio della transazione:", error);

      // Migliore gestione dell'errore per transazioni fallite
      if (error?.message?.includes("insufficient funds")) {
        throw new Error("Transaction failed: Insufficient funds for gas.");
      } else if (
        error?.message?.includes("replacement transaction underpriced")
      ) {
        throw new Error("Transaction failed: Gas price too low.");
      } else {
        throw new Error(
          "Transaction failed. Possible gas issue or nonce error."
        );
      }
    }

    return tx.hash;
  } catch (error) {
    console.error(
      "❌ Errore generale in estimateAndCreateSubscriptionTransaction:",
      error
    );
    throw error;
  }
}
export const createMultiPreorders = async (
  order_id: string,
  basket_ids: string[]
): Promise<OrdersSB[]> => {
  console.log("🔍 [CREATE PREORDERS] Start");
  console.log("🔹 order_id:", order_id);
  console.log(
    "🔹 basket_ids:",
    Array.isArray(basket_ids) ? basket_ids : "❌ Not an array"
  );

  try {
    console.log("🔍 [STEP 1] Fetching order details from 'order' table...");
    const { data: order, error: orderError } = await supabase
      .from("order")
      .select("*")
      .eq("order_id", order_id)
      .single();

    if (orderError || !order) {
      console.error("❌ [ERROR] Failed to fetch order:", orderError?.message);
      throw new Error(
        `Errore nel recupero dell'ordine: ${orderError?.message}`
      );
    }

    console.log("✅ [STEP 1] Order fetched successfully. Fields:");
    console.log(Object.keys(order));
    console.log("📦 Order JSON:", JSON.stringify(order, null, 2));

    const typedOrder: OrderSB = order as OrderSB;

    console.log(
      "🔍 [STEP 2] Fetching basket details from 'basket_multi' table..."
    );
    const { data: baskets, error: basketError } = await supabase
      .from("basket_multi")
      .select("*")
      .in("basket_id", basket_ids);

    if (basketError) {
      console.error("❌ [ERROR] Failed to fetch baskets:", basketError.message);
      throw new Error(`Errore nel recupero dei basket: ${basketError.message}`);
    }

    if (!baskets || baskets.length === 0) {
      console.warn("⚠️ [WARNING] No baskets found for the provided IDs.");
      return [];
    }

    console.log(`✅ [STEP 2] Fetched ${baskets.length} baskets.`);
    console.table(
      baskets.map((b) => ({
        basket_id: b.basket_id,
        total_items: b.total_items,
        email: b.email,
      }))
    );

    console.log("🔍 [STEP 3] Mapping baskets to orders...");
    const ordersList: OrdersSB[] = baskets.map((basket: any) => {
      // 🔄 Unifica prodotti per ASIN sommando le quantità
      const mergedProductsMap = new Map<string, any>();

      basket.products?.forEach((product: any) => {
        const asin = product.asin;
        if (!asin) return;

        if (mergedProductsMap.has(asin)) {
          const existing = mergedProductsMap.get(asin);
          existing.quantity += product.quantity;
        } else {
          mergedProductsMap.set(asin, {
            asin: product.asin,
            image: product.image,
            symbol: product.symbol,
            title: product.title,
            url: product.url,
            price: Number(product.price),
            quantity: product.quantity,
          });
        }
      });

      const mergedProducts = Array.from(mergedProductsMap.values());

      return {
        wallet_address: typedOrder.wallet_address,
        zone: typedOrder.zone || "US",
        email: typedOrder.email,
        currency: typedOrder.currency || "USD",
        retailer: typedOrder.retailer,
        shipping_info: basket.shipping_info
          ? {
              first_name: basket.shipping_info.first_name,
              last_name: basket.shipping_info.last_name,
              address_line1: basket.shipping_info.address_line1,
              address_line2: basket.shipping_info.address_line2,
              zip_code: basket.shipping_info.zip_code,
              city: basket.shipping_info.city,
              state: basket.shipping_info.state,
              phone_number: basket.shipping_info.phone_number,
              email: basket.shipping_info.email,
            }
          : undefined,
        products: mergedProducts,
        wrapper_id: typedOrder.order_id,

        status: OrderStatus.PREORDER_PLACED,
      };
    });

    console.log("✅ [STEP 3] Orders mapped. Preview of first order:");
    console.log(JSON.stringify(ordersList, null, 2));

    console.log("🔍 [STEP 4] Inserting orders into 'orders' table...");
    const { error: insertError } = await supabase
      .from("orders")
      .insert(ordersList);

    if (insertError) {
      console.error(
        "❌ [ERROR] Failed to insert orders into 'orders' table:",
        insertError.message
      );
      throw new Error(
        `Errore durante l'inserimento degli ordini: ${insertError.message}`
      );
    }

    console.log("✅ [STEP 4] Orders inserted successfully.");
    console.table(
      ordersList.map((o) => ({
        wrapper_id: order_id,
        email: o.email,
      }))
    );

    console.log("🎉 [CREATE PREORDERS] Completed successfully.");
    return ordersList;
  } catch (error) {
    console.error("❌ [FATAL ERROR] createPreorders failed:", error);
    throw error;
  }
};
export const createSinglePreorder = async (basket_id: string) => {
  const basket = await getBasketPrice(basket_id);
  const order = generatePreOrderObject(basket);
  // Check if basket was found
  if (!basket) {
    console.error("createSinglePreorder: basket not found or price is 0");
    throw new Error("Basket not found or invalid basket_id");
  }

  // Check if order object is valid
  if (!order) {
    console.error("createSinglePreorder: generated order is invalid");
    throw new Error("Invalid order generated from basket");
  }

  // Insert the order into the database
  const { data, error } = await supabase
    .from("orders")
    .insert(order)
    .select("*");

  if (error) {
    console.error("createSinglePreorder: error inserting order:", error);
    throw new Error("Failed to insert preorder");
  }
};
export async function getBasketPrice(basket_id: string): Promise<any> {
  console.log("🔍 Recupero basket_price by basket_id:", basket_id);
  const { data, error } = await supabase
    .from("basket_single")
    .select("*")
    .eq("basket_id", basket_id);

  if (error) {
    console.error("❌Cannot retreive basket:", error);
    return 0;
  }

  console.log("📊 Basket trovato:", data);
  return data?.[0] ?? null;
}
export const generatePreOrderObject = (basket?: any): OrdersSB | null => {
  if (!basket) {
    console.error("generatePreOrderObject: basket is undefined or null");
    return null;
  }
  console.log("🚀 ~ basket:", basket);

  // Check required fields
  if (!basket?.wallet) {
    console.error("generatePreOrderObject: basket.wallet is missing");
    return null;
  }
  if (!basket?.email) {
    console.error("generatePreOrderObject: basket.email is missing");
    return null;
  }
  if (!basket?.retailer) {
    console.error("generatePreOrderObject: basket.retailer is missing");
    return null;
  }
  if (!basket?.pre_order_payment_tx) {
    console.error(
      "generatePreOrderObject: basket.pre_order_payment_tx is missing"
    );
    return null;
  }
  if (!basket?.basket_price) {
    console.error("generatePreOrderObject: basket.basket_price is missing");
    return null;
  }
  if (
    !basket?.products ||
    !Array.isArray(basket?.products) ||
    basket?.products.length === 0
  ) {
    console.error("generatePreOrderObject: basket.items is missing or empty");
    return null;
  }
  if (!basket?.shipping_info) {
    console.error("generatePreOrderObject: basket.shipping_info is missing");
    return null;
  }
  const shipping = basket?.shipping_info;
  const requiredShippingFields = [
    "first_name",
    "last_name",
    "address_line1",
    "zip_code",
    "city",
    "state",
    "phone_number",
    "email",
  ];
  for (const field of requiredShippingFields) {
    if (!shipping[field]) {
      console.error(
        `generatePreOrderObject: shipping_info.${field} is missing`
      );
      return null;
    }
  }

  try {
    return {
      wallet_address: basket.wallet,
      zone: "US",
      email: basket.email,
      currency: "USD",
      retailer: basket.retailer,
      pre_order_payment_tx: basket.pre_order_payment_tx,
      shipping_info: {
        first_name: shipping.first_name,
        last_name: shipping.last_name,
        address_line1: shipping.address_line1,
        address_line2: shipping.address_line2,
        zip_code: shipping.zip_code,
        city: shipping.city,
        state: shipping.state,
        phone_number: shipping.phone_number,
        email: shipping.email,
      },
      status: OrderStatus.AWAITING_TAX,
      pre_order_amount: basket.basket_price,
      products: basket.products
        .map((product: any) => {
          if (
            !product.asin ||
            !product.image ||
            !product.symbol ||
            !product.title ||
            !product.url ||
            typeof product.price === "undefined" ||
            typeof product.quantity === "undefined"
          ) {
            console.error(
              "generatePreOrderObject: product fields are missing",
              product
            );
            return null;
          }
          return {
            asin: product.asin,
            image: product.image,
            symbol: product.symbol,
            title: product.title,
            url: product.url,
            price: Number(product.price),
            quantity: product.quantity,
          };
        })
        .filter(Boolean),
    };
  } catch (error) {
    console.log("🚀 ~ generatePreOrderObject ~ error:", error);
    return null;
  }
};
