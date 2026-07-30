import { PanelHome } from "@/components/PanelHome";

/** The panel's landing page. It used to redirect to /bookings, which opened the
 * cabinet on an empty list filtered to today — a form, not an answer. Staff
 * open the panel asking "what needs me right now" first and "how are we doing"
 * second, so that is the order the page renders in. */
export default function PanelIndex() {
  return <PanelHome />;
}
