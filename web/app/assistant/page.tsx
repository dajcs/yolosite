import { listOffers } from "@/lib/offers";
import AddOffer from "./components/AddOffer";
import OfferCard from "./components/OfferCard";
import CheckEmailButton from "./components/CheckEmailButton";

export const dynamic = "force-dynamic";

export default async function OffersPage() {
  const offers = await listOffers();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Offers</h1>
        <div className="flex flex-wrap items-center gap-3">
          <CheckEmailButton />
          <AddOffer />
        </div>
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
