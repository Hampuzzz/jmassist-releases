import { BookingWidget } from "@/components/kalender/BookingWidget";

export const metadata = { title: "Boka tid" };

/**
 * Public-facing booking page.
 * This page can be embedded via iframe on the workshop's website:
 * <iframe src="https://YOUR_TUNNEL_URL/boka" width="100%" height="700" frameborder="0"></iframe>
 */
export default function BokaPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

  return (
    <div className="min-h-screen bg-workshop-bg flex items-start justify-center pt-8 pb-16">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-workshop-text">
            {process.env.WORKSHOP_NAME ?? "Bilverkstad"}
          </h1>
          <p className="text-workshop-muted text-sm">Boka din tid enkelt online</p>
        </div>
        <BookingWidget
          apiUrl={apiUrl}
          serviceType="Verkstadsbesök"
        />
      </div>
    </div>
  );
}
