import { useEffect, useId, useState, type ReactNode } from "react";

const MOBILE_QUERY = "(max-width: 639px)";

function isMobileViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(MOBILE_QUERY).matches
  );
}

export function MobileDisclosure({
  children,
  className = "",
  title,
}: Readonly<{
  children: ReactNode;
  className?: string;
  title: string;
}>) {
  const contentId = useId();
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const [isExpanded, setIsExpanded] = useState(() => !isMobileViewport());

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const query = window.matchMedia(MOBILE_QUERY);
    const update = () => {
      setIsMobile(query.matches);
      setIsExpanded(!query.matches);
    };

    update();
    query.addEventListener?.("change", update);

    return () => query.removeEventListener?.("change", update);
  }, []);

  const contentIsVisible = !isMobile || isExpanded;

  return (
    <section className={`mobile-disclosure ${className}`}>
      <button
        aria-controls={contentId}
        aria-expanded={contentIsVisible}
        className="mobile-disclosure-trigger"
        onClick={() => setIsExpanded((current) => !current)}
        type="button"
      >
        <span>{title}</span>
        <span aria-hidden="true">{contentIsVisible ? "−" : "+"}</span>
      </button>

      <div hidden={!contentIsVisible} id={contentId}>
        {children}
      </div>
    </section>
  );
}
