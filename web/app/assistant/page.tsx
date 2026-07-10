import { listOffers } from "@/lib/offers";
import { getState } from "@/lib/state";
import AddOffer from "./components/AddOffer";
import OfferCard from "./components/OfferCard";
import EmailPanel from "./components/EmailPanel";

export const dynamic = "force-dynamic";

export default async function OffersPage() {
  const [offers, lastCheck] = await Promise.all([
    listOffers(),
    getState("last_email_check"),
  ]);
  return (
    <div className="space-y-6">
      <EmailPanel lastCheck={lastCheck} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Offers</h1>
        <AddOffer />
      </div>
      {offers.length === 0 ? (
        <p className="text-gray">No open offers.</p>
      ) : (
        <div className="space-y-4">
          {offers.map((o) => (
            <OfferCard key={o.id} offer={o} />
          ))}
        </div>
      )}
    </div>
  );
}
