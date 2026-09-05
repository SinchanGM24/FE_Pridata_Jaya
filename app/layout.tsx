import type { Metadata, Viewport } from "next";
import { Montserrat, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./providers";

const appSans = Plus_Jakarta_Sans({
	subsets: ["latin"],
	display: "swap",
	variable: "--font-app-sans",
});

const appBrand = Montserrat({
	subsets: ["latin"],
	display: "swap",
	weight: ["600", "700", "800"],
	variable: "--font-app-brand",
});

export const metadata: Metadata = {
	title: "SMD Pridata",
	description: "SMD Pridata - Enterprise Management System",
	icons: {
		icon: "/favicon.ico",
	},
};

// viewport-fit=cover wajib, kalau tidak env(safe-area-inset-*) selalu 0
// dan bottom tab bar tertutup home indicator.
export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	themeColor: "#0284c7",
	colorScheme: "light",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="id"
			className={`h-full antialiased ${appSans.variable} ${appBrand.variable}`}
		>
			<body className="min-h-full bg-gray-50 font-sans">
				<AuthProvider>{children}</AuthProvider>
			</body>
		</html>
	);
}
