export * from "./generated/api";

import {
  CreateProductBody,
  CreateProductCategoryBody,
  CreateStockLocationBody,
  AdjustStockBody,
  TransferStockBody,
  CreateSupplierBody,
  CreateSupplierOrderBody,
  CreateTradeAccountBody,
  CreateCashDrawerBody,
  ReceiveSupplierOrderBody,
  OpenTillSessionBody,
  CloseTillSessionBody,
  CreatePosTransactionBody,
  RefundPosTransactionBody,
  SendPosTransactionReceiptBody,
} from "./generated/api";

export const ProductInput = CreateProductBody;
export const ProductCategoryInput = CreateProductCategoryBody;
export const StockLocationInput = CreateStockLocationBody;
export const StockAdjustmentInput = AdjustStockBody;
export const StockTransferInput = TransferStockBody;
export const SupplierInput = CreateSupplierBody;
export const SupplierOrderInput = CreateSupplierOrderBody;
export const SupplierDeliveryInput = ReceiveSupplierOrderBody;
export const TradeAccountInput = CreateTradeAccountBody;
export const CashDrawerInput = CreateCashDrawerBody;
export const OpenTillSessionInput = OpenTillSessionBody;
export const CloseTillSessionInput = CloseTillSessionBody;
export const PosTransactionInput = CreatePosTransactionBody;
export const PosRefundInput = RefundPosTransactionBody;
export const PosReceiptRequest = SendPosTransactionReceiptBody;
export * from './generated/types';
