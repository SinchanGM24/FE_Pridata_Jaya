import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "SMD Pridata",
	description: "SMD Pridata - Enterprise Management System",
	icons: {
		icon: "/favicon.ico",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="h-full antialiased">
			<body className="min-h-full bg-gray-50 font-sans">{children}</body>
		</html>
	);
}
