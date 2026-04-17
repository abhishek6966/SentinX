import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <SignIn appearance={{
        elements: {
          formButtonPrimary: "bg-accent-blue hover:bg-blue-500 transition-all",
          card: "bg-surface-card border border-surface-border",
          headerTitle: "text-white",
          headerSubtitle: "text-gray-400",
          socialButtonsBlockButton: "bg-surface-elevated border-surface-border text-white hover:bg-surface-border",
          socialButtonsBlockButtonText: "text-white",
          dividerLine: "bg-surface-border",
          dividerText: "text-gray-500",
          formFieldLabel: "text-gray-400",
          formFieldInput: "bg-surface-elevated border-surface-border text-white outline-none focus:ring-1 focus:ring-accent-blue",
          footerActionText: "text-gray-500",
          footerActionLink: "text-accent-blue hover:text-blue-400"
        }
      }} />
    </div>
  );
}
