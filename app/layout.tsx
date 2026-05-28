import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Football Legends XI",
  description: "국가별 축구 레전드 베스트11 빌더",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
