import { Turnstile } from "@marsidev/react-turnstile";
import { useTheme } from "@/lib/theme";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string;

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  className?: string;
}

export function TurnstileWidget({ onVerify, onExpire, onError, className }: TurnstileWidgetProps) {
  const { theme } = useTheme();

  return (
    <div className={className}>
      <Turnstile
        siteKey={SITE_KEY}
        onSuccess={onVerify}
        onExpire={onExpire}
        onError={onError}
        options={{
          theme: theme === "dark" ? "dark" : "light",
          language: "id",
        }}
      />
    </div>
  );
}
