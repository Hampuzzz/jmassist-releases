import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-workshop-bg">
      <div className="text-center space-y-4 max-w-md px-4">
        <h1 className="text-6xl font-bold text-workshop-accent">404</h1>
        <h2 className="text-xl font-semibold text-workshop-text">
          Sidan hittades inte
        </h2>
        <p className="text-workshop-muted text-sm">
          Sidan du letar efter existerar inte eller har flyttats.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 bg-workshop-accent hover:bg-workshop-accent-hover text-white rounded-md text-sm font-medium transition-colors"
        >
          Tillbaka till startsidan
        </Link>
      </div>
    </div>
  );
}
