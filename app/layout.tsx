import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./providers";

const appSans = Plus_Jakarta_Sans({
	subsets: ["latin"],
	display: "swap",
	variable: "--font-app-sans",
});

// Satu huruf saja. Montserrat dulu diunduh dengan tiga bobot dan dipakai di
// satu wordmark; hierarki sekarang datang dari peran type-* di globals.css.

export const metadata: Metadata = {
	title: "SMD Pridata",
	description: "Sistem pemesanan dan distribusi CV. Pridata Jaya.",
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
	themeColor: "#0291c5",
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
			className={`h-full antialiased ${appSans.variable}`}
		>
			<body className="min-h-full bg-slate-50 font-sans">
				<AuthProvider>{children}</AuthProvider>
			</body>
		</html>
	);
}
