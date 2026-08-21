import { PRIVACY_URL } from "@/lib/links";

export function PrivacyPolicyLink() {
  return (
    <a
      href={PRIVACY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 hover:text-foreground"
    >
      Privacy Policy
    </a>
  );
}
