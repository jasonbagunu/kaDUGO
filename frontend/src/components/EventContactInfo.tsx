import { Globe, Mail, MessageCircle, Phone, Share2 } from "lucide-react";

interface Channels {
  contact: string; facebookUrl: string; messengerUrl: string; contactEmail: string; otherPlatforms: string;
}

// The ways donors can reach the organizers or follow the event's announcements.
export default function EventContactInfo({ event, className = "" }: { event: Channels; className?: string }) {
  const rows = [
    event.contact && { icon: Phone, label: "Contact number", value: event.contact, href: `tel:${event.contact}` },
    event.contactEmail && { icon: Mail, label: "Email", value: event.contactEmail, href: `mailto:${event.contactEmail}` },
    event.facebookUrl && { icon: Share2, label: "Facebook page / event", value: event.facebookUrl, href: event.facebookUrl },
    event.messengerUrl && { icon: MessageCircle, label: "Messenger", value: event.messengerUrl, href: event.messengerUrl },
    event.otherPlatforms && { icon: Globe, label: "Other", value: event.otherPlatforms, href: "" },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href: string }[];
  if (rows.length === 0) return null;

  return (
    <div className={className} data-testid="event-contact-info">
      <div className="text-xs text-[#9CA3AF] font-semibold uppercase tracking-wide mb-2">How to reach the organizers</div>
      <ul className="space-y-2">
        {rows.map(({ icon: Icon, label, value, href }) => (
          <li key={label} className="flex items-start gap-2.5 text-sm">
            <Icon className="w-4 h-4 text-[#7C2D3E] mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-[#9CA3AF] uppercase font-semibold">{label}</div>
              {href ? (
                <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="text-[#7C2D3E] hover:underline break-all">{value}</a>
              ) : (
                <span className="text-[#1C1C2E] break-words">{value}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
