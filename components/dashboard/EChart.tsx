"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

type ChartAreaClickPayload = {
	offsetX: number;
	offsetY: number;
	chart: echarts.ECharts;
};

export default function EChart({
	option,
	height = 320,
	className = "",
	onClick,
	onChartAreaClick,
}: {
	option: EChartsOption;
	height?: number;
	className?: string;
	onClick?: (params: unknown) => void;
	onChartAreaClick?: (payload: ChartAreaClickPayload) => void;
}) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const chartRef = useRef<echarts.ECharts | null>(null);

	useEffect(() => {
		if (!containerRef.current) return;

		const chart = echarts.init(containerRef.current, undefined, { renderer: "svg" });
		chartRef.current = chart;
		const handleResize = () => chart.resize();

		const observer = new ResizeObserver(() => {
			handleResize();
		});

		observer.observe(containerRef.current);
		window.addEventListener("resize", handleResize);

		return () => {
			observer.disconnect();
			window.removeEventListener("resize", handleResize);
			chart.dispose();
			chartRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (!chartRef.current) return;
		chartRef.current.setOption(option, true);
	}, [option]);

	useEffect(() => {
		if (!chartRef.current || !onClick) return;

		const chart = chartRef.current;
		const handleClick = (params: unknown) => {
			onClick(params);
		};

		chart.on("click", handleClick);
		return () => {
			chart.off("click", handleClick);
		};
	}, [onClick]);

	useEffect(() => {
		if (!chartRef.current || !onChartAreaClick) return;

		const chart = chartRef.current;
		const zrender = chart.getZr();
		const handleAreaClick = (event: { target?: unknown; offsetX: number; offsetY: number }) => {
			if (event.target) return;
			onChartAreaClick({ offsetX: event.offsetX, offsetY: event.offsetY, chart });
		};

		zrender.on("click", handleAreaClick);
		return () => {
			zrender.off("click", handleAreaClick);
		};
	}, [onChartAreaClick]);

	return (
		<div
			ref={containerRef}
			className={className}
			style={{ height, cursor: onClick || onChartAreaClick ? "pointer" : "default" }}
		/>
	);
}
