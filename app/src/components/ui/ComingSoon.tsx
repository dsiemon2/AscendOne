import { useThemeStore } from "../../store/themeStore";

interface ComingSoonProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export default function ComingSoon({ icon, title, description }: ComingSoonProps) {
  const { theme } = useThemeStore();
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-80 gap-4 text-center max-w-md mx-auto">
      <div
        className="rounded-2xl flex items-center justify-center"
        style={{
          width: 80, height: 80,
          background: theme.accentLight,
          border: `2px solid ${theme.bgCardBorder}`,
        }}
      >
        {icon}
      </div>
      <h1 className="font-bold" style={{ color: theme.textPrimary, fontSize: "1.5rem" }}>{title}</h1>
      <p style={{ color: theme.textSecondary, fontSize: "0.9rem", lineHeight: 1.6 }}>{description}</p>
      <div
        className="px-4 py-2 rounded-full text-sm font-medium"
        style={{ background: theme.accentLight, color: theme.accent, border: `1px solid ${theme.bgCardBorder}` }}
      >
        In development
      </div>
    </div>
  );
}
