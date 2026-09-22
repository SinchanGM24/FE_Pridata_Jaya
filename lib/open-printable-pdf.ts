/**
 * Opens an ordinary browser tab during the click gesture, then replaces it with
 * a PDF and starts the browser print flow once the PDF viewer is ready.
 */
export const openPrintablePdfTab = (title: string): Window | null => {
	const printWindow = window.open("", "_blank");
	if (!printWindow) return null;

	printWindow.opener = null;
	printWindow.document.title = title;
	printWindow.document.body.innerHTML =
		'<p style="font-family: sans-serif; padding: 24px">Menyiapkan dokumen untuk dicetak...</p>';
	return printWindow;
};

export const displayPrintablePdf = (printWindow: Window, url: string) => {
	printWindow.addEventListener(
		"load",
		() => {
			printWindow.focus();
			printWindow.print();
		},
		{ once: true },
	);
	printWindow.location.replace(url);
};
