import React from 'react';
import {
  CreditCard, ShieldCheck, RefreshCw, Printer
} from 'lucide-react';
import {
  Button, Card, LoadingState, EmptyState
} from '../ui';

export const PatientBillingSection = ({
  paymentHistory,
  paymentHistoryLoading,
  paymentFilter,
  setPaymentFilter,
  fetchPaymentHistory,
  setReceiptModalTxn,
  setSubView,
  onTabChange
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => { setSubView('overview'); if (onTabChange) onTabChange('dashboard'); }}
            className="text-xs font-semibold text-[#059669] hover:underline flex items-center gap-1.5 mb-2"
          >
            <span>←</span>
            <span>Back to My Health Overview</span>
          </button>
          <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#168CF5]" />
            Billing &amp; Payment Ledger
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#E7F0FC] text-[#059669] border border-[#059669]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
            TLS Verified
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPaymentHistory(paymentFilter)}
            loading={paymentHistoryLoading}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Segmented Slider Filter Bar */}
      <div className="bg-[#E7F0FC] p-1 rounded-xl inline-flex items-center gap-1 border border-[#BDDDFA] overflow-x-auto max-w-full">
        {['all', 'completed', 'pending', 'failed', 'cancelled'].map(f => {
          const isActive = paymentFilter === f;
          return (
            <button
              key={f}
              onClick={() => {
                setPaymentFilter(f);
                fetchPaymentHistory(f);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${isActive
                ? 'bg-[#0F172A] text-white shadow-sm'
                : 'text-[#55647C] hover:text-[#0F172A]'
                }`}
            >
              {f === 'all' ? 'All Transactions' : f}
            </button>
          );
        })}
      </div>

      {/* Transaction Cards List */}
      {paymentHistoryLoading ? (
        <LoadingState message="Loading verified transactions..." />
      ) : paymentHistory.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No Payment Records Found"
          description={paymentFilter === 'all' ? "You haven't initiated any payment transactions yet." : `No transactions matching '${paymentFilter}' status.`}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paymentHistory.map(txn => {
            const isOrder = !!txn.order || !!txn.order_details;
            const rawOrderStatus = (txn.order_details?.order_status || txn.order_details?.status || '').toLowerCase();

            const isOrderCompleted = ['confirmed', 'delivered', 'packing', 'shipping', 'out_for_delivery'].includes(rawOrderStatus);
            const isCompleted = txn.status === 'completed' || isOrderCompleted;
            const isCancelled = txn.status === 'cancelled' || rawOrderStatus === 'cancelled';
            const isFailed = txn.status === 'failed';
            const isPending = !isCompleted && !isCancelled && !isFailed;

            let statusLabel = txn.status;
            if (isOrder && rawOrderStatus) {
              if (rawOrderStatus === 'delivered') statusLabel = 'Delivered';
              else if (rawOrderStatus === 'shipping') statusLabel = 'In Transit';
              else if (rawOrderStatus === 'out_for_delivery') statusLabel = 'Out for Delivery';
              else if (rawOrderStatus === 'confirmed') statusLabel = 'Confirmed';
              else if (rawOrderStatus === 'packing') statusLabel = 'Packing';
              else statusLabel = rawOrderStatus;
            } else if (isCompleted) {
              statusLabel = 'Completed';
            }

            const badgeClass = isCompleted
              ? 'bg-[#E7F0FC] text-[#059669] border border-[#059669]'
              : isPending
                ? 'bg-amber-50 text-amber-700 border border-amber-300'
                : isCancelled
                  ? 'bg-slate-100 text-slate-700 border border-slate-300'
                  : 'bg-red-50 text-[#FF7A7A] border border-[#FF7A7A]/30';

            return (
              <Card key={txn.id} className="p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#E7F0FC] text-[#0F172A]">
                      {txn.appointment ? 'Doctor Consultation' : txn.order ? 'Pharmacy Order' : 'Health Service'}
                    </span>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${badgeClass}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between mb-3">
                    <span className="text-xl font-bold text-[#0F172A]">
                      ৳{parseFloat(txn.amount).toFixed(2)} <span className="text-xs font-semibold text-[#55647C]">BDT</span>
                    </span>
                    <span className="text-xs font-mono text-[#55647C]">
                      {txn.payment_method?.toUpperCase()}
                    </span>
                  </div>

                  {/* Service Details */}
                  {txn.appointment_details && (
                    <div className="text-xs text-[#334155] space-y-1 mb-3 bg-[#E7F0FC] p-2.5 rounded-xl border border-[#BDDDFA]">
                      <p className="font-semibold text-[#0F172A]">{txn.appointment_details.doctor_name}</p>
                      <p className="text-[10px] text-[#55647C]">{txn.appointment_details.specialty} • {txn.appointment_details.date} {txn.appointment_details.time}</p>
                    </div>
                  )}

                  {txn.order_details && (
                    <div className="text-xs text-[#334155] space-y-1.5 mb-3 bg-[#E7F0FC] p-2.5 rounded-xl border border-[#BDDDFA]">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-[#0F172A]">Order #{txn.order_details.id} ({txn.order_details.items_count} items)</p>
                        {txn.order_details.order_status && (
                          <span className="text-[10px] font-bold text-[#059669] uppercase bg-white px-2 py-0.5 rounded border border-[#BDDDFA]">
                            Transit: {txn.order_details.order_status.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#55647C] truncate">Delivery: {txn.order_details.delivery_address}</p>
                    </div>
                  )}

                  <div className="text-[10px] text-[#55647C] font-mono space-y-0.5 border-t border-[#BDDDFA] pt-2 mb-3">
                    <p className="truncate">Ref: {txn.transaction_ref}</p>
                    {txn.val_id && <p className="truncate">SSL Val: {txn.val_id}</p>}
                    <p>Date: {new Date(txn.created_at).toLocaleString()}</p>
                  </div>

                  {txn.failure_reason && (
                    <p className="text-[10px] text-[#FF7A7A] mb-3 bg-red-50 p-2 rounded-lg border border-[#FF7A7A]/30">
                      Notice: {txn.failure_reason}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#BDDDFA]">
                  {isCompleted && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReceiptModalTxn(txn)}
                      className="text-xs"
                    >
                      <Printer className="w-3.5 h-3.5 mr-1" />
                      View Receipt
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

