"use client";

import { useState, useEffect } from "react";

export default function CountdownTimer({ closesAt }: { closesAt: string }) {
  const [remaining, setRemaining] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    function update() {
      // SQLite stores UTC without 'Z' suffix, so append it
      const deadline = new Date(closesAt + "Z").getTime();
      const diff = deadline - Date.now();

      if (diff <= 0) {
        setRemaining("Voting ended");
        setExpired(true);
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${hours}h ${mins}m ${secs}s remaining`);
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [closesAt]);

  return (
    <span
      className={`text-sm font-medium ${expired ? "text-[var(--color-danger)]" : "text-[var(--color-accent)]"}`}
    >
      ⏱ {remaining}
    </span>
  );
}
