import "../styles/globals.css";
import React from "react";

export const metadata = {
  title: "Metric Trees Designer",
  description: "North Star → Metric Trees (MCP)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* force light theme text */}
      <body className="bg-white text-neutral-900">
        {children}
      </body>
    </html>
  );
}
