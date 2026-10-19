import { Alert } from "react-native";
import { CustomerAPI, money } from "@cargoone/core";

// Native "Cancel booking?" confirm with server cancel-preview figures; only onConfirm cancels.
export async function confirmCancelBooking(opts: {
  bookingId: string;
  paid: boolean;
  driverAccepted: boolean;
  onConfirm: () => void;
}) {
  let message = opts.paid
    ? opts.driverAccepted
      ? "A driver has accepted your booking. A cancellation fee may be deducted from your deposit per our cancellation policy."
      : "Cancel this ASAP booking and request a refund of your deposit."
    : "Cancel this booking? No deposit has been taken.";
  if (opts.paid) {
    try {
      const p = await CustomerAPI.cancelPreview(opts.bookingId);
      if (p && p.deposit_paid != null) {
        message +=
          `\n\nDeposit paid: ${money(Number(p.deposit_paid))}` +
          `\nCancellation fee: ${money(Number(p.cancellation_fee ?? 0))}` +
          `\nRefund to your card: ${money(Number(p.refund_amount ?? 0))}`;
      }
    } catch {
      /* preview unavailable — still confirm, without figures */
    }
  }
  Alert.alert(
    "Cancel booking?",
    message,
    [
      { text: "Keep booking", style: "cancel" },
      { text: "Cancel booking", style: "destructive", onPress: opts.onConfirm },
    ],
    { cancelable: true },
  );
}
