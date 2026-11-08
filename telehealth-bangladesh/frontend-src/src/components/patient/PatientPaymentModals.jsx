import React from 'react';
import {
  Lock, Check, CheckCircle2, AlertCircle, AlertTriangle, Printer
} from 'lucide-react';
import { Modal, Button, LoadingState } from '../ui';

export const PatientPaymentModals = ({
  checkoutModal,
  setCheckoutModal,
  paymentLoading,
  paymentMethod,
  setPaymentMethod,
  handleProcessPayment,
  paymentStatusModal,
  setPaymentStatusModal,
  receiptModalTxn,
  setReceiptModalTxn,
  user
}) => {
  return (
    <>
      {/* ─── 1. HOSTED CHECKOUT MODAL ─── */}
      <Modal
        isOpen={!!checkoutModal}
        onClose={() => !paymentLoading && setCheckoutModal(null)}
        title="Secure Checkout"
        subtitle={checkoutModal?.subtitle || "Encrypted payment portal"}
      >
        <div className="space-y-4">
          {/* Order / Appointment Summary */}
          <div className="bg-[#E7F0FC] p-4 rounded-xl border border-[#BDDDFA] space-y-2">
            <h4 className="text-sm font-bold text-[#0F172A]">
              {checkoutModal?.title}
            </h4>
            {checkoutModal?.details && (
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#BDDDFA]">
                {checkoutModal.details.map((d, i) => (
                  <div key={i}>
                    <span className="text-[#55647C] block text-[10px] uppercase font-bold">{d.label}</span>
                    <span className="font-semibold text-[#0F172A] truncate block">{d.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Amount Due Display */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-[#BDDDFA]">
            <div>
              <span className="text-[10px] font-bold text-[#55647C] uppercase tracking-wider block">
                Total Payable Amount
              </span>
              <span className="text-2xl font-bold text-[#059669]">
                ৳{checkoutModal?.amount ? checkoutModal.amount.toFixed(2) : "0.00"} <span className="text-xs font-semibold text-[#55647C]">BDT</span>
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#E7F0FC] text-[#059669] border border-[#059669]">
              BDT Currency
            </span>
          </div>

          {/* Gateway Channel Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-2">
              Payment Gateway &amp; Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'sslcommerz', name: 'SSLCommerz (All)', desc: 'Cards, MFS, NetBanking' },
                { id: 'bkash', name: 'bKash MFS', desc: 'Direct bKash Wallet' },
                { id: 'nagad', name: 'Nagad MFS', desc: 'Direct Nagad Wallet' },
                { id: 'visa', name: 'Visa / MasterCard', desc: 'Credit & Debit Cards' },
              ].map(gw => (
                <button
                  key={gw.id}
                  type="button"
                  onClick={() => setPaymentMethod(gw.id)}
                  className={`p-3 rounded-xl border text-left ${paymentMethod === gw.id
                    ? 'bg-[#E7F0FC] border-[#059669] text-[#0F172A]'
                    : 'bg-white border-[#BDDDFA] text-[#55647C] hover:bg-[#E7F0FC]'
                    }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>{gw.name}</span>
                    {paymentMethod === gw.id && <Check className="w-3.5 h-3.5 text-[#059669]" />}
                  </div>
                  <div className="text-[10px] text-[#55647C] mt-0.5">{gw.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Security Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA] text-[11px] text-[#55647C] leading-relaxed">
            <Lock className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#0F172A] block">Bank-Grade 256-Bit TLS Encryption</span>
              You will be redirected to the official SSLCommerz hosted checkout page. HealNSight never stores payment PINs or card CVVs.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[#BDDDFA]">
            <Button
              variant="outline"
              size="sm"
              disabled={paymentLoading}
              onClick={() => setCheckoutModal(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={paymentLoading}
              onClick={handleProcessPayment}
            >
              Proceed to SSLCommerz Checkout →
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── 2. PAYMENT VERIFICATION STATUS MODAL ─── */}
      <Modal
        isOpen={!!paymentStatusModal?.isOpen}
        onClose={() => setPaymentStatusModal(null)}
        title="Payment Verification"
        subtitle={`Transaction Ref: ${paymentStatusModal?.txnRef || ''}`}
      >
        <div className="space-y-4 py-2">
          {paymentStatusModal?.status === 'loading' && (
            <div className="text-center py-8 space-y-4">
              <LoadingState message="Verifying Transaction with SSLCommerz..." />
            </div>
          )}

          {paymentStatusModal?.status === 'completed' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#E7F0FC] border border-[#059669] text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-[#059669] text-white flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-[#0F172A]">
                  Payment Verified &amp; Confirmed
                </h4>
                <p className="text-xs text-[#059669]">
                  Your payment has been validated and your appointment/order is confirmed.
                </p>
              </div>

              {/* Verified Details Table */}
              <div className="bg-white p-4 rounded-xl border border-[#BDDDFA] text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-[#BDDDFA]">
                  <span className="text-[#55647C]">Amount Paid</span>
                  <span className="font-bold text-[#0F172A]">৳{paymentStatusModal.txn?.amount} BDT</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#BDDDFA]">
                  <span className="text-[#55647C]">Transaction ID</span>
                  <span className="font-mono text-[#0F172A]">{paymentStatusModal.txnRef}</span>
                </div>
                {paymentStatusModal.txn?.val_id && (
                  <div className="flex justify-between py-1 border-b border-[#BDDDFA]">
                    <span className="text-[#55647C]">Validation ID</span>
                    <span className="font-mono text-[#0F172A]">{paymentStatusModal.txn.val_id}</span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-[#55647C]">Status</span>
                  <span className="font-bold text-[#059669] uppercase">CONFIRMED &amp; PAID</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {paymentStatusModal.txn && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setReceiptModalTxn(paymentStatusModal.txn);
                      setPaymentStatusModal(null);
                    }}
                  >
                    <Printer className="w-3.5 h-3.5 mr-1" />
                    Print Receipt
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setPaymentStatusModal(null)}
                >
                  Done
                </Button>
              </div>
            </div>
          )}

          {paymentStatusModal?.status === 'failed' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-50 border border-[#FF7A7A] text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-red-100 text-[#FF7A7A] flex items-center justify-center mx-auto">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-[#0F172A]">
                  Payment Could Not Be Verified
                </h4>
                <p className="text-xs text-[#FF7A7A]">
                  {paymentStatusModal.error || "The payment gateway rejected or could not validate this transaction."}
                </p>
              </div>

              <div className="text-xs text-[#55647C] bg-[#E7F0FC] p-3 rounded-xl border border-[#BDDDFA]">
                <p className="font-mono">Reference: {paymentStatusModal.txnRef}</p>
                <p className="mt-1">If money was deducted from your account, SSLCommerz will auto-reverse it or contact support.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setPaymentStatusModal(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}

          {paymentStatusModal?.status === 'cancelled' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-amber-900">
                  Payment Cancelled
                </h4>
                <p className="text-xs text-amber-700">
                  You cancelled the payment transaction on the SSLCommerz portal. No funds were charged.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="primary" size="sm" onClick={() => setPaymentStatusModal(null)}>
                  Return to Care Portal
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ─── 3. DIGITAL RECEIPT MODAL (PRINTABLE) ─── */}
      <Modal
        isOpen={!!receiptModalTxn}
        onClose={() => setReceiptModalTxn(null)}
        title=" Digital Receipt"
        subtitle="Payment Voucher"
      >
        <div id="receipt-print-area" className="space-y-4 p-2">
          {/* Header */}
          <div className="text-center pb-4 border-b border-[#BDDDFA] space-y-1">
            <span className="text-xs font-bold text-[#059669] uppercase tracking-widest block">HealNSight</span>
            <h3 className="text-base font-bold text-[#0F172A]">Customer Payment Receipt</h3>
            <p className="text-[10px] text-[#55647C] font-mono">Date: {receiptModalTxn?.created_at ? new Date(receiptModalTxn.created_at).toLocaleString() : ''}</p>
          </div>

          {/* Voucher Details */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#BDDDFA]/40">
              <span className="text-[#55647C] font-medium">Customer Name</span>
              <span className="font-bold text-[#0F172A]">{user.first_name} {user.last_name || user.username}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#BDDDFA]/40">
              <span className="text-[#55647C] font-medium">Service Description</span>
              <span className="font-bold text-[#0F172A]">
                {receiptModalTxn?.appointment_details ? `Doctor Visit: ${receiptModalTxn.appointment_details.doctor_name}` : receiptModalTxn?.order_details ? `Medicine Order #${receiptModalTxn.order_details.id}` : 'Telehealth Service'}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#BDDDFA]/40">
              <span className="text-[#55647C] font-medium">Transaction Reference</span>
              <span className="font-mono text-[#0F172A]">{receiptModalTxn?.transaction_ref}</span>
            </div>
            {receiptModalTxn?.val_id && (
              <div className="flex justify-between py-1.5 border-b border-[#BDDDFA]/40">
                <span className="text-[#55647C] font-medium">SSL Validation ID</span>
                <span className="font-mono text-[#0F172A]">{receiptModalTxn.val_id}</span>
              </div>
            )}
            <div className="flex justify-between py-1.5 border-b border-[#BDDDFA]/40">
              <span className="text-[#55647C] font-medium">Payment Gateway</span>
              <span className="font-semibold text-[#0F172A] uppercase">{receiptModalTxn?.gateway || 'SSLCommerz'}</span>
            </div>
            <div className="flex justify-between py-2 text-sm font-bold bg-[#E7F0FC] p-2.5 rounded-xl text-[#0F172A]">
              <span>Total Amount Paid:</span>
              <span className="text-[#059669]">৳{receiptModalTxn?.amount ? parseFloat(receiptModalTxn.amount).toFixed(2) : "0.00"} BDT</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#E7F0FC] border border-[#059669] text-center text-[10px] font-semibold text-[#059669]">
            ✓
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#BDDDFA]">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              Print
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setReceiptModalTxn(null)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
