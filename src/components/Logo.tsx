import logo from "@/assets/logo.png";

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <img
        src={logo}
        alt="Symptom Compass"
        width={size}
        height={size}
        className="drop-shadow-[0_0_12px_oklch(0.84_0.17_200/0.5)]"
      />
      <span className="font-display text-lg font-semibold tracking-tight">
        Symptom Compass<span className="text-neon">.</span>
      </span>
    </div>
  );
}

