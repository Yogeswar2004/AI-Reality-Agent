import { Zap, Globe } from "lucide-react";
import Badge from "../common/Badge";

function CacheBadge({ isCached, networkCallMade = false, cachedAt = null, size = "xs" }) {
  if (isCached) {
    const formattedDate = cachedAt
      ? new Date(cachedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : null;

    return (
      <Badge
        variant="cache"
        size={size}
        title={formattedDate ? `Served from cache (saved at ${formattedDate})` : "Served from cache"}
      >
        <Zap size={10} style={{ marginRight: "2px" }} />
        Cached{formattedDate ? ` • ${formattedDate}` : ""}
      </Badge>
    );
  }

  if (networkCallMade) {
    return (
      <Badge
        variant="default"
        size={size}
        title="Live provider network call executed"
      >
        <Globe size={10} style={{ marginRight: "2px" }} />
        Live Call
      </Badge>
    );
  }

  return null;
}

export default CacheBadge;

