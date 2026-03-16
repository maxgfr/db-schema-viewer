"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
	X,
	Upload,
	Table,
	BarChart3,
	Download,
	Search,
	ChevronUp,
	ChevronDown,
	FlaskConical,
	RefreshCw,
	Database,
	Hash,
	Type,
	Calendar,
	ToggleLeft,
	FileQuestion,
	Trash2,
	MessageSquare,
} from "lucide-react";
import { parseSQLDump, type ParsedDumpTable } from "@/lib/dump/dump-parser";
import { generateFakeData } from "@/lib/dump/fake-data-generator";
import { inferColumnTypes, type InferredType } from "@/lib/dump/data-types";
import type { Diagram } from "@/lib/domain";
import { DataCharts } from "./DataCharts";
import { DataChat } from "./DataChat";
import {
	DataExplorerProvider,
	useDataExplorer,
	DEFAULT_VIEW_STATE,
} from "./DataExplorerContext";

interface DataExplorerProps {
	onClose: () => void;
	diagram?: Diagram;
	visible?: boolean;
}

const TYPE_ICON: Record<InferredType, typeof Hash> = {
	number: Hash,
	string: Type,
	date: Calendar,
	boolean: ToggleLeft,
	null: FileQuestion,
};

const TYPE_COLOR: Record<InferredType, string> = {
	number: "text-blue-400",
	string: "text-emerald-400",
	date: "text-amber-400",
	boolean: "text-purple-400",
	null: "text-muted-foreground/50",
};

export function DataExplorer(props: DataExplorerProps) {
	return (
		<DataExplorerProvider>
			<DataExplorerContent {...props} />
		</DataExplorerProvider>
	);
}

function DataExplorerContent({
	onClose,
	diagram,
	visible = true,
}: DataExplorerProps) {
	const {
		tables,
		setTables,
		selectedTable,
		setSelectedTable,
		dataSource,
		setDataSource,
		setFakeSeed,
		tableViewStates,
		updateTableViewState,
		chatHistory,
		updateChatMessages,
		clearAll,
	} = useDataExplorer();

	const [isDragOver, setIsDragOver] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const PAGE_SIZE = 50;
	const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

	// Per-table view state
	const currentTableKey = selectedTable ?? "";
	const viewState = tableViewStates[currentTableKey] ?? DEFAULT_VIEW_STATE;
	const { view, page, searchQuery, sortColumn, sortDirection } = viewState;

	const setView = useCallback(
		(v: "table" | "chart" | "chat") => {
			updateTableViewState(currentTableKey, { view: v });
		},
		[currentTableKey, updateTableViewState],
	);

	const handleFile = useCallback(
		(file: File) => {
			if (file.size > MAX_FILE_SIZE) {
				toast.error("File too large", {
					description:
						"Maximum file size is 5MB. Please use a smaller SQL dump.",
				});
				return;
			}
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const content = e.target?.result as string;
					const parsed = parseSQLDump(content);
					if (parsed.length === 0) {
						toast.error("No INSERT statements found in the file");
						return;
					}
					setTables(parsed);
					setSelectedTable(parsed[0]!.name);
					setDataSource("upload");
					toast.success(`Loaded ${parsed.length} tables with data`);
				} catch (err) {
					toast.error(
						err instanceof Error ? err.message : "Failed to parse dump",
					);
				}
			};
			reader.onerror = () => {
				toast.error("Failed to read file");
			};
			reader.readAsText(file);
		},
		[setTables, setSelectedTable, setDataSource],
	);

	const handleGenerateFakeData = useCallback(() => {
		if (!diagram || diagram.tables.length === 0) {
			toast.error("No schema loaded to generate data from");
			return;
		}
		try {
			setFakeSeed((prev) => {
				const nextSeed = prev + 1;
				const faked = generateFakeData(diagram.tables, diagram.relationships, {
					seed: nextSeed,
				});
				if (faked.length === 0) {
					toast.error("Could not generate data for the current schema");
					return prev;
				}
				setTables(faked);
				setSelectedTable(faked[0]!.name);
				setDataSource("fake");
				toast.success(
					`Generated fake data for ${faked.length} tables (${faked[0]!.rows.length} rows each)`,
				);
				return nextSeed;
			});
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to generate fake data",
			);
		}
	}, [diagram, setFakeSeed, setTables, setSelectedTable, setDataSource]);

	const handleClearData = useCallback(() => {
		clearAll();
	}, [clearAll]);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(true);
	}, []);

	const handleDragLeave = useCallback(() => {
		setIsDragOver(false);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragOver(false);
			const file = e.dataTransfer.files[0];
			if (file) handleFile(file);
		},
		[handleFile],
	);

	const handleColumnSort = useCallback(
		(col: string) => {
			updateTableViewState(currentTableKey, (prev) => {
				if (prev.sortColumn !== col) {
					return { sortColumn: col, sortDirection: "asc" as const, page: 0 };
				}
				if (prev.sortDirection === "asc") {
					return { sortColumn: col, sortDirection: "desc" as const, page: 0 };
				}
				return { sortColumn: null, sortDirection: null, page: 0 };
			});
		},
		[currentTableKey, updateTableViewState],
	);

	const isAllTables = selectedTable === "__all__";
	const currentTable = isAllTables
		? null
		: tables.find((t) => t.name === selectedTable);

	const columnTypes = useMemo(() => {
		if (!currentTable) return {};
		return inferColumnTypes(currentTable.columns, currentTable.rows);
	}, [currentTable]);

	const stats = useMemo(() => {
		if (!currentTable) return null;
		const numericCols = currentTable.columns.filter(
			(c) => columnTypes[c] === "number",
		);
		const textCols = currentTable.columns.filter(
			(c) => columnTypes[c] === "string",
		);
		const dateCols = currentTable.columns.filter(
			(c) => columnTypes[c] === "date",
		);
		const boolCols = currentTable.columns.filter(
			(c) => columnTypes[c] === "boolean",
		);
		const nullCount = currentTable.rows.reduce((acc, row) => {
			return acc + currentTable.columns.filter((c) => row[c] === null).length;
		}, 0);
		return {
			rows: currentTable.rows.length,
			columns: currentTable.columns.length,
			numericCount: numericCols.length,
			textCount: textCols.length,
			dateCount: dateCols.length,
			boolCount: boolCols.length,
			nullCount,
		};
	}, [currentTable, columnTypes]);

	const filteredRows = useMemo(() => {
		if (!currentTable) return [];
		let rows = currentTable.rows;

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			rows = rows.filter((row) =>
				currentTable.columns.some((col) => {
					const val = row[col];
					return val !== null && String(val).toLowerCase().includes(query);
				}),
			);
		}

		if (sortColumn && sortDirection) {
			const col = sortColumn;
			const dir = sortDirection;
			rows = [...rows].sort((a, b) => {
				const aVal = a[col];
				const bVal = b[col];
				if (aVal === null && bVal === null) return 0;
				if (aVal === null) return 1;
				if (bVal === null) return -1;
				if (typeof aVal === "number" && typeof bVal === "number") {
					return dir === "asc" ? aVal - bVal : bVal - aVal;
				}
				const aStr = String(aVal);
				const bStr = String(bVal);
				return dir === "asc"
					? aStr.localeCompare(bStr)
					: bStr.localeCompare(aStr);
			});
		}

		return rows;
	}, [currentTable, searchQuery, sortColumn, sortDirection]);

	const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
	const pageRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

	const handleExportCSV = useCallback(() => {
		if (!currentTable) return;
		const escapeCSV = (str: string) => {
			if (str.includes(",") || str.includes('"') || str.includes("\n")) {
				return `"${str.replace(/"/g, '""')}"`;
			}
			return str;
		};
		const header = currentTable.columns.map(escapeCSV).join(",");
		const rows = filteredRows.map((row) =>
			currentTable.columns
				.map((col) => {
					const val = row[col];
					if (val === null) return "";
					return escapeCSV(String(val));
				})
				.join(","),
		);
		const csv = [header, ...rows].join("\n");
		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `${currentTable.name}.csv`;
		link.click();
		URL.revokeObjectURL(url);
		toast.success("CSV exported");
	}, [currentTable, filteredRows]);

	const allTablesStats = useMemo(() => {
		if (tables.length === 0) return null;
		const totalRows = tables.reduce((sum, t) => sum + t.rows.length, 0);
		const totalCols = tables.reduce((sum, t) => sum + t.columns.length, 0);
		return { totalRows, totalCols, tableCount: tables.length };
	}, [tables]);

	// Synthetic table for "All tables" chart view
	const overviewTable = useMemo((): ParsedDumpTable | null => {
		if (tables.length === 0) return null;
		return {
			name: "All Tables Overview",
			columns: ["table_name", "row_count", "column_count"],
			rows: tables.map((t) => ({
				table_name: t.name,
				row_count: t.rows.length,
				column_count: t.columns.length,
			})),
		};
	}, [tables]);

	// Chat
	const chatKey = selectedTable ?? "__default__";
	const currentChatMessages = chatHistory[chatKey] ?? [];
	const handleChatMessagesChange = useCallback(
		(
			update:
				| import("./DataExplorerContext").DataChatMessage[]
				| ((
						prev: import("./DataExplorerContext").DataChatMessage[],
				  ) => import("./DataExplorerContext").DataChatMessage[]),
		) => {
			updateChatMessages(chatKey, update);
		},
		[chatKey, updateChatMessages],
	);

	const chartTable = isAllTables ? overviewTable : currentTable;
	const chatTables = isAllTables ? tables : currentTable ? [currentTable] : [];

	const hasDiagram = diagram && diagram.tables.length > 0;

	const modalContent = (
		<>
			<div
				className="fixed inset-0 z-50 bg-gray-950/90 backdrop-blur-sm"
				onClick={onClose}
			/>
			<div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
				<div
					className="animate-scale-in pointer-events-auto flex max-h-[95vh] min-h-[95vh] w-full max-w-[90vw] flex-col rounded-2xl border border-border bg-card shadow-2xl"
					onClick={(e) => e.stopPropagation()}
				>
					{/* Header */}
					<div className="flex items-center justify-between border-b border-border px-6 py-4">
						<div className="flex items-center gap-3">
							<h2 className="text-lg font-bold text-foreground">
								Data Explorer
							</h2>
							{dataSource !== "none" && (
								<span
									className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
										dataSource === "fake"
											? "bg-purple-500/15 text-purple-400"
											: "bg-blue-500/15 text-blue-400"
									}`}
								>
									{dataSource === "fake" ? (
										<>
											<FlaskConical className="h-3 w-3" /> Generated data
										</>
									) : (
										<>
											<Database className="h-3 w-3" /> SQL dump
										</>
									)}
								</span>
							)}
						</div>
						<button
							onClick={onClose}
							className="rounded-lg p-2 hover:bg-accent"
						>
							<X className="h-5 w-5 text-muted-foreground" />
						</button>
					</div>

					{tables.length === 0 ? (
						/* ── Empty state ── */
						<div className="flex flex-col items-center p-12">
							<h3 className="mb-2 text-xl font-bold text-foreground">
								Explore Your Data
							</h3>
							<p className="mb-8 max-w-md text-center text-sm text-muted-foreground">
								Browse data in tables, sort, filter, and generate charts.
							</p>

							<div className="flex w-full max-w-2xl gap-6">
								{/* Upload card */}
								<div
									className={`flex flex-1 flex-col items-center rounded-xl border-2 border-dashed p-6 transition-colors ${
										isDragOver
											? "border-indigo-500 bg-indigo-500/10"
											: "border-border hover:border-border/80"
									}`}
									onDragOver={handleDragOver}
									onDragLeave={handleDragLeave}
									onDrop={handleDrop}
								>
									<Upload className="mb-3 h-8 w-8 text-muted-foreground" />
									<p className="mb-1 text-sm font-semibold text-foreground">
										{isDragOver ? "Drop file here..." : "Upload SQL Dump"}
									</p>
									<p className="mb-4 text-center text-xs text-muted-foreground">
										Drag & drop or browse for a .sql file with INSERT statements
									</p>
									<button
										onClick={() => fileInputRef.current?.click()}
										className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
									>
										Choose File
									</button>
									<input
										ref={fileInputRef}
										type="file"
										accept=".sql,.txt"
										className="hidden"
										onChange={(e) => {
											const file = e.target.files?.[0];
											if (file) handleFile(file);
										}}
									/>
									<p className="mt-3 text-xs text-muted-foreground/60">
										Max 5MB
									</p>
								</div>

								{/* Generate card */}
								{hasDiagram && (
									<div className="flex flex-1 flex-col items-center rounded-xl border border-border bg-accent/30 p-6">
										<FlaskConical className="mb-3 h-8 w-8 text-purple-400" />
										<p className="mb-1 text-sm font-semibold text-foreground">
											Generate Test Data
										</p>
										<p className="mb-4 text-center text-xs text-muted-foreground">
											Create realistic fake data from your{" "}
											{diagram!.tables.length} tables using field names and
											types
										</p>
										<button
											onClick={handleGenerateFakeData}
											className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-500"
										>
											Generate Data
										</button>
										<p className="mt-3 text-xs text-muted-foreground/60">
											30 rows per table
										</p>
									</div>
								)}
							</div>

							<p className="mt-6 max-w-md text-center text-xs text-muted-foreground/60">
								All data is processed entirely in your browser.
							</p>
						</div>
					) : (
						<div className="flex flex-1 overflow-hidden">
							{/* ── Left sidebar: table list ── */}
							<div className="flex w-52 shrink-0 flex-col border-r border-border">
								{/* Sidebar header */}
								<div className="flex items-center justify-between border-b border-border px-3 py-2">
									<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
										Tables ({tables.length})
									</span>
									<div className="flex items-center gap-1">
										{hasDiagram && dataSource === "fake" && (
											<button
												type="button"
												onClick={handleGenerateFakeData}
												className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
												title="Regenerate with new random data"
											>
												<RefreshCw className="h-3.5 w-3.5" />
											</button>
										)}
										<button
											type="button"
											onClick={handleClearData}
											className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-red-400"
											title="Clear data and go back"
										>
											<Trash2 className="h-3.5 w-3.5" />
										</button>
									</div>
								</div>

								{/* Table list */}
								<nav className="flex-1 overflow-y-auto py-1">
									{tables.length > 1 && (
										<button
											type="button"
											onClick={() => setSelectedTable("__all__")}
											className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
												isAllTables
													? "border-r-2 border-indigo-500 bg-indigo-500/10 text-foreground"
													: "text-muted-foreground hover:bg-accent hover:text-foreground"
											}`}
										>
											<Database className="h-3.5 w-3.5 shrink-0" />
											<span className="truncate font-medium">All tables</span>
											<span className="ml-auto shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-mono tabular-nums text-muted-foreground">
												{tables.reduce((s, t) => s + t.rows.length, 0)}
											</span>
										</button>
									)}
									{tables.map((t) => (
										<button
											type="button"
											key={t.name}
											onClick={() => setSelectedTable(t.name)}
											className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
												selectedTable === t.name
													? "border-r-2 border-indigo-500 bg-indigo-500/10 text-foreground"
													: "text-muted-foreground hover:bg-accent hover:text-foreground"
											}`}
											title={`${t.name} — ${t.rows.length} rows, ${t.columns.length} cols`}
										>
											<Table className="h-3.5 w-3.5 shrink-0" />
											<span className="truncate">{t.name}</span>
											<span className="ml-auto shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-mono tabular-nums text-muted-foreground">
												{t.rows.length}
											</span>
										</button>
									))}
								</nav>
							</div>

							{/* ── Right content ── */}
							<div className="flex flex-1 flex-col overflow-hidden">
								{/* Toolbar: view toggle + actions */}
								<div className="flex items-center gap-2 border-b border-border px-4 py-2">
									{/* View toggle */}
									<div className="flex rounded-lg border border-border">
										<button
											type="button"
											onClick={() => setView("table")}
											className={`flex items-center gap-1 rounded-l-lg px-3 py-1.5 text-sm transition-colors ${
												view === "table"
													? "bg-accent text-foreground"
													: "text-muted-foreground hover:text-foreground"
											}`}
										>
											<Table className="h-3.5 w-3.5" /> Table
										</button>
										<button
											type="button"
											onClick={() => setView("chart")}
											className={`flex items-center gap-1 px-3 py-1.5 text-sm transition-colors ${
												view === "chart"
													? "bg-accent text-foreground"
													: "text-muted-foreground hover:text-foreground"
											}`}
										>
											<BarChart3 className="h-3.5 w-3.5" /> Charts
										</button>
										<button
											type="button"
											onClick={() => setView("chat")}
											className={`flex items-center gap-1 rounded-r-lg px-3 py-1.5 text-sm transition-colors ${
												view === "chat"
													? "bg-accent text-foreground"
													: "text-muted-foreground hover:text-foreground"
											}`}
										>
											<MessageSquare className="h-3.5 w-3.5" /> Chat
										</button>
									</div>

									<div className="flex-1" />

									{/* Stats inline */}
									{!isAllTables && stats && (
										<div className="flex items-center gap-2 text-xs text-muted-foreground">
											<span>{stats.rows} rows</span>
											<span className="text-border">&middot;</span>
											<span className="flex items-center gap-1">
												{stats.columns} cols
												{stats.numericCount > 0 && (
													<span className="inline-flex items-center gap-0.5 text-blue-400">
														<Hash className="h-2.5 w-2.5" />
														{stats.numericCount}
													</span>
												)}
												{stats.textCount > 0 && (
													<span className="inline-flex items-center gap-0.5 text-emerald-400">
														<Type className="h-2.5 w-2.5" />
														{stats.textCount}
													</span>
												)}
											</span>
											{searchQuery.trim() && (
												<>
													<span className="text-border">&middot;</span>
													<span className="text-indigo-400">
														{filteredRows.length} matching
													</span>
												</>
											)}
										</div>
									)}
									{isAllTables && allTablesStats && (
										<span className="text-xs text-muted-foreground">
											{allTablesStats.totalRows} total rows &middot;{" "}
											{allTablesStats.totalCols} columns
										</span>
									)}

									<div className="mx-1 h-6 w-px bg-border" />

									<button
										type="button"
										onClick={handleExportCSV}
										className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
										title="Export current table as CSV"
									>
										<Download className="h-3.5 w-3.5" />
										CSV
									</button>
								</div>

								{/* Search bar */}
								{view === "table" && currentTable && !isAllTables && (
									<div className="border-b border-border px-4 py-2">
										<div className="relative">
											<Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
											<input
												type="text"
												value={searchQuery}
												onChange={(e) => {
													updateTableViewState(currentTableKey, {
														searchQuery: e.target.value,
														page: 0,
													});
												}}
												placeholder="Search across all columns..."
												className="w-full rounded-lg border border-border bg-accent py-1.5 pl-8 pr-3 text-sm text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:outline-none"
											/>
										</div>
									</div>
								)}

								{/* Content area */}
								<div className="flex-1 overflow-auto">
									{/* Table view */}
									<div
										style={{
											display: view === "table" ? undefined : "none",
										}}
									>
										{isAllTables ? (
											<div className="overflow-x-auto">
												<table className="w-full text-sm">
													<thead className="sticky top-0 z-10">
														<tr className="border-b border-border bg-accent/80 backdrop-blur-sm">
															<th className="whitespace-nowrap px-4 py-2 text-left font-medium text-foreground">
																Table
															</th>
															<th className="whitespace-nowrap px-4 py-2 text-right font-medium text-foreground">
																Rows
															</th>
															<th className="whitespace-nowrap px-4 py-2 text-right font-medium text-foreground">
																Columns
															</th>
															<th className="whitespace-nowrap px-4 py-2 text-left font-medium text-foreground">
																Column Names
															</th>
														</tr>
													</thead>
													<tbody>
														{tables.map((t) => (
															<tr
																key={t.name}
																onClick={() => setSelectedTable(t.name)}
																className="cursor-pointer border-b border-border/30 transition-colors hover:bg-accent/30"
															>
																<td className="whitespace-nowrap px-4 py-2 font-medium text-foreground">
																	{t.name}
																</td>
																<td className="whitespace-nowrap px-4 py-2 text-right font-mono text-blue-400/80">
																	{t.rows.length}
																</td>
																<td className="whitespace-nowrap px-4 py-2 text-right font-mono text-muted-foreground">
																	{t.columns.length}
																</td>
																<td
																	className="max-w-[400px] truncate px-4 py-2 text-xs text-muted-foreground"
																	title={t.columns.join(", ")}
																>
																	{t.columns.join(", ")}
																</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										) : currentTable ? (
											<div className="overflow-x-auto">
												<table className="w-full text-sm">
													<thead className="sticky top-0 z-10">
														<tr className="border-b border-border bg-accent/80 backdrop-blur-sm">
															{currentTable.columns.map((col) => {
																const colType = columnTypes[col] ?? "string";
																const Icon = TYPE_ICON[colType];
																return (
																	<th
																		key={col}
																		onClick={() => handleColumnSort(col)}
																		className="cursor-pointer select-none whitespace-nowrap px-4 py-2 text-left font-medium text-foreground hover:bg-accent"
																	>
																		<span className="inline-flex items-center gap-1.5">
																			<Icon
																				className={`h-3 w-3 ${TYPE_COLOR[colType]}`}
																			/>
																			{col}
																			{sortColumn === col &&
																				sortDirection === "asc" && (
																					<ChevronUp className="h-3 w-3 text-indigo-400" />
																				)}
																			{sortColumn === col &&
																				sortDirection === "desc" && (
																					<ChevronDown className="h-3 w-3 text-indigo-400" />
																				)}
																		</span>
																	</th>
																);
															})}
														</tr>
													</thead>
													<tbody>
														{pageRows.map((row, i) => (
															<tr
																key={i}
																className="border-b border-border/30 transition-colors hover:bg-accent/30"
															>
																{currentTable.columns.map((col) => {
																	const val = row[col];
																	const colType = columnTypes[col] ?? "string";
																	return (
																		<td
																			key={col}
																			className={`max-w-[240px] truncate whitespace-nowrap px-4 py-1.5 ${
																				val === null
																					? "text-muted-foreground/30 italic"
																					: colType === "number"
																						? "font-mono text-blue-400/80"
																						: colType === "boolean"
																							? "text-purple-400/80"
																							: colType === "date"
																								? "font-mono text-amber-400/70"
																								: "text-muted-foreground"
																			}`}
																			title={
																				val !== null ? String(val) : "NULL"
																			}
																		>
																			{val === null
																				? "NULL"
																				: typeof val === "boolean"
																					? val
																						? "true"
																						: "false"
																					: String(val)}
																		</td>
																	);
																})}
															</tr>
														))}
														{pageRows.length === 0 && (
															<tr>
																<td
																	colSpan={currentTable.columns.length}
																	className="px-4 py-8 text-center text-sm text-muted-foreground"
																>
																	{searchQuery.trim()
																		? "No rows match your search."
																		: "No data available."}
																</td>
															</tr>
														)}
													</tbody>
												</table>
											</div>
										) : null}
									</div>

									{/* Chart view - always rendered to persist config */}
									<div
										style={{
											display: view === "chart" ? undefined : "none",
										}}
									>
										{chartTable && <DataCharts table={chartTable} />}
									</div>

									{/* Chat view - always rendered, per-table history */}
									<div
										style={{
											display: view === "chat" ? undefined : "none",
										}}
										className="h-full"
									>
										{chatTables.length > 0 && (
											<DataChat
												tables={chatTables}
												messages={currentChatMessages}
												onMessagesChange={handleChatMessagesChange}
												chatKey={chatKey}
											/>
										)}
									</div>
								</div>

								{/* Pagination */}
								{view === "table" && !isAllTables && totalPages > 1 && (
									<div className="flex items-center justify-between border-t border-border px-4 py-2">
										<button
											type="button"
											onClick={() =>
												updateTableViewState(currentTableKey, (prev) => ({
													page: Math.max(0, prev.page - 1),
												}))
											}
											disabled={page === 0}
											className="rounded px-3 py-1 text-sm text-muted-foreground hover:bg-accent disabled:opacity-50"
										>
											Previous
										</button>
										<span className="text-xs text-muted-foreground">
											Page {page + 1} of {totalPages}
										</span>
										<button
											type="button"
											onClick={() =>
												updateTableViewState(currentTableKey, (prev) => ({
													page: Math.min(totalPages - 1, prev.page + 1),
												}))
											}
											disabled={page >= totalPages - 1}
											className="rounded px-3 py-1 text-sm text-muted-foreground hover:bg-accent disabled:opacity-50"
										>
											Next
										</button>
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			</div>
		</>
	);

	if (!visible) return null;

	return createPortal(modalContent, document.body);
}
