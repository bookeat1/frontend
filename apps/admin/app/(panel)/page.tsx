import { VenueDashboard } from "@/components/VenueDashboard";

/** The panel's landing page. It used to redirect to /bookings, which opened the
 * cabinet on an empty list filtered to today — a form, not an answer. Staff
 * open the panel asking "how are we doing", so that is what greets them now. */
export default function PanelIndex() {
  return <VenueDashboard />;
}
