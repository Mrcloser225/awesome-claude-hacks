import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Closer",
  description: "Claude on your sales calls. Live script, answers to what the prospect asks, and the questions you still need to ask.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
