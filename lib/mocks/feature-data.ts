import type { StoreGradeItem } from "@/services/grade";
import type { InvoiceListItem } from "@/services/invoices";
import type { OrderListItem } from "@/services/orders";
import type { Payment } from "@/services/payments";
import type { ReceivableRow } from "@/services/receivable";
import type { Store } from "@/services/stores";

type RegisterStorePayload = {
	ownerName: string;
	ownerEmail: string;
	storeName: string;
	ownerGender: "MALE" | "FEMALE";
	ownerPhoneNumber?: string;
	phone: string;
	address: string;
	cityId?: string;
	newCityName?: string;
	newCityProvince?: string;
	storeType?: "RETAILER" | "WHOLESALER" | "DISTRIBUTOR";
	yearsInBusiness: number;
	estimatedMonthlyRevenue?: number;
	salesNotes?: string;
};

interface FeatureMockState {
	grades: StoreGradeItem[];
	stores: Map<string, Store>;
	receivables: ReceivableRow[];
}

export interface MockGradeTransactions {
	orders: OrderListItem[];
	invoices: InvoiceListItem[];
	payments: Payment[];
}

const grades = ["A+", "A", "B+", "B", "C+", "C", "D", "N"] as const;
const gradeProfiles: Record<(typeof grades)[number], { monthlyPurchase: number; paymentDays: number }> = {
	"A+": { monthlyPurchase: 18_000_000, paymentDays: 28 },
	A: { monthlyPurchase: 10_000_000, paymentDays: 35 },
	"B+": { monthlyPurchase: 9_000_000, paymentDays: 48 },
	B: { monthlyPurchase: 5_000_000, paymentDays: 40 },
	"C+": { monthlyPurchase: 18_000_000, paymentDays: 70 },
	C: { monthlyPurchase: 10_000_000, paymentDays: 70 },
	D: { monthlyPurchase: 8_000_000, paymentDays: 105 },
	N: { monthlyPurchase: 0, paymentDays: 0 },
};
const cities = [
	["Bandung", "Jawa Barat"],
	["Jakarta Barat", "DKI Jakarta"],
	["Semarang", "Jawa Tengah"],
	["Surabaya", "Jawa Timur"],
	["Medan", "Sumatera Utara"],
] as const;

const buildGrade = (index: number): StoreGradeItem => {
	const grade = grades[index % grades.length];
	const storeNumber = index + 1;
	const profile = gradeProfiles[grade];
	const salesAmount = profile.monthlyPurchase * 3;
	const outstandingRatio = grade === "N" ? 0 : profile.paymentDays <= 40 ? 0.08 : profile.paymentDays <= 54 ? 0.2 : profile.paymentDays <= 90 ? 0.4 : 0.75;
	const outstanding = Math.round(salesAmount * outstandingRatio);
	return {
		storeId: `mock-store-${String(storeNumber).padStart(3, "0")}`,
		storeName: `Toko Mitra ${String(storeNumber).padStart(2, "0")}`,
		email: `mitra${storeNumber}@mock.pridata.test`,
		isActive: true,
		verificationStatus: "VERIFIED",
		creditLimit: grade.startsWith("A") ? 100_000_000 : grade.startsWith("B") ? 60_000_000 : 25_000_000,
		totalOrders: grade === "N" ? 0 : 8 + storeNumber,
		totalInvoices: grade === "N" ? 0 : 5 + storeNumber,
		totalSalesAmount: salesAmount * 3,
		totalPaidAmount: salesAmount * 3 - outstanding,
		totalOutstandingAmount: outstanding,
		recentOrders: grade === "N" ? 0 : Math.max(1, 7 - (index % 6)),
		recentInvoices: grade === "N" ? 0 : Math.max(1, 6 - (index % 6)),
		recentSalesAmount: grade === "N" ? 0 : salesAmount,
		recentPaidAmount: grade === "N" ? 0 : salesAmount - outstanding,
		recentOutstandingAmount: grade === "N" ? 0 : outstanding,
		averageMonthlyPurchase: profile.monthlyPurchase,
		averagePaymentDays: profile.paymentDays,
		evaluationWindowStart: "2026-05-28T00:00:00.000Z",
		evaluationWindowEnd: "2026-08-26T00:00:00.000Z",
		probationEndsAt: "2025-02-01T00:00:00.000Z",
		storeAgeDays: grade === "N" ? 14 : 180 + storeNumber,
		gradeReason: grade === "N" ? "Grade N: outlet baru atau belum memiliki invoice penilaian." : `Grade ${grade}: rata-rata pembelian ${profile.monthlyPurchase.toLocaleString("id-ID")} per bulan dan pembayaran ${profile.paymentDays} hari.`,
		grade,
	};
};

const toStore = (grade: StoreGradeItem, index: number): Store => {
	const city = cities[index % cities.length];
	return {
		id: grade.storeId,
		userId: `mock-user-${index + 1}`,
		assignedSalesUserId: "mock-sales-user",
		name: grade.storeName,
		email: grade.email,
		phone: `08123456${String(index + 1).padStart(4, "0")}`,
		address: `Jalan Mitra Pridata No. ${index + 1}, ${city[0]}`,
		cityId: `mock-city-${(index % cities.length) + 1}`,
		city: { id: `mock-city-${(index % cities.length) + 1}`, name: city[0], province: city[1] },
		user: {
			id: `mock-user-${index + 1}`,
			name: `Pemilik Toko ${index + 1}`,
			email: grade.email,
			profile: { gender: index % 2 === 0 ? "MALE" : "FEMALE", phone: `08129876${String(index + 1).padStart(4, "0")}` },
		},
		assignedSalesUser: { id: "mock-sales-user", name: "Sales Demo", email: "sales@mock.pridata.test" },
		storeType: index % 3 === 0 ? "WHOLESALER" : "RETAILER",
		creditLimit: grade.creditLimit,
		documents: { ownerName: `Pemilik Toko ${index + 1}`, ownerGender: index % 2 === 0 ? "MALE" : "FEMALE", yearsInBusiness: 1 + (index % 12) },
		verificationStatus: grade.verificationStatus as Store["verificationStatus"],
		isActive: grade.isActive,
		createdAt: "2025-01-02T00:00:00.000Z",
		updatedAt: "2026-08-26T00:00:00.000Z",
	};
};

const buildInitialState = (): FeatureMockState => {
	const initialGrades = Array.from({ length: 36 }, (_, index) => buildGrade(index));
	const stores = new Map(initialGrades.map((grade, index) => [grade.storeId, toStore(grade, index)]));
	const today = new Date();
	const receivables = Array.from({ length: 47 }, (_, index): ReceivableRow => {
		const grade = initialGrades[index % initialGrades.length];
		const ageOptions = [-12, 8, 24, 45, 76, 110];
		const overdueDays = ageOptions[index % ageOptions.length];
		const dueDate = new Date(today);
		dueDate.setDate(today.getDate() - overdueDays);
		const invoiceDate = new Date(dueDate);
		invoiceDate.setDate(dueDate.getDate() - 30);
		const totalAmount = 2_500_000 + index * 375_000;
		const remainingAmount = Math.round(totalAmount * (0.25 + (index % 4) * 0.15));
		const datePart = invoiceDate.toISOString().slice(2, 10).replaceAll("-", "");
		return {
			id: `mock-receivable-${String(index + 1).padStart(3, "0")}`,
			invoiceNumber: `INV-${datePart}-${String(index + 1).padStart(4, "0")}`,
			invoiceDate: invoiceDate.toISOString(),
			customerName: grade.storeName,
			storeNameSnapshot: grade.storeName,
			store: { id: grade.storeId, name: grade.storeName },
			dueDate: dueDate.toISOString(),
			amount: totalAmount,
			totalAmount,
			remainingAmount,
			status: remainingAmount > 0 ? "UNPAID" : "PAID",
			storeId: grade.storeId,
		};
	});
	return { grades: initialGrades, stores, receivables };
};

const FEATURE_MOCK_VERSION = 4;
const globalMock = globalThis as typeof globalThis & {
	__pridataFeatureMock?: FeatureMockState;
	__pridataFeatureMockVersion?: number;
};
export const getFeatureMockState = () => {
	if (!globalMock.__pridataFeatureMock || globalMock.__pridataFeatureMockVersion !== FEATURE_MOCK_VERSION) {
		globalMock.__pridataFeatureMock = buildInitialState();
		globalMock.__pridataFeatureMockVersion = FEATURE_MOCK_VERSION;
	}
	return globalMock.__pridataFeatureMock;
};

export const buildMockGradeTransactions = (storeId: string): MockGradeTransactions | null => {
	const state = getFeatureMockState();
	const grade = state.grades.find((row) => row.storeId === storeId);
	if (!grade) return null;
	if (grade.grade === "N") return { orders: [], invoices: [], payments: [] };

	const storeNumber = Number(storeId.split("-").at(-1)) || 1;
	const transactionCount = 8;
	const now = new Date();
	const orders: OrderListItem[] = [];
	const invoices: InvoiceListItem[] = [];
	const payments: Payment[] = [];

	for (let index = 0; index < transactionCount; index += 1) {
		const sequence = index + 1;
		const invoiceDate = new Date(now);
		invoiceDate.setDate(now.getDate() - (grade.averagePaymentDays + 12 + index * 18));
		const paymentDate = new Date(invoiceDate);
		paymentDate.setDate(invoiceDate.getDate() + grade.averagePaymentDays + (index % 3) - 1);
		const dueDate = new Date(invoiceDate);
		dueDate.setDate(invoiceDate.getDate() + 40);
		const totalAmount = Math.max(1_000_000, Math.round((grade.averageMonthlyPurchase * 3) / transactionCount + index * 175_000));
		const isOpen = index === transactionCount - 1;
		const isPartial = index === transactionCount - 2;
		const paidAmount = isOpen ? 0 : isPartial ? Math.round(totalAmount * 0.6) : totalAmount;
		const remainingAmount = totalAmount - paidAmount;
		const orderId = `mock-order-${storeNumber}-${sequence}`;
		const invoiceId = `mock-invoice-${storeNumber}-${sequence}`;
		const datePart = invoiceDate.toISOString().slice(2, 10).replaceAll("-", "");
		const dailySequence = String(storeNumber * 100 + sequence).padStart(4, "0");
		const orderNumber = `ORD-${datePart}-${dailySequence}`;
		const invoiceNumber = `INV-${datePart}-${dailySequence}`;
		const firstSubtotal = Math.round(totalAmount * 0.65);
		const secondSubtotal = totalAmount - firstSubtotal;

		orders.push({
			id: orderId,
			orderNumber,
			status: "PROCESSED",
			storeId,
			sourceWarehouseId: "mock-warehouse-main",
			storeNameSnapshot: grade.storeName,
			documentDate: invoiceDate.toISOString(),
			totalAmount,
			notes: "Transaksi mock untuk verifikasi detail grade outlet.",
			processedAt: invoiceDate.toISOString(),
			items: [
				{ id: `${orderId}-item-1`, productId: "mock-product-cctv", condition: "GOOD", quantity: 1 + (index % 3), unitPriceSnapshot: Math.round(firstSubtotal / (1 + (index % 3))), subtotal: firstSubtotal, product: { id: "mock-product-cctv", name: "CCTV Outdoor 5MP", sku: "CCTV-5MP" } },
				{ id: `${orderId}-item-2`, productId: "mock-product-cable", condition: "GOOD", quantity: 2, unitPriceSnapshot: Math.round(secondSubtotal / 2), subtotal: secondSubtotal, product: { id: "mock-product-cable", name: "Kabel LAN Cat6", sku: "LAN-CAT6" } },
			],
		});

		invoices.push({
			id: invoiceId,
			invoiceNumber,
			invoiceDate: invoiceDate.toISOString(),
			dueDate: dueDate.toISOString(),
			status: isOpen ? "UNPAID" : isPartial ? "PARTIAL" : "PAID",
			orderId,
			storeId,
			storeNameSnapshot: grade.storeName,
			totalAmount,
			paidAmount,
			remainingAmount,
			order: { id: orderId, orderNumber, documentDate: invoiceDate.toISOString(), status: "PROCESSED" },
			deliveryOrder: { id: `mock-do-${storeNumber}-${sequence}`, deliveryOrderNumber: `DO-${datePart}-${dailySequence}`, status: "RECEIVED", receivedAt: new Date(invoiceDate.getTime() + 3 * 86_400_000).toISOString(), receiptNotes: "Diterima toko" },
		});

		if (paidAmount > 0) {
			payments.push({
				id: `mock-payment-${storeNumber}-${sequence}`,
				paymentNumber: `PAY-${datePart}-${dailySequence}`,
				invoiceId,
				storeId,
				amount: paidAmount,
				method: index % 2 === 0 ? "TRANSFER" : "CASH",
				status: "VERIFIED",
				paymentDate: paymentDate.toISOString(),
				referenceNo: `REF-MOCK-${storeNumber}-${sequence}`,
				notes: "Pembayaran mock terverifikasi.",
				verifiedAt: paymentDate.toISOString(),
			});
		}
	}

	return { orders, invoices, payments };
};

export const registerMockStore = (payload: RegisterStorePayload) => {
	const state = getFeatureMockState();
	if (state.grades.some((row) => row.email.toLowerCase() === payload.ownerEmail.toLowerCase())) {
		throw new Error("Email login toko sudah digunakan.");
	}
	const index = state.grades.length;
	const id = `mock-store-${String(index + 1).padStart(3, "0")}`;
	const now = new Date();
	const probationEndsAt = new Date(now);
	probationEndsAt.setDate(now.getDate() + 30);
	const grade: StoreGradeItem = {
		storeId: id,
		storeName: payload.storeName,
		email: payload.ownerEmail,
		isActive: false,
		verificationStatus: "PENDING",
		creditLimit: 0,
		totalOrders: 0,
		totalInvoices: 0,
		totalSalesAmount: 0,
		totalPaidAmount: 0,
		totalOutstandingAmount: 0,
		recentOrders: 0,
		recentInvoices: 0,
		recentSalesAmount: 0,
		recentPaidAmount: 0,
		recentOutstandingAmount: 0,
		averageMonthlyPurchase: 0,
		averagePaymentDays: 0,
		evaluationWindowStart: now.toISOString(),
		evaluationWindowEnd: now.toISOString(),
		probationEndsAt: probationEndsAt.toISOString(),
		storeAgeDays: 0,
		gradeReason: "Grade N: toko baru dan menunggu verifikasi.",
		grade: "N",
	};
	const cityName = payload.newCityName || "Kota tersimpan";
	const store: Store = {
		id,
		userId: `mock-user-${index + 1}`,
		assignedSalesUserId: "mock-sales-user",
		name: payload.storeName,
		email: payload.ownerEmail,
		phone: payload.phone,
		address: payload.address,
		cityId: payload.cityId || `mock-city-new-${index + 1}`,
		city: { id: payload.cityId || `mock-city-new-${index + 1}`, name: cityName, province: payload.newCityProvince },
		user: { id: `mock-user-${index + 1}`, name: payload.ownerName, email: payload.ownerEmail, profile: { gender: payload.ownerGender, phone: payload.ownerPhoneNumber } },
		assignedSalesUser: { id: "mock-sales-user", name: "Sales Demo", email: "sales@mock.pridata.test" },
		storeType: payload.storeType || "RETAILER",
		creditLimit: 0,
		documents: { ownerName: payload.ownerName, ownerGender: payload.ownerGender, ownerPhoneNumber: payload.ownerPhoneNumber, yearsInBusiness: payload.yearsInBusiness, estimatedMonthlyRevenue: payload.estimatedMonthlyRevenue, salesNotes: payload.salesNotes },
		verificationStatus: "PENDING",
		isActive: false,
		createdAt: now.toISOString(),
		updatedAt: now.toISOString(),
	};
	state.grades.push(grade);
	state.stores.set(id, store);
	return store;
};
