import React from 'react';
import {
  Pill, ShoppingBag, Package, RefreshCw
} from 'lucide-react';
import {
  Button, Card, CardHeader, CardTitle, CardContent, EmptyState, PageHeader
} from '../ui';

export const PatientPharmacySection = ({
  medicinesCatalog,
  cart,
  handleAddToCart,
  handleRemoveFromCart,
  deliveryAddress,
  setDeliveryAddress,
  handleCheckoutCart,
  orders,
  fetchPrescriptionsAndOrders,
  setSubView
}) => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Medicine Store & Courier Dispatch"
        subtitle="Order pharmacy with digital payment & delivery."
        action={
          <Button variant="outline" size="sm" onClick={() => setSubView('overview')}>
            Back to Health Home
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Medicines List (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {medicinesCatalog.map(med => (
              <Card key={med.id} className="p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between">
                    <div className="w-8 h-8 rounded-lg bg-[#E7F0FC] text-[#059669] flex items-center justify-center mb-2 border border-[#BDDDFA]">
                      <Pill className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-[#059669]">{med.price} BDT</span>
                  </div>
                  <h4 className="text-sm font-bold text-[#0F172A]">{med.name}</h4>
                  <p className="text-xs text-[#55647C] mt-0.5">{med.dosage || 'Standard Dosage'}</p>
                </div>

                <div className="pt-3 mt-3 border-t border-[#BDDDFA]">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAddToCart(med)}
                    className="w-full"
                  >
                    Add to Cart
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Cart & Checkout Drawer (1 col) */}
        <Card className="h-fit">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#059669]" />
              <CardTitle>Cart Summary ({cart.reduce((a, b) => a + b.qty, 0)})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {cart.length === 0 ? (
              <p className="text-xs text-[#55647C] text-center py-4">Your pharmacy cart is empty.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto divide-y divide-[#BDDDFA]">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center py-2 text-xs">
                    <div>
                      <p className="font-semibold text-[#0F172A]">{item.name}</p>
                      <p className="text-[10px] text-[#55647C]">{item.qty} × {item.price} BDT</p>
                    </div>
                    <button
                      onClick={() => handleRemoveFromCart(item.id)}
                      className="text-[#FF7A7A] hover:bg-red-50 text-xs font-bold p-1 rounded"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Delivery Address</label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                placeholder="House, Road, Area, City..."
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>

            <div className="pt-3 border-t border-[#BDDDFA] flex justify-between items-center">
              <span className="text-xs font-bold text-[#55647C]">Total Payable:</span>
              <span className="text-base font-bold text-[#059669]">
                {cart.reduce((sum, item) => sum + item.price * item.qty, 0)} BDT
              </span>
            </div>

            <Button
              variant="primary"
              onClick={handleCheckoutCart}
              disabled={cart.length === 0}
              className="w-full"
            >
              Proceed to Payment
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Patient's Medicine Orders & Courier Tracking */}
      <div className="pt-6 border-t border-[#BDDDFA] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <Package className="w-4 h-4 text-[#168CF5]" />
              My Medicine Orders & Delivery Tracking
            </h3>
            <p className="text-xs text-[#55647C]">Track fulfillment progress and home delivery dispatch in real time.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPrescriptionsAndOrders}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh Orders
          </Button>
        </div>

        {orders.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No Medicine Orders Yet"
            description="Your placed pharmacy orders and prescription deliveries will appear here."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map(ord => {
              const s = (ord.status || 'pending').toLowerCase();
              const isDelivered = s === 'delivered';
              const isConfirmed = s === 'confirmed';
              const isInTransit = s === 'shipping' || s === 'out_for_delivery';
              const isPacking = s === 'packing';
              const isPending = s === 'pending';

              const badgeClass = isDelivered || isConfirmed
                ? 'bg-[#E7F0FC] text-[#059669] border border-[#059669]'
                : isInTransit || isPacking
                  ? 'bg-blue-50 text-[#168CF5] border border-[#168CF5]/40'
                  : isPending
                    ? 'bg-amber-50 text-amber-700 border border-amber-300'
                    : 'bg-slate-100 text-slate-700 border border-slate-300';

              const statusText = s === 'shipping' ? 'In Transit'
                : s === 'out_for_delivery' ? 'Out for Delivery'
                  : s.charAt(0).toUpperCase() + s.slice(1);

              return (
                <Card key={ord.id} className="p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-xs font-bold text-[#0F172A]">Order #{ord.id}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${badgeClass}`}>
                        {statusText}
                      </span>
                    </div>

                    <div className="text-xs text-[#334155] space-y-1 mb-3 bg-[#E7F0FC] p-2.5 rounded-xl border border-[#BDDDFA]">
                      <p className="font-semibold text-[#0F172A]">{Array.isArray(ord.items_breakdown) ? ord.items_breakdown.length : 1} item(s)</p>
                      {Array.isArray(ord.items_breakdown) && ord.items_breakdown.map((item, idx) => (
                        <p key={idx} className="text-[10px] text-[#55647C] truncate">
                          • {item.name} ({item.quantity}x)
                        </p>
                      ))}
                      <p className="text-[10px] text-[#55647C] pt-1 border-t border-[#BDDDFA] truncate">
                        Delivery: {ord.delivery_address}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#BDDDFA] text-xs">
                    <span className="text-[#55647C] font-mono text-[10px]">
                      {ord.created_at ? new Date(ord.created_at).toLocaleDateString() : 'Recent'}
                    </span>
                    <span className="font-bold text-[#059669]">
                      ৳{parseFloat(ord.total_price || 0).toFixed(2)} BDT
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

