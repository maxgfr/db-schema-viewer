"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ParsedDumpTable } from "@/lib/dump/dump-parser";
import type { ChartSuggestion } from "@/lib/ai/ai-service";

/* ---------- Shared types ---------- */

export type DataSource = "none" | "upload" | "fake";
export type ChartType = "bar" | "line" | "pie" | "scatter" | "area";
export type Aggregation = "sum" | "avg" | "count" | "min" | "max" | "none";

export interface DataChatMessage {
  role: "user" | "assistant";
  content: string;
}

/* ---------- Per-table state shapes ---------- */

export interface PerTableChartState {
  chartType: ChartType;
  xCol: string;
  yCol: string;
  aggregation: Aggregation;
  aiSuggestions: ChartSuggestion[];
  activeTab: "manual" | "ai";
  customPrompt: string;
}

export type ViewTab = "table" | "chart" | "chat";

export interface PerTableViewState {
  view: ViewTab;
  page: number;
  searchQuery: string;
  sortColumn: string | null;
  sortDirection: "asc" | "desc" | null;
}

/* ---------- Defaults ---------- */

export const DEFAULT_VIEW_STATE: PerTableViewState = {
  view: "table",
  page: 0,
  searchQuery: "",
  sortColumn: null,
  sortDirection: null,
};

const DEFAULT_CHART_STATE: PerTableChartState = {
  chartType: "bar",
  xCol: "",
  yCol: "",
  aggregation: "sum",
  aiSuggestions: [],
  activeTab: "manual",
  customPrompt: "",
};

/* ---------- Context value ---------- */

type PartialOrFn<T> = Partial<T> | ((prev: T) => Partial<T>);

interface DataExplorerContextValue {
  // Core state
  tables: ParsedDumpTable[];
  setTables: Dispatch<SetStateAction<ParsedDumpTable[]>>;
  selectedTable: string | "__all__" | null;
  setSelectedTable: Dispatch<SetStateAction<string | "__all__" | null>>;
  dataSource: DataSource;
  setDataSource: Dispatch<SetStateAction<DataSource>>;
  fakeSeed: number;
  setFakeSeed: Dispatch<SetStateAction<number>>;

  // Per-table chart state
  chartStates: Record<string, PerTableChartState>;
  updateChartState: (tableName: string, update: PartialOrFn<PerTableChartState>) => void;

  // Per-table view state
  tableViewStates: Record<string, PerTableViewState>;
  updateTableViewState: (tableName: string, update: PartialOrFn<PerTableViewState>) => void;

  // Chat history (keyed by table name or "__default__")
  chatHistory: Record<string, DataChatMessage[]>;
  updateChatMessages: (
    key: string,
    update: DataChatMessage[] | ((prev: DataChatMessage[]) => DataChatMessage[]),
  ) => void;

  // Bulk actions
  clearAll: () => void;
}

/* ---------- Context + hook ---------- */

const DataExplorerContext = createContext<DataExplorerContextValue | null>(null);

export function useDataExplorer() {
  const ctx = useContext(DataExplorerContext);
  if (!ctx) throw new Error("useDataExplorer must be used within DataExplorerProvider");
  return ctx;
}

/* ---------- Provider ---------- */

export function DataExplorerProvider({ children }: { children: ReactNode }) {
  const [tables, setTables] = useState<ParsedDumpTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | "__all__" | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>("none");
  const [fakeSeed, setFakeSeed] = useState(42);

  const [chartStates, setChartStates] = useState<Record<string, PerTableChartState>>({});
  const [tableViewStates, setTableViewStates] = useState<Record<string, PerTableViewState>>({});
  const [chatHistory, setChatHistory] = useState<Record<string, DataChatMessage[]>>({});

  const updateChartState = useCallback(
    (tableName: string, update: PartialOrFn<PerTableChartState>) => {
      setChartStates((prev) => {
        const current = prev[tableName] ?? DEFAULT_CHART_STATE;
        const updates = typeof update === "function" ? update(current) : update;
        return { ...prev, [tableName]: { ...current, ...updates } };
      });
    },
    [],
  );

  const updateTableViewState = useCallback(
    (tableName: string, update: PartialOrFn<PerTableViewState>) => {
      setTableViewStates((prev) => {
        const current = prev[tableName] ?? DEFAULT_VIEW_STATE;
        const updates = typeof update === "function" ? update(current) : update;
        return { ...prev, [tableName]: { ...current, ...updates } };
      });
    },
    [],
  );

  const updateChatMessages = useCallback(
    (
      key: string,
      update: DataChatMessage[] | ((prev: DataChatMessage[]) => DataChatMessage[]),
    ) => {
      setChatHistory((prev) => {
        const current = prev[key] ?? [];
        const newMsgs = typeof update === "function" ? update(current) : update;
        return { ...prev, [key]: newMsgs };
      });
    },
    [],
  );

  const clearAll = useCallback(() => {
    setTables([]);
    setSelectedTable(null);
    setDataSource("none");
    setChartStates({});
    setTableViewStates({});
    setChatHistory({});
  }, []);

  const value = useMemo(
    (): DataExplorerContextValue => ({
      tables,
      setTables,
      selectedTable,
      setSelectedTable,
      dataSource,
      setDataSource,
      fakeSeed,
      setFakeSeed,
      chartStates,
      updateChartState,
      tableViewStates,
      updateTableViewState,
      chatHistory,
      updateChatMessages,
      clearAll,
    }),
    [
      tables,
      selectedTable,
      dataSource,
      fakeSeed,
      chartStates,
      tableViewStates,
      chatHistory,
      updateChartState,
      updateTableViewState,
      updateChatMessages,
      clearAll,
    ],
  );

  return (
    <DataExplorerContext.Provider value={value}>
      {children}
    </DataExplorerContext.Provider>
  );
}
