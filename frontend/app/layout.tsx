import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TrustPass — Verifiable Credentials",
  description:
    "Selectively share verified credentials with cryptographic proof. Built with Merkle trees and Ed25519 signatures.",
  keywords: ["verifiable credentials", "selective disclosure", "digital identity"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: "#1a1a35",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#f1f5f9",
            },
          }}
        />
      </body>
    </html>
  );
}
