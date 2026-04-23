"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/browser";

type AccountRow = {
  id: string;
  name: string;
  opening_balance: number;
  color?: string | null;
  archived: boolean;
};

type CategoryRow = {
  id: string;
  name: string;
  color: string;
  kind: "expense" | "income";
  archived: boolean;
};

type BudgetRow = {
  id: string;
  month: string; // YYYY-MM
  category_id: string;
  amount: number;
};

type CategoryMonthSettingRow = {
  id: string;
  month: string; // YYYY-MM
  category_id: string;
  hidden: boolean;
};

type BillMonthlyRow = {
  id: string;
  month: string;
  template_id: string | null;
  recurrence_id: string | null;
  name: string;
  account_id: string | null;
  due_date: string | null; // yyyy-mm-dd
  amount: number;
  paid: boolean;
};

type TransactionRow = {
  id: string;
  type: "expense" | "income" | "transfer";
  date: string; // yyyy-mm-dd
  amount: number;
  name: string;
  note: string | null;
  account_id: string | null;
  category_id: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
};

const DAYS_LEFT_FALLBACK = 9;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Categories page / donuts / badges: fixed order + muted palette (left→right from design reference). */
const EXPENSE_CATEGORY_ORDER = [
  "Bills & Utilities",
  "Food & Dining",
  "Housing",
  "Shopping",
  "Entertainment",
  "Transportation",
  "Savings",
  "Other",
] as const;

const EXPENSE_CATEGORY_COLORS: Record<(typeof EXPENSE_CATEGORY_ORDER)[number], string> = {
  "Bills & Utilities": "#4A2E2E",
  "Food & Dining": "#3E4A2E",
  Housing: "#2E374A",
  Shopping: "#4A432E",
  Entertainment: "#4A2E3F",
  Transportation: "#3D3D3D",
  Savings: "#2E414A",
  Other: "#362E4A",
};

/** Monthly budget defaults (THB) from reference. */
const DEFAULT_BUDGETS_THB: Record<(typeof EXPENSE_CATEGORY_ORDER)[number], number> = {
  "Bills & Utilities": 6600,
  "Food & Dining": 7000,
  Housing: 4000,
  Shopping: 5000,
  Entertainment: 2000,
  Transportation: 800,
  Savings: 10000,
  Other: 3600,
};

const CATEGORY_ICONS: Record<(typeof EXPENSE_CATEGORY_ORDER)[number], string> = {
  "Bills & Utilities": "receipt",
  "Food & Dining": "food",
  Housing: "home",
  Shopping: "cart",
  Entertainment: "music",
  Transportation: "car",
  Savings: "wallet",
  Other: "dots",
};

function expenseCategorySortKey(name: string): number {
  const i = (EXPENSE_CATEGORY_ORDER as readonly string[]).indexOf(name);
  return i === -1 ? 1000 : i;
}

function sortExpenseCategoriesByDisplayOrder<T extends { name: string }>(cats: T[]): T[] {
  return [...cats].sort((a, b) => {
    const d = expenseCategorySortKey(a.name) - expenseCategorySortKey(b.name);
    if (d !== 0) return d;
    return a.name.localeCompare(b.name);
  });
}

function resolveExpenseCategoryDisplayColor(category: Pick<CategoryRow, "name" | "color">): string {
  return (EXPENSE_CATEGORY_COLORS as Record<string, string>)[category.name] ?? category.color;
}

const CategoryIcon = ({ name, className }: { name: string; className?: string }) => {
  const key = (CATEGORY_ICONS as Record<string, string>)[name] ?? "dots";
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const paths = (() => {
    switch (key) {
      case "receipt":
        return (
          <>
            <path {...common} d="M7 4h10v16l-2-1-2 1-2-1-2 1-2-1-2 1V4z" />
            <path {...common} d="M10 8h4" />
            <path {...common} d="M10 12h4" />
          </>
        );
      case "food":
        return (
          <>
            <path {...common} d="M8 4v6" />
            <path {...common} d="M10 4v6" />
            <path {...common} d="M12 4v6" />
            <path {...common} d="M10 10v10" />
            <path {...common} d="M16 4c2 3 2 6 0 9v7" />
          </>
        );
      case "home":
        return (
          <>
            <path {...common} d="M4 11l8-7 8 7" />
            <path {...common} d="M6.5 10.5V20h11V10.5" />
          </>
        );
      case "car":
        return (
          <>
            <path {...common} d="M6 15l1.5-5h9L18 15" />
            <path {...common} d="M6 15h12v4H6z" />
            <path {...common} d="M8 19h0" />
            <path {...common} d="M16 19h0" />
          </>
        );
      case "cart":
        return (
          <>
            <path {...common} d="M6 7h12l-1.2 6H8.2L7 4H4" />
            <path {...common} d="M9 19h0" />
            <path {...common} d="M16 19h0" />
          </>
        );
      case "music":
        return (
          <>
            <path {...common} d="M10 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
            <path {...common} d="M10 14V6l8-2v8" />
            <path {...common} d="M18 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
          </>
        );
      case "wallet":
        return (
          <>
            <path {...common} d="M5 8h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" />
            <path {...common} d="M19 12h2v4h-2a2 2 0 0 1 0-4z" />
          </>
        );
      default:
        return (
          <>
            <path {...common} d="M8 12h0" />
            <path {...common} d="M12 12h0" />
            <path {...common} d="M16 12h0" />
          </>
        );
    }
  })();

  return (
    <span className={className ?? `inline-flex h-4 w-4 items-center justify-center ${headingColor}`}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
        {paths}
      </svg>
    </span>
  );
};

// Data is loaded from Supabase (Milestone 2+). The UI used to have hardcoded mock arrays.

const pageOrder = ["dashboard", "accounts", "bills", "categories", "expenses", "income"] as const;
type ActivePage = (typeof pageOrder)[number];

const fmt = (n: number) =>
  `฿${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const frameBorder = "border-[#2a2a2a]";
const panelClass = `overflow-hidden rounded border ${frameBorder} bg-black`;
const headingColor = "text-[#898989]";
const itemNameColor = "text-[#575757]";
// Table header row: no bottom border (avoids double-line vs first data row).
const tableHeadRowClass = `text-xs font-semibold uppercase tracking-[0.5px] ${headingColor}`;

// Section header: simpler (no divider lines), smaller + bold.
const panelHeaderClass =
  `flex items-center justify-between px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.55px] ${headingColor}`;
const dashPanelHeaderClass =
  `relative z-20 flex items-center justify-between bg-white/[0.02] px-2.5 py-2 text-sm font-semibold tracking-[0.2px] ${headingColor}`;

const summaryCardClass = `rounded border ${frameBorder} bg-[#141414] px-3 py-2.5`;

export default function Home() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [hoveredCategory, setHoveredCategory] = useState<{
    categoryId: string;
    x: number;
    y: number;
  } | null>(null);
  const [hoveredExpenseDonut, setHoveredExpenseDonut] = useState<{
    label: string;
    amount: number;
    color: string;
    x: number;
    y: number;
  } | null>(null);

  const [budgetTotalOverrideOpen, setBudgetTotalOverrideOpen] = useState(false);
  const [budgetTotalOverrideRaw, setBudgetTotalOverrideRaw] = useState<string>("");

  const [budgetEditCategoryId, setBudgetEditCategoryId] = useState<string | null>(null);
  const [budgetEditRaw, setBudgetEditRaw] = useState<string>("");
  const [budgetEditSaving, setBudgetEditSaving] = useState(false);

  const [goalOpen, setGoalOpen] = useState(false);
  const [goalEditOpen, setGoalEditOpen] = useState(false);
  const [goalEditId, setGoalEditId] = useState<string | null>(null);
  const [goalEditDraft, setGoalEditDraft] = useState<{ name: string; goal_amount: string; balance_amount: string; color: string }>({
    name: "",
    goal_amount: "",
    balance_amount: "",
    color: "#103544",
  });
  const [goals, setGoals] = useState<Array<{ id: string; name: string; goal_amount: string; balance_amount: string; color?: string }>>([]);
  const [goalAddDraft, setGoalAddDraft] = useState<{ name: string; goal_amount: string; balance_amount: string; color: string }>({
    name: "",
    goal_amount: "",
    balance_amount: "",
    color: "#103544",
  });

  // Persist savings goals locally (no DB table yet)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawList = window.localStorage.getItem("mt:savingsGoals");
      if (rawList) {
        const parsed = JSON.parse(rawList) as Array<Partial<(typeof goals)[number]>>;
        const normalized =
          Array.isArray(parsed) && parsed.length > 0
            ? parsed
                .map((g, idx) => {
                  const id = typeof g.id === "string" && g.id ? g.id : `goal-${idx}`;
                  const name = typeof g.name === "string" ? g.name : "";
                  const goal_amount = typeof g.goal_amount === "string" ? g.goal_amount : "";
                  const balance_amount = typeof g.balance_amount === "string" ? g.balance_amount : "";
                  const color = typeof (g as any).color === "string" ? String((g as any).color) : "#103544";
                  if (!name.trim()) return null;
                  return { id, name, goal_amount, balance_amount, color };
                })
                .filter(Boolean)
            : null;
        if (normalized && normalized.length > 0) setGoals(normalized as any);
        return;
      }

      // Back-compat: old single goal key
      const rawSingle = window.localStorage.getItem("mt:savingsGoal");
      if (!rawSingle) return;
      const parsedSingle = JSON.parse(rawSingle) as Partial<{ name: string; goal_amount: string; balance_amount: string }>;
      const name = typeof parsedSingle.name === "string" ? parsedSingle.name : "";
      const goal_amount = typeof parsedSingle.goal_amount === "string" ? parsedSingle.goal_amount : "";
      const balance_amount = typeof parsedSingle.balance_amount === "string" ? parsedSingle.balance_amount : "";
      if (name.trim()) setGoals([{ id: "legacy-0", name, goal_amount, balance_amount, color: "#103544" }]);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("mt:savingsGoals", JSON.stringify(goals));
    } catch {
      // ignore
    }
  }, [goals]);

  const deleteGoal = (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    setGoalEditOpen(false);
    setGoalEditId((cur) => (cur === id ? null : cur));
  };

  const openGoalEdit = (g: (typeof goals)[number]) => {
    setAuthError(null);
    setGoalEditId(g.id);
    setGoalEditDraft({ name: g.name, goal_amount: g.goal_amount, balance_amount: g.balance_amount, color: g.color ?? "#103544" });
    setGoalEditOpen(true);
  };

  const saveGoalEdit = () => {
    if (!goalEditId) return;
    const name = goalEditDraft.name.trim();
    if (!name) {
      setAuthError("Please enter a goal name");
      return;
    }
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalEditId
          ? { ...g, name, goal_amount: goalEditDraft.goal_amount.trim(), balance_amount: goalEditDraft.balance_amount.trim(), color: goalEditDraft.color }
          : g,
      ),
    );
    setGoalEditOpen(false);
  };

  const [activePage, setActivePage] = useState<ActivePage>("dashboard");
  const [monthIndex, setMonthIndex] = useState(3);
  const [year, setYear] = useState(2026);
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const [monthLoading, setMonthLoading] = useState(false);

  const clampDueDateForMonth = (mKey: string, dueDay: number) => {
    const yyyy = Number(mKey.slice(0, 4));
    const mm = Number(mKey.slice(5, 7));
    const daysInMonth = new Date(yyyy, mm, 0).getDate();
    const d = Math.max(1, Math.min(daysInMonth, dueDay));
    return `${mKey}-${String(d).padStart(2, "0")}`;
  };

  const addMonthsToKey = (mKey: string, deltaMonths: number) => {
    const yyyy = Number(mKey.slice(0, 4));
    const mm = Number(mKey.slice(5, 7));
    const dt = new Date(yyyy, mm - 1 + deltaMonths, 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
  };

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [categoryMonthSettings, setCategoryMonthSettings] = useState<CategoryMonthSettingRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [billsMonthly, setBillsMonthly] = useState<BillMonthlyRow[]>([]);

  const monthDefaultDate = `${monthKey}-01`;

  const formatLongDate = (iso: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd) || mm < 1 || mm > 12) return iso;
    return `${MONTHS[mm - 1]} ${dd}, ${yyyy}`;
  };

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseCalendarOpen, setExpenseCalendarOpen] = useState(false);
  const [expenseEditingId, setExpenseEditingId] = useState<string | null>(null);
  const [expenseDraft, setExpenseDraft] = useState<{
    date: string;
    amount: string;
    name: string;
    note: string;
    account_id: string;
    category_id: string;
  }>({
    date: monthDefaultDate,
    amount: "",
    name: "",
    note: "",
    account_id: "",
    category_id: "",
  });

  useEffect(() => {
    if (!expenseOpen) {
      setExpenseDraft((d) => ({ ...d, date: monthDefaultDate }));
    }
  }, [expenseOpen, monthDefaultDate]);

  const openExpense = () => {
    setAuthError(null);
    setExpenseEditingId(null);
    setExpenseDraft({
      date: monthDefaultDate,
      amount: "",
      name: "",
      note: "",
      account_id: accounts[0]?.id ?? "",
      category_id: "",
    });
    setExpenseCalendarOpen(false);
    setExpenseOpen(true);
  };

  const openEditExpense = (tx: TransactionRow) => {
    if (tx.type !== "expense") return;
    setAuthError(null);
    setExpenseEditingId(tx.id);
    setExpenseDraft({
      date: tx.date,
      amount: String(tx.amount),
      name: tx.name,
      note: tx.note ?? "",
      account_id: tx.account_id ?? "",
      category_id: tx.category_id ?? "",
    });
    setExpenseCalendarOpen(false);
    setExpenseOpen(true);
  };

  const saveExpense = async () => {
    if (!session?.user?.id) return;
    if (!supabase) return;

    setAuthError(null);
    setExpenseSaving(true);
    try {
      const amount = Number.parseFloat(expenseDraft.amount.replace(/[฿,]/g, ""));
      if (!expenseDraft.account_id) throw new Error("Please select an account");
      if (!expenseDraft.name.trim()) throw new Error("Please enter a name");
      if (!expenseDraft.date) throw new Error("Please select a date");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than 0");

      if (!expenseEditingId) {
        const payload = {
          user_id: session.user.id,
          type: "expense" as const,
          date: expenseDraft.date,
          amount,
          name: expenseDraft.name.trim(),
          note: expenseDraft.note.trim() ? expenseDraft.note.trim() : null,
          account_id: expenseDraft.account_id,
          category_id: expenseDraft.category_id ? expenseDraft.category_id : null,
          from_account_id: null,
          to_account_id: null,
        };

        const { data, error } = await supabase.from("transactions").insert(payload).select("*").single();
        if (error) throw error;
        setTransactions((prev) => [...prev, data as TransactionRow]);
      } else {
        const payload = {
          date: expenseDraft.date,
          amount,
          name: expenseDraft.name.trim(),
          note: expenseDraft.note.trim() ? expenseDraft.note.trim() : null,
          account_id: expenseDraft.account_id,
          category_id: expenseDraft.category_id ? expenseDraft.category_id : null,
        };

        const { data, error } = await supabase
          .from("transactions")
          .update(payload)
          .eq("id", expenseEditingId)
          .eq("user_id", session.user.id)
          .select("*")
          .single();
        if (error) throw error;
        setTransactions((prev) => prev.map((t) => (t.id === expenseEditingId ? (data as TransactionRow) : t)));
      }

      setExpenseOpen(false);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to save expense");
    } finally {
      setExpenseSaving(false);
    }
  };

  const deleteExpense = async () => {
    if (!expenseEditingId) return;
    if (!session?.user?.id) return;
    if (!supabase) return;

    setAuthError(null);
    setExpenseSaving(true);
    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", expenseEditingId)
        .eq("user_id", session.user.id);
      if (error) throw error;

      setTransactions((prev) => prev.filter((t) => t.id !== expenseEditingId));
      setExpenseOpen(false);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to delete expense");
    } finally {
      setExpenseSaving(false);
    }
  };

  const [incomeOpen, setIncomeOpen] = useState(false);
  const [incomeSaving, setIncomeSaving] = useState(false);
  const [incomeCalendarOpen, setIncomeCalendarOpen] = useState(false);
  const [incomeEditingId, setIncomeEditingId] = useState<string | null>(null);
  const [incomeDeleteConfirmOpen, setIncomeDeleteConfirmOpen] = useState(false);
  const [incomeDraft, setIncomeDraft] = useState<{
    date: string;
    amount: string;
    name: string;
    note: string;
    account_id: string;
  }>({
    date: monthDefaultDate,
    amount: "",
    name: "",
    note: "",
    account_id: "",
  });

  useEffect(() => {
    if (!incomeOpen) {
      setIncomeDraft((d) => ({ ...d, date: monthDefaultDate }));
    }
  }, [incomeOpen, monthDefaultDate]);

  const openIncome = () => {
    setAuthError(null);
    setIncomeEditingId(null);
    setIncomeDeleteConfirmOpen(false);
    setIncomeDraft({
      date: monthDefaultDate,
      amount: "",
      name: "",
      note: "",
      account_id: accounts[0]?.id ?? "",
    });
    setIncomeCalendarOpen(false);
    setIncomeOpen(true);
  };

  const openEditIncome = (tx: TransactionRow) => {
    if (tx.type !== "income") return;
    setAuthError(null);
    setIncomeEditingId(tx.id);
    setIncomeDeleteConfirmOpen(false);
    setIncomeDraft({
      date: tx.date,
      amount: String(tx.amount),
      name: tx.name,
      note: tx.note ?? "",
      account_id: tx.account_id ?? "",
    });
    setIncomeCalendarOpen(false);
    setIncomeOpen(true);
  };

  const saveIncome = async () => {
    if (!session?.user?.id) return;
    if (!supabase) return;

    setAuthError(null);
    setIncomeSaving(true);
    try {
      const amount = Number.parseFloat(incomeDraft.amount.replace(/[฿,]/g, ""));
      if (!incomeDraft.account_id) throw new Error("Please select an account");
      if (!incomeDraft.name.trim()) throw new Error("Please enter a name");
      if (!incomeDraft.date) throw new Error("Please select a date");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than 0");

      if (!incomeEditingId) {
        const payload = {
          user_id: session.user.id,
          type: "income" as const,
          date: incomeDraft.date,
          amount,
          name: incomeDraft.name.trim(),
          note: incomeDraft.note.trim() ? incomeDraft.note.trim() : null,
          account_id: incomeDraft.account_id,
          category_id: null,
          from_account_id: null,
          to_account_id: null,
        };

        const { data, error } = await supabase.from("transactions").insert(payload).select("*").single();
        if (error) throw error;
        setTransactions((prev) => [...prev, data as TransactionRow]);
      } else {
        const payload = {
          date: incomeDraft.date,
          amount,
          name: incomeDraft.name.trim(),
          note: incomeDraft.note.trim() ? incomeDraft.note.trim() : null,
          account_id: incomeDraft.account_id,
          category_id: null,
        };

        const { data, error } = await supabase
          .from("transactions")
          .update(payload)
          .eq("id", incomeEditingId)
          .eq("user_id", session.user.id)
          .select("*")
          .single();
        if (error) throw error;
        setTransactions((prev) => prev.map((t) => (t.id === incomeEditingId ? (data as TransactionRow) : t)));
      }

      setIncomeOpen(false);
      setIncomeDeleteConfirmOpen(false);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to save income");
    } finally {
      setIncomeSaving(false);
    }
  };

  const deleteIncome = async () => {
    if (!incomeEditingId) return;
    if (!session?.user?.id) return;
    if (!supabase) return;

    setAuthError(null);
    setIncomeSaving(true);
    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", incomeEditingId)
        .eq("user_id", session.user.id);
      if (error) throw error;

      setTransactions((prev) => prev.filter((t) => t.id !== incomeEditingId));
      setIncomeOpen(false);
      setIncomeDeleteConfirmOpen(false);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to delete income");
    } finally {
      setIncomeSaving(false);
    }
  };

  const closeIncomeModal = () => {
    setIncomeOpen(false);
    setIncomeDeleteConfirmOpen(false);
    setIncomeCalendarOpen(false);
  };

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferCalendarOpen, setTransferCalendarOpen] = useState(false);
  const [transferEditingId, setTransferEditingId] = useState<string | null>(null);
  const [transferDraft, setTransferDraft] = useState<{
    date: string;
    amount: string;
    name: string;
    note: string;
    from_account_id: string;
    to_account_id: string;
  }>({
    date: monthDefaultDate,
    amount: "",
    name: "",
    note: "",
    from_account_id: "",
    to_account_id: "",
  });

  useEffect(() => {
    if (!transferOpen) {
      setTransferDraft((d) => ({ ...d, date: monthDefaultDate }));
    }
  }, [transferOpen, monthDefaultDate]);

  const openTransfer = () => {
    setAuthError(null);
    setTransferEditingId(null);
    const first = orderedAccounts[0]?.id ?? accounts[0]?.id ?? "";
    const second = orderedAccounts[1]?.id ?? orderedAccounts[0]?.id ?? accounts[0]?.id ?? "";
    setTransferDraft({
      date: monthDefaultDate,
      amount: "",
      name: "",
      note: "",
      from_account_id: first,
      to_account_id: second === first ? "" : second,
    });
    setTransferCalendarOpen(false);
    setTransferOpen(true);
  };

  const openEditTransfer = (tx: TransactionRow) => {
    if (tx.type !== "transfer") return;
    setAuthError(null);
    setTransferEditingId(tx.id);
    setTransferDraft({
      date: tx.date,
      amount: String(tx.amount),
      name: tx.name,
      note: tx.note ?? "",
      from_account_id: tx.from_account_id ?? "",
      to_account_id: tx.to_account_id ?? "",
    });
    setTransferCalendarOpen(false);
    setTransferOpen(true);
  };

  const saveTransfer = async () => {
    if (!session?.user?.id) return;
    if (!supabase) return;

    setAuthError(null);
    setTransferSaving(true);
    try {
      const amount = Number.parseFloat(transferDraft.amount.replace(/[฿,]/g, ""));
      if (!transferDraft.from_account_id) throw new Error("Please select a from account");
      if (!transferDraft.to_account_id) throw new Error("Please select a to account");
      if (transferDraft.from_account_id === transferDraft.to_account_id) throw new Error("From and To must be different");
      if (!transferDraft.name.trim()) throw new Error("Please enter a name");
      if (!transferDraft.date) throw new Error("Please select a date");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than 0");

      if (!transferEditingId) {
        const payload = {
          user_id: session.user.id,
          type: "transfer" as const,
          date: transferDraft.date,
          amount,
          name: transferDraft.name.trim(),
          note: transferDraft.note.trim() ? transferDraft.note.trim() : null,
          account_id: null,
          category_id: null,
          from_account_id: transferDraft.from_account_id,
          to_account_id: transferDraft.to_account_id,
        };
        const { data, error } = await supabase.from("transactions").insert(payload).select("*").single();
        if (error) throw error;
        setTransactions((prev) => [...prev, data as TransactionRow]);
      } else {
        const payload = {
          date: transferDraft.date,
          amount,
          name: transferDraft.name.trim(),
          note: transferDraft.note.trim() ? transferDraft.note.trim() : null,
          from_account_id: transferDraft.from_account_id,
          to_account_id: transferDraft.to_account_id,
          account_id: null,
          category_id: null,
        };
        const { data, error } = await supabase
          .from("transactions")
          .update(payload)
          .eq("id", transferEditingId)
          .eq("user_id", session.user.id)
          .select("*")
          .single();
        if (error) throw error;
        setTransactions((prev) => prev.map((t) => (t.id === transferEditingId ? (data as TransactionRow) : t)));
      }

      setTransferOpen(false);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to save transfer");
    } finally {
      setTransferSaving(false);
    }
  };

  const deleteTransfer = async () => {
    if (!transferEditingId) return;
    if (!session?.user?.id) return;
    if (!supabase) return;

    setAuthError(null);
    setTransferSaving(true);
    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transferEditingId)
        .eq("user_id", session.user.id);
      if (error) throw error;

      setTransactions((prev) => prev.filter((t) => t.id !== transferEditingId));
      setTransferOpen(false);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to delete transfer");
    } finally {
      setTransferSaving(false);
    }
  };

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<{ name: string; monthly_budget: string; color: string }>({
    name: "",
    monthly_budget: "",
    color: "#103544",
  });
  const [categoryAddScope, setCategoryAddScope] = useState<"this_month" | "all_future">("all_future");
  const [categoryBadgeMode, setCategoryBadgeMode] = useState<"preset" | "custom">("preset");
  const presetBadges = useMemo(
    () =>
      EXPENSE_CATEGORY_ORDER.map((name) => ({
        name,
        color: EXPENSE_CATEGORY_COLORS[name],
      })),
    [],
  );
  const [categoryEditOpen, setCategoryEditOpen] = useState(false);
  const [categoryEditSaving, setCategoryEditSaving] = useState(false);
  const [categoryEditId, setCategoryEditId] = useState<string | null>(null);
  const [categoryEditName, setCategoryEditName] = useState("");
  const [categoryEditBudgetRaw, setCategoryEditBudgetRaw] = useState("");
  const [categoryApplyConfirmOpen, setCategoryApplyConfirmOpen] = useState(false);
  const [categoryDeleteConfirmOpen, setCategoryDeleteConfirmOpen] = useState(false);
  const [categoryConfirmBusy, setCategoryConfirmBusy] = useState(false);

  const setCategoryHiddenForMonth = async ({ categoryId, mKey, hidden }: { categoryId: string; mKey: string; hidden: boolean }) => {
    if (!session?.user?.id) return;
    if (!supabase) return;
    const payload = { user_id: session.user.id, month: mKey, category_id: categoryId, hidden };
    const { data, error } = await supabase
      .from("category_month_settings")
      .upsert(payload as any, { onConflict: "user_id,month,category_id" })
      .select("id,month,category_id,hidden")
      .single();
    if (error) throw error;
    setCategoryMonthSettings((prev) => {
      const row = data as CategoryMonthSettingRow;
      const idx = prev.findIndex((r) => r.month === row.month && r.category_id === row.category_id);
      if (idx === -1) return [...prev, row];
      return prev.map((r, i) => (i === idx ? row : r));
    });
  };

  const ensureExpenseCategoryExists = async ({ name, color }: { name: string; color: string }) => {
    if (!session?.user?.id) return null;
    if (!supabase) return null;
    // Try to find existing category (including archived)
    const existing = await supabase
      .from("categories")
      .select("id,name,color,kind,archived")
      .eq("user_id", session.user.id)
      .eq("kind", "expense")
      .eq("name", name)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      if (existing.data.archived) {
        const revived = await supabase
          .from("categories")
          .update({ archived: false, color })
          .eq("id", existing.data.id)
          .eq("user_id", session.user.id)
          .select("id,name,color,kind,archived")
          .single();
        if (revived.error) throw revived.error;
        const row = revived.data as CategoryRow;
        setCategories((prev) => {
          const idx = prev.findIndex((c) => c.id === row.id);
          if (idx === -1) return [...prev, row];
          return prev.map((c, i) => (i === idx ? row : c));
        });
        return row;
      }
      // If user picks a new color via +Category, keep it in sync (helps avoid pie chart color collisions).
      if ((existing.data as any).color !== color) {
        const updated = await supabase
          .from("categories")
          .update({ color })
          .eq("id", existing.data.id)
          .eq("user_id", session.user.id)
          .select("id,name,color,kind,archived")
          .single();
        if (updated.error) throw updated.error;
        const row = updated.data as CategoryRow;
        setCategories((prev) => prev.map((c) => (c.id === row.id ? row : c)));
        return row;
      }
      return existing.data as CategoryRow;
    }

    const payload = { user_id: session.user.id, name, color, kind: "expense" as const, archived: false };
    const created = await supabase.from("categories").insert(payload).select("id,name,color,kind,archived").single();
    if (created.error) throw created.error;
    const row = created.data as CategoryRow;
    setCategories((prev) => [...prev, row]);
    return row;
  };

  const openCategory = () => {
    setAuthError(null);
    setCategoryDraft({ name: "", monthly_budget: "", color: "#103544" });
    setCategoryAddScope("all_future");
    setCategoryBadgeMode("preset");
    setCategoryOpen(true);
  };

  const saveCategory = async () => {
    if (!session?.user?.id) return;
    if (!supabase) return;
    setAuthError(null);
    setCategorySaving(true);
    try {
      if (!categoryDraft.name.trim()) throw new Error("Please enter a category name");
      const budgetRaw = categoryDraft.monthly_budget.trim();
      const budgetAmount = budgetRaw ? Number.parseFloat(budgetRaw.replace(/[฿,]/g, "")) : 0;
      if (!Number.isFinite(budgetAmount) || budgetAmount < 0) throw new Error("Monthly budget must be 0 or more");

      const categoryName = categoryDraft.name.trim();
      const color = categoryDraft.color?.trim() ? categoryDraft.color.trim() : "#103544";

      const cat = await ensureExpenseCategoryExists({ name: categoryName, color });
      if (!cat) throw new Error("Failed to create category");

      // If user previously "deleted this month", make sure it shows again when adding.
      await setCategoryHiddenForMonth({ categoryId: cat.id, mKey: monthKey, hidden: false });

      // Scope behavior
      const months: string[] = [];
      for (let i = 1; i <= 24; i++) months.push(addMonthsToKey(monthKey, i));
      if (months.length) {
        if (categoryAddScope === "this_month") {
          // Hide in future months
          const rows = months.map((m) => ({ user_id: session.user.id, month: m, category_id: cat.id, hidden: true }));
          const { error } = await supabase.from("category_month_settings").upsert(rows as any, { onConflict: "user_id,month,category_id" });
          if (error) throw error;
        } else {
          // Ensure visible in future months (clear any previous hidden flags)
          const rows = months.map((m) => ({ user_id: session.user.id, month: m, category_id: cat.id, hidden: false }));
          const { error } = await supabase.from("category_month_settings").upsert(rows as any, { onConflict: "user_id,month,category_id" });
          if (error) throw error;
        }
      }

      // create/update budget for this month
      const budgetPayload = {
        user_id: session.user.id,
        month: monthKey,
        category_id: cat.id,
        amount: budgetAmount,
      };
      const { data: bData, error: bErr } = await supabase
        .from("budgets")
        .upsert(budgetPayload, { onConflict: "user_id,month,category_id" })
        .select("id,month,category_id,amount")
        .single();
      if (bErr) throw bErr;
      setBudgets((prev) => {
        const row = bData as BudgetRow;
        const idx = prev.findIndex((b) => b.month === monthKey && b.category_id === row.category_id);
        if (idx === -1) return [...prev, row];
        return prev.map((b, i) => (i === idx ? row : b));
      });

      setCategoryOpen(false);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to save category");
    } finally {
      setCategorySaving(false);
    }
  };

  const openCategoryEdit = (cat: CategoryRow) => {
    setAuthError(null);
    setCategoryEditId(cat.id);
    setCategoryEditName(cat.name);
    const b = budgets.find((bb) => bb.month === monthKey && bb.category_id === cat.id);
    setCategoryEditBudgetRaw(b ? String(b.amount) : "0");
    setCategoryEditOpen(true);
  };

  const saveCategoryEdit = async () => {
    // confirm modal (this month only vs all future) will call the actual save.
    setCategoryApplyConfirmOpen(true);
  };

  const saveCategoryEditWithConfirm = async ({ applyToFuture }: { applyToFuture: boolean }) => {
      if (!session?.user?.id) return;
    if (!supabase) return;
    if (!categoryEditId) return;
    setAuthError(null);
    setCategoryEditSaving(true);
    try {
      const nextName = categoryEditName.trim();
      if (!nextName) throw new Error("Name cannot be empty");
      const budgetRaw = categoryEditBudgetRaw.trim();
      const budgetAmount = budgetRaw ? Number.parseFloat(budgetRaw.replace(/[฿,]/g, "")) : 0;
      if (!Number.isFinite(budgetAmount) || budgetAmount < 0) throw new Error("Monthly budget must be 0 or more");

      const budgetPayload = {
        user_id: session.user.id,
        month: monthKey,
        category_id: categoryEditId,
        amount: budgetAmount,
      };
      const { data: bData, error: bErr } = await supabase
        .from("budgets")
        .upsert(budgetPayload, { onConflict: "user_id,month,category_id" })
        .select("id,month,category_id,amount")
        .single();
      if (bErr) throw bErr;
      setBudgets((prev) => {
        const row = bData as BudgetRow;
        const idx = prev.findIndex((b) => b.month === monthKey && b.category_id === row.category_id);
        if (idx === -1) return [...prev, row];
        return prev.map((b, i) => (i === idx ? row : b));
      });

      if (applyToFuture) {
        // Update the category name globally, and propagate budgets to future months.
        const { data, error } = await supabase
          .from("categories")
          .update({ name: nextName })
          .eq("id", categoryEditId)
          .eq("user_id", session.user.id)
          .select("id,name,color,kind,archived")
          .single();
        if (error) throw error;
        setCategories((prev) => prev.map((c) => (c.id === categoryEditId ? (data as CategoryRow) : c)));

        const months: string[] = [];
        for (let i = 1; i <= 24; i++) months.push(addMonthsToKey(monthKey, i));
        if (months.length) {
          const rows = months.map((m) => ({
            user_id: session.user.id,
            month: m,
            category_id: categoryEditId,
            amount: budgetAmount,
          }));
          const { error: upErr } = await supabase.from("budgets").upsert(rows as any, { onConflict: "user_id,month,category_id" });
          if (upErr) throw upErr;
          // Optimistically update local state for months we've touched (even if not currently visible).
        }
      }

      setCategoryEditOpen(false);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to update category");
    } finally {
      setCategoryEditSaving(false);
    }
  };

  const hideCategoryForMonth = async ({ id, mKey }: { id: string; mKey: string }) => {
    if (!session?.user?.id) return;
    if (!supabase) return;
    setAuthError(null);
    setCategoryConfirmBusy(true);
    try {
      const payload = { user_id: session.user.id, month: mKey, category_id: id, hidden: true };
      const { data, error } = await supabase
        .from("category_month_settings")
        .upsert(payload as any, { onConflict: "user_id,month,category_id" })
        .select("id,month,category_id,hidden")
        .single();
      if (error) throw error;
      setCategoryMonthSettings((prev) => {
        const row = data as CategoryMonthSettingRow;
        const idx = prev.findIndex((r) => r.month === row.month && r.category_id === row.category_id);
        if (idx === -1) return [...prev, row];
        return prev.map((r, i) => (i === idx ? row : r));
      });
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to delete category");
    } finally {
      setCategoryConfirmBusy(false);
    }
  };

  const hideCategoryAllFutureMonths = async ({ id }: { id: string }) => {
    if (!session?.user?.id) return;
    if (!supabase) return;
    setAuthError(null);
    setCategoryConfirmBusy(true);
    try {
      const months: string[] = [monthKey];
      for (let i = 1; i <= 24; i++) months.push(addMonthsToKey(monthKey, i));
      const rows = months.map((m) => ({ user_id: session.user.id, month: m, category_id: id, hidden: true }));
      const { data, error } = await supabase
        .from("category_month_settings")
        .upsert(rows as any, { onConflict: "user_id,month,category_id" })
        .select("id,month,category_id,hidden");
      if (error) throw error;
      const list = (data ?? []) as CategoryMonthSettingRow[];
      setCategoryMonthSettings((prev) => {
        const next = [...prev];
        list.forEach((row) => {
          const idx = next.findIndex((r) => r.month === row.month && r.category_id === row.category_id);
          if (idx === -1) next.push(row);
          else next[idx] = row;
        });
        return next;
      });
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to delete category");
    } finally {
      setCategoryConfirmBusy(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!session?.user?.id) return;
    if (!supabase) return;
    setAuthError(null);
    setCategoryEditSaving(true);
    try {
      const { error } = await supabase.from("categories").update({ archived: true }).eq("id", id).eq("user_id", session.user.id);
      if (error) throw error;
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setBudgets((prev) => prev.filter((b) => b.category_id !== id));
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to delete category");
    } finally {
      setCategoryEditSaving(false);
    }
  };

  const [accountOpen, setAccountOpen] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountDraft, setAccountDraft] = useState<{ name: string; opening_balance: string; color: string }>({ name: "", opening_balance: "", color: "" });

  const [accountEditOpen, setAccountEditOpen] = useState(false);
  const [accountEditId, setAccountEditId] = useState<string | null>(null);
  const [accountEditDraft, setAccountEditDraft] = useState<{ name: string; opening_balance: string; color: string }>({ name: "", opening_balance: "", color: "" });
  const [accountDeleteConfirmOpen, setAccountDeleteConfirmOpen] = useState(false);

  const openAccount = () => {
    setAuthError(null);
    setAccountDraft({ name: "", opening_balance: "", color: "" });
    setAccountOpen(true);
  };

  const closeAccountModal = () => {
    setAccountOpen(false);
    setAccountDeleteConfirmOpen(false);
  };

  const closeAccountEditModal = () => {
    setAccountEditOpen(false);
    setAccountEditId(null);
    setAccountDeleteConfirmOpen(false);
  };

  const saveAccount = async () => {
    if (!session?.user?.id) return;
    if (!supabase) return;
    setAuthError(null);
    setAccountSaving(true);
    try {
      const name = accountDraft.name.trim();
      if (!name) throw new Error("Please enter an account name");
      const opening_balance = Number.parseFloat(accountDraft.opening_balance.replace(/[฿,]/g, ""));
      if (!Number.isFinite(opening_balance)) throw new Error("Initial amount must be a number");

      // Some environments may not have accounts.color yet. Try with color, then fallback without.
      const payloadWithColor: any = { user_id: session.user.id, name, opening_balance, color: accountDraft.color || null, currency: "THB", archived: false };
      let row: any = null;
      const first = await supabase.from("accounts").insert(payloadWithColor).select("id,name,opening_balance,archived").single();
      if (first.error) {
        const msg = String((first.error as any).message ?? "");
        // If the name already exists, it may be an archived account. Restore instead of failing.
        if (msg.toLowerCase().includes("duplicate key") || msg.toLowerCase().includes("accounts_name_user_unique")) {
          const existing = await supabase
            .from("accounts")
            .select("id,archived")
            .eq("user_id", session.user.id)
            .eq("name", name)
            .maybeSingle();
          if (existing.error) throw existing.error;
          if (existing.data?.id && existing.data.archived) {
            const color = accountDraft.color?.trim() ? accountDraft.color.trim() : null;
            const tryRestore = async (withColor: boolean) => {
              const updateBase: any = { opening_balance, archived: false };
              if (withColor) updateBase.color = color;
              const q = supabase.from("accounts").update(updateBase).eq("id", existing.data!.id).eq("user_id", session.user.id);
              const res = withColor
                ? await q.select("id,name,opening_balance,archived,color").single()
                : await q.select("id,name,opening_balance,archived").single();
              if (res.error) throw res.error;
              return res.data;
            };
            try {
              row = await tryRestore(true);
            } catch (e) {
              const emsg = e instanceof Error ? e.message : String(e);
              if (emsg.toLowerCase().includes("color")) row = await tryRestore(false);
              else throw e;
            }
          } else {
            throw first.error;
          }
        } else if (msg.toLowerCase().includes("color")) {
          const payloadNoColor: any = { user_id: session.user.id, name, opening_balance, currency: "THB", archived: false };
          const second = await supabase.from("accounts").insert(payloadNoColor).select("id,name,opening_balance,archived").single();
          if (second.error) throw second.error;
          row = second.data;
        } else {
          throw first.error;
        }
      } else {
        row = first.data;
      }

      setAccounts((prev) => {
        const idx = prev.findIndex((a) => a.id === (row as any).id);
        if (idx >= 0) return prev.map((a) => (a.id === (row as any).id ? ({ ...a, ...(row as any) } as any) : a));
        return [...prev, row as AccountRow];
      });
      closeAccountModal();
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to add account");
    } finally {
      setAccountSaving(false);
    }
  };

  const deleteAccount = async (id: string) => {
    if (!session?.user?.id) return;
    if (!supabase) return;
    setAuthError(null);
    setAccountSaving(true);
    try {
      const { error } = await supabase.from("accounts").update({ archived: true }).eq("id", id).eq("user_id", session.user.id);
      if (error) throw error;
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to delete account");
    } finally {
      setAccountSaving(false);
    }
  };

  const openAccountEdit = (a: AccountRow) => {
    setAuthError(null);
    setAccountEditId(a.id);
    setAccountEditDraft({
      name: a.name,
      opening_balance: String(a.opening_balance ?? 0),
      color: (a as any).color ? String((a as any).color) : "",
    });
    setAccountDeleteConfirmOpen(false);
    setAccountEditOpen(true);
  };

  const requestSaveAccountEdit = async () => {
    if (!accountEditId) return;
    const name = accountEditDraft.name.trim();
    if (!name) {
      setAuthError("Please enter an account name");
      return;
    }
    const dup = accounts.find((a) => a.id !== accountEditId && a.name.trim().toLowerCase() === name.toLowerCase());
    if (dup) {
      setAuthError(`Account "${name}" already exists`);
      return;
    }
    const opening_balance = Number.parseFloat(accountEditDraft.opening_balance.replace(/[฿,]/g, ""));
    if (!Number.isFinite(opening_balance)) {
      setAuthError("Initial amount must be a number");
      return;
    }
    setAuthError(null);
    await commitSaveAccountEdit();
  };

  const commitSaveAccountEdit = async () => {
    if (!session?.user?.id) return;
    if (!supabase) return;
    if (!accountEditId) return;
    setAuthError(null);
    setAccountSaving(true);
    try {
      const name = accountEditDraft.name.trim();
      const opening_balance = Number.parseFloat(accountEditDraft.opening_balance.replace(/[฿,]/g, ""));
      const color = accountEditDraft.color.trim() ? accountEditDraft.color.trim() : null;

      const tryUpdate = async (withColor: boolean) => {
        const base: any = { name, opening_balance };
        if (withColor) base.color = color;
        const q = supabase.from("accounts").update(base).eq("id", accountEditId).eq("user_id", session.user.id);
        const res = withColor
          ? await q.select("id,name,opening_balance,color,archived").single()
          : await q.select("id,name,opening_balance,archived").single();
        if (res.error) throw res.error;
        return res.data as AccountRow;
      };

      let row: AccountRow;
      try {
        row = await tryUpdate(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.toLowerCase().includes("color")) row = await tryUpdate(false);
        else throw e;
      }

      setAccounts((prev) => prev.map((a) => (a.id === accountEditId ? ({ ...a, ...row } as any) : a)));
      closeAccountEditModal();
    } catch (e) {
      const raw =
        e instanceof Error ? e.message : typeof (e as any)?.message === "string" ? String((e as any).message) : String(e);
      if (raw.toLowerCase().includes("duplicate key") || raw.toLowerCase().includes("accounts_name_user_unique")) {
        const name = accountEditDraft.name.trim();
        try {
          const existing = await supabase
            .from("accounts")
            .select("id,archived")
            .eq("user_id", session.user.id)
            .eq("name", name)
            .maybeSingle();
          if (existing.data?.archived) {
            setAuthError(`Account "${name}" already exists (archived). Use + Account to restore it.`);
          } else {
            setAuthError(`Account "${name}" already exists`);
          }
        } catch {
          setAuthError(raw);
        }
        return;
      }
      setAuthError(raw || "Failed to update account");
    } finally {
      setAccountSaving(false);
    }
  };

  const commitDeleteAccountEdit = async () => {
    if (!accountEditId) return;
    const id = accountEditId;
    await deleteAccount(id);
    closeAccountEditModal();
  };

  // (No clear-all button; users delete accounts individually.)

  const [billOpen, setBillOpen] = useState(false);
  const [billSaving, setBillSaving] = useState(false);
  const [billCalendarOpen, setBillCalendarOpen] = useState(false);
  const [billEditingId, setBillEditingId] = useState<string | null>(null);
  const [billConfirmOpen, setBillConfirmOpen] = useState(false);
  const [billConfirmMode, setBillConfirmMode] = useState<"create" | "edit">("create");
  const [billDeleteConfirmOpen, setBillDeleteConfirmOpen] = useState(false);
  const [billClearAllConfirmOpen, setBillClearAllConfirmOpen] = useState(false);
  const [billDraft, setBillDraft] = useState<{
    name: string;
    account_id: string;
    due_date: string;
    amount: string;
    paid: boolean;
  }>({ name: "", account_id: "", due_date: monthDefaultDate, amount: "", paid: false });

  const openBill = () => {
    setAuthError(null);
    setBillEditingId(null);
    setBillDraft({
      name: "",
      account_id: "",
      due_date: monthDefaultDate,
      amount: "",
      paid: false,
    });
    setBillCalendarOpen(false);
    setBillOpen(true);
  };

  const openEditBillMonthly = (b: BillMonthlyRow) => {
    setAuthError(null);
    setBillEditingId(b.id);
    setBillDraft({
      name: b.name,
      account_id: "",
      due_date: b.due_date ?? monthDefaultDate,
      amount: String(b.amount),
      paid: b.paid,
    });
    setBillCalendarOpen(false);
    setBillOpen(true);
  };

  const saveBillMonthly = async () => {
    if (!session?.user?.id) return;
    if (!supabase) return;
    setAuthError(null);
    setBillSaving(true);
    try {
      const amount = Number.parseFloat(billDraft.amount.replace(/[฿,]/g, ""));
      if (!billDraft.name.trim()) throw new Error("Please enter a bill name");
      if (!billDraft.due_date) throw new Error("Please select a due date");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than 0");

      if (!billEditingId) {
        const payload = {
          user_id: session.user.id,
          month: monthKey,
          template_id: null,
          name: billDraft.name.trim(),
          account_id: null,
          due_date: billDraft.due_date,
          amount,
          paid: billDraft.paid,
        };
        const { data, error } = await supabase
          .from("bills_monthly")
          .insert(payload)
          .select("id,month,template_id,recurrence_id,name,account_id,due_date,amount,paid")
          .single();
        if (error) throw error;
        setBillsMonthly((prev) => [...prev, data as BillMonthlyRow].sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")));
      } else {
        const payload = {
          name: billDraft.name.trim(),
          account_id: null,
          due_date: billDraft.due_date,
          amount,
          paid: billDraft.paid,
        };
        const { data, error } = await supabase
          .from("bills_monthly")
          .update(payload)
          .eq("id", billEditingId)
          .eq("user_id", session.user.id)
          .select("id,month,template_id,recurrence_id,name,account_id,due_date,amount,paid")
          .single();
        if (error) throw error;
        setBillsMonthly((prev) =>
          prev
            .map((x) => (x.id === billEditingId ? (data as BillMonthlyRow) : x))
            .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")),
        );
      }

      setBillOpen(false);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to save bill");
    } finally {
      setBillSaving(false);
    }
  };

  const saveBillWithConfirm = async (opts: { repeat: boolean; applyToFuture: boolean }) => {
    if (!session?.user?.id) return;
    if (!supabase) return;
    setAuthError(null);
    setBillSaving(true);
    try {
      const amount = Number.parseFloat(billDraft.amount.replace(/[฿,]/g, ""));
      if (!billDraft.name.trim()) throw new Error("Please enter a bill name");
      if (!billDraft.due_date) throw new Error("Please select a due date");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than 0");

      const dueDay = Number(billDraft.due_date.slice(-2));
      const recurrenceId =
        opts.repeat || opts.applyToFuture
          ? (typeof crypto !== "undefined" && "randomUUID" in crypto
              ? (crypto.randomUUID() as string)
              : `rec-${Date.now()}-${Math.random().toString(16).slice(2)}`)
          : null;

      if (!billEditingId) {
        // Create bill for this month
        const payload = {
          user_id: session.user.id,
          month: monthKey,
          template_id: null,
          recurrence_id: opts.repeat ? recurrenceId : null,
          name: billDraft.name.trim(),
          account_id: null,
          due_date: billDraft.due_date,
          amount,
          paid: billDraft.paid,
        };
        const { data, error } = await supabase
          .from("bills_monthly")
          .insert(payload)
          .select("id,month,template_id,recurrence_id,name,account_id,due_date,amount,paid")
          .single();
        if (error) throw error;

        // Repeat: create rows for future months
        if (opts.repeat && recurrenceId) {
          const months: string[] = [];
          for (let i = 1; i <= 24; i++) months.push(addMonthsToKey(monthKey, i));
          const futureRows = months.map((m) => ({
            user_id: session.user.id,
            month: m,
            template_id: null,
            recurrence_id: recurrenceId,
            name: billDraft.name.trim(),
            account_id: null,
            due_date: clampDueDateForMonth(m, dueDay),
            amount,
            paid: false,
          }));
          const upsertRes = await supabase.from("bills_monthly").upsert(futureRows, { onConflict: "user_id,month,recurrence_id" });
          if (upsertRes.error) throw upsertRes.error;
        }

        setBillsMonthly((prev) =>
          [...prev, data as BillMonthlyRow].sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")),
        );
      } else {
        // Edit bill for this month only or future
        const current = billsMonthly.find((b) => b.id === billEditingId) ?? null;
        const existingRecurrence = current?.recurrence_id ?? null;
        const useRecurrence = opts.applyToFuture ? existingRecurrence ?? recurrenceId : null;

        // Ensure current row has recurrence_id if applying to future and missing
        if (opts.applyToFuture && useRecurrence && !existingRecurrence) {
          const { error } = await supabase
            .from("bills_monthly")
            .update({ recurrence_id: useRecurrence })
            .eq("id", billEditingId)
            .eq("user_id", session.user.id);
          if (error) throw error;
        }

        const payload = {
          name: billDraft.name.trim(),
          account_id: null,
          due_date: billDraft.due_date,
          amount,
          paid: billDraft.paid,
        };
        const { data, error } = await supabase
          .from("bills_monthly")
          .update(payload)
          .eq("id", billEditingId)
          .eq("user_id", session.user.id)
          .select("id,month,template_id,recurrence_id,name,account_id,due_date,amount,paid")
          .single();
        if (error) throw error;

        // Apply to future months
        if (opts.applyToFuture && useRecurrence) {
          const months: string[] = [];
          for (let i = 1; i <= 24; i++) months.push(addMonthsToKey(monthKey, i));
          const futureRows = months.map((m) => ({
            user_id: session.user.id,
            month: m,
            template_id: null,
            recurrence_id: useRecurrence,
            name: billDraft.name.trim(),
            account_id: null,
            due_date: clampDueDateForMonth(m, dueDay),
            amount,
            paid: false,
          }));
          const upsertRes = await supabase.from("bills_monthly").upsert(futureRows, { onConflict: "user_id,month,recurrence_id" });
          if (upsertRes.error) throw upsertRes.error;
        }

        setBillsMonthly((prev) =>
          prev
            .map((x) => (x.id === billEditingId ? (data as BillMonthlyRow) : x))
            .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")),
        );
      }

      setBillOpen(false);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to save bill");
    } finally {
      setBillSaving(false);
    }
  };

  const deleteBillMonthly = async () => {
    if (!billEditingId) return;
    if (!session?.user?.id) return;
    if (!supabase) return;
    setAuthError(null);
    setBillSaving(true);
    try {
      const { error } = await supabase.from("bills_monthly").delete().eq("id", billEditingId).eq("user_id", session.user.id);
      if (error) throw error;
      setBillsMonthly((prev) => prev.filter((b) => b.id !== billEditingId));
      setBillOpen(false);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to delete bill");
    } finally {
      setBillSaving(false);
    }
  };

  const deleteBillWithConfirm = async (opts: { allFuture: boolean }) => {
    if (!billEditingId) return;
    if (!session?.user?.id) return;
    if (!supabase) return;
    setAuthError(null);
    setBillSaving(true);
    try {
      const current = billsMonthly.find((b) => b.id === billEditingId) ?? null;
      const rec = current?.recurrence_id ?? null;

      if (opts.allFuture && rec) {
        const { error } = await supabase
          .from("bills_monthly")
          .delete()
          .eq("user_id", session.user.id)
          .eq("recurrence_id", rec)
          .gte("month", monthKey);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bills_monthly").delete().eq("id", billEditingId).eq("user_id", session.user.id);
        if (error) throw error;
      }

      // For current month UI, removing the current row is enough.
      setBillsMonthly((prev) => prev.filter((b) => b.id !== billEditingId));
      setBillOpen(false);
      setBillDeleteConfirmOpen(false);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to delete bill");
    } finally {
      setBillSaving(false);
    }
  };

  const deleteAllBillsThisMonth = async () => {
    if (!session?.user?.id) return;
    if (!supabase) return;
    setAuthError(null);
    setBillSaving(true);
    try {
      const { error } = await supabase.from("bills_monthly").delete().eq("user_id", session.user.id).eq("month", monthKey);
      if (error) throw error;
      setBillsMonthly([]);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to delete bills");
    } finally {
      setBillSaving(false);
    }
  };

  const deleteAllBillsAllMonths = async () => {
    if (!session?.user?.id) return;
    if (!supabase) return;
    setAuthError(null);
    setBillSaving(true);
    try {
      const { error } = await supabase.from("bills_monthly").delete().eq("user_id", session.user.id);
      if (error) throw error;
      setBillsMonthly([]);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to delete bills");
    } finally {
      setBillSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setAuthError(error.message);
      setSession(data.session ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const sendMagicLink = async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      if (!supabase) throw new Error("Supabase env not configured");
      const { error } = await supabase.auth.signInWithOtp({
        email: authEmail.trim(),
        options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
      });
      if (error) throw error;
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setAuthBusy(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Onboarding: copy defaults (user_id IS NULL) into the signed-in user scope
  // ---------------------------------------------------------------------------
  const ensureUserDefaults = async () => {
    if (!session?.user?.id) return;
    if (!supabase) return;

    // Accounts are NOT seeded/copied. Users add accounts themselves.

    const catHead = await supabase.from("categories").select("id", { count: "exact", head: true }).eq("user_id", session.user.id);
    if (catHead.error) throw catHead.error;
    const catCount = catHead.count ?? 0;

    // Copy default categories (8 templates, user_id is NULL).
    const defaultCategories = await supabase.from("categories").select("name,color,kind,archived").is("user_id", null);
    if (defaultCategories.error) throw defaultCategories.error;

    // Ensure the 8 template categories exist (even if user already has some categories).
    if (defaultCategories.data?.length) {
      await supabase.from("categories").upsert(
        defaultCategories.data.map((c) => ({
          user_id: session.user.id,
          name: c.name,
          color: c.color,
          kind: c.kind,
          archived: c.archived,
        })) as any,
        { onConflict: "user_id,kind,name" },
      );
    }

    // Back-compat: earlier seed used "Others" but UI expects "Other"
    await supabase
      .from("categories")
      .update({ name: "Other" })
      .eq("user_id", session.user.id)
      .eq("kind", "expense")
      .eq("name", "Others");

    // Bill templates are intentionally not used. Bills are created ad-hoc and can be repeated via recurrence_id.

    // Budgets are created per-category when user adds categories (no budget templates).
  };

  // ---------------------------------------------------------------------------
  // Base data loading (accounts/categories/transactions)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!session?.user?.id) return;
    if (!supabase) return;

    (async () => {
      setAuthError(null);
      try {
        await ensureUserDefaults();

        const [acctRes, catRes, txRes] = await Promise.all([
          supabase
            .from("accounts")
            .select("id,name,opening_balance,color,archived")
            .eq("user_id", session.user.id)
            .eq("archived", false)
            .order("name"),
          supabase
            .from("categories")
            .select("id,name,color,kind,archived")
            .eq("user_id", session.user.id)
            .eq("archived", false)
            .order("kind")
            .order("name"),
          supabase.from("transactions").select("*").eq("user_id", session.user.id),
        ]);

        if (acctRes.error) throw acctRes.error;
        if (catRes.error) throw catRes.error;
        if (txRes.error) throw txRes.error;

        setAccounts((acctRes.data ?? []) as AccountRow[]);
        setCategories((catRes.data ?? []) as CategoryRow[]);
        setTransactions((txRes.data ?? []) as TransactionRow[]);
      } catch (e) {
        setAuthError(e instanceof Error ? e.message : "Failed to load data");
      }
    })();
  }, [session?.user?.id, supabase]);

  // ---------------------------------------------------------------------------
  // Month-scoped data loading (budgets/bills/category-month settings)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!session?.user?.id) return;
    if (!supabase) return;

    let cancelled = false;
    (async () => {
      setAuthError(null);
      setMonthLoading(true);
      try {
        const [budgetRes, catMonthRes, billsRes] = await Promise.all([
          supabase.from("budgets").select("id,month,category_id,amount").eq("user_id", session.user.id).eq("month", monthKey),
          supabase.from("category_month_settings").select("id,month,category_id,hidden").eq("user_id", session.user.id).eq("month", monthKey),
          supabase
            .from("bills_monthly")
            .select("id,month,template_id,recurrence_id,name,account_id,due_date,amount,paid")
            .eq("user_id", session.user.id)
            .eq("month", monthKey)
            .order("due_date")
            .order("name"),
        ]);

        if (budgetRes.error) throw budgetRes.error;
        if (catMonthRes.error) throw catMonthRes.error;
        if (billsRes.error) throw billsRes.error;

        if (cancelled) return;
        setBudgets((budgetRes.data ?? []) as BudgetRow[]);
        setCategoryMonthSettings((catMonthRes.data ?? []) as CategoryMonthSettingRow[]);
        setBillsMonthly(
          ((billsRes.data ?? []) as BillMonthlyRow[]).sort((a, b) => {
            const da = a.due_date ?? "9999-99-99";
            const db = b.due_date ?? "9999-99-99";
            const d = da.localeCompare(db);
            if (d !== 0) return d;
            const n = a.name.localeCompare(b.name);
            if (n !== 0) return n;
            return a.id.localeCompare(b.id);
          }),
        );
      } catch (e) {
        if (!cancelled) setAuthError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        if (!cancelled) setMonthLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [monthKey, session?.user?.id, supabase]);

  // ---------------------------------------------------------------------------
  // Derived month ranges & helpers
  // ---------------------------------------------------------------------------
  const monthStart = `${monthKey}-01`;
  const monthEnd = new Date(year, monthIndex + 1, 0); // last day
  const monthEndIso = `${monthKey}-${String(monthEnd.getDate()).padStart(2, "0")}`;

  const txInMonth = useMemo(
    () => transactions.filter((t) => t.date >= monthStart && t.date <= monthEndIso),
    [transactions, monthEndIso, monthStart],
  );

  const hiddenCategoryIdsForMonth = useMemo(() => {
    const s = new Set<string>();
    categoryMonthSettings.forEach((r) => {
      if (r.month === monthKey && r.hidden) s.add(r.category_id);
    });
    return s;
  }, [categoryMonthSettings, monthKey]);

  const monthIncome = useMemo(
    () => txInMonth.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    [txInMonth],
  );
  const monthSpent = useMemo(
    () => txInMonth.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    [txInMonth],
  );

  const spentByCategoryId = useMemo(() => {
    const m = new Map<string, number>();
    txInMonth
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const key = t.category_id ?? "__uncategorized__";
        m.set(key, (m.get(key) ?? 0) + t.amount);
      });
    return m;
  }, [txInMonth]);

  const budgetByCategoryId = useMemo(() => {
    const m = new Map<string, number>();
    budgets.forEach((b) => m.set(b.category_id, b.amount));
    return m;
  }, [budgets]);

  const budgetCards = useMemo(() => {
    const expenseCats = sortExpenseCategoriesByDisplayOrder(
      categories.filter((c) => c.kind === "expense" && !c.archived && !hiddenCategoryIdsForMonth.has(c.id)),
    );
    return expenseCats.map((c) => ({
      category: c,
      spent: spentByCategoryId.get(c.id) ?? 0,
      budget: budgetByCategoryId.get(c.id) ?? 0,
    }));
  }, [budgetByCategoryId, categories, hiddenCategoryIdsForMonth, spentByCategoryId]);

  const budgetCardsTotal = useMemo(() => budgetCards.reduce((s, x) => s + x.budget, 0), [budgetCards]);
  const budgetTotalOverrideValue = useMemo(() => {
    const n = Number.parseFloat(budgetTotalOverrideRaw.replace(/[฿,]/g, ""));
    if (!budgetTotalOverrideRaw.trim()) return null;
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [budgetTotalOverrideRaw]);
  const budgetShareDenominator = budgetTotalOverrideValue ?? budgetCardsTotal;

  const beginEditBudget = (categoryId: string, currentAmount: number) => {
    setBudgetEditCategoryId(categoryId);
    setBudgetEditRaw(currentAmount === 0 ? "" : String(currentAmount));
  };

  const cancelEditBudget = () => {
    setBudgetEditCategoryId(null);
    setBudgetEditRaw("");
  };

  const commitEditBudget = async () => {
    if (!budgetEditCategoryId) return;
    if (!session?.user?.id) return;
    if (!supabase) return;

    const amount = Number.parseFloat(budgetEditRaw.replace(/[฿,]/g, ""));
    if (!Number.isFinite(amount) || amount < 0) return;

    setBudgetEditSaving(true);
    setAuthError(null);
    try {
      const payload = {
        user_id: session.user.id,
        month: monthKey,
        category_id: budgetEditCategoryId,
        amount,
      };
      const { data, error } = await supabase
        .from("budgets")
        .upsert(payload, { onConflict: "user_id,month,category_id" })
        .select("id,month,category_id,amount")
        .single();
      if (error) throw error;

      setBudgets((prev) => {
        const idx = prev.findIndex((b) => b.month === monthKey && b.category_id === budgetEditCategoryId);
        const row = data as BudgetRow;
        if (idx === -1) return [...prev, row];
        return prev.map((b, i) => (i === idx ? row : b));
      });
      cancelEditBudget();
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to update budget");
    } finally {
      setBudgetEditSaving(false);
    }
  };

  const expenseDonutSegments = useMemo(() => {
    const rows: { key: string; label: string; amount: number; color: string }[] = [];

    sortExpenseCategoriesByDisplayOrder(
      categories.filter((c) => c.kind === "expense" && !c.archived && !hiddenCategoryIdsForMonth.has(c.id)),
    ).forEach((c) => {
      const amt = spentByCategoryId.get(c.id) ?? 0;
      if (amt <= 0) return;
      rows.push({ key: c.id, label: c.name, amount: amt, color: resolveExpenseCategoryDisplayColor(c) });
    });

    const uncategorized = spentByCategoryId.get("__uncategorized__") ?? 0;
    if (uncategorized > 0) {
      rows.push({ key: "__uncategorized__", label: "Uncategorized", amount: uncategorized, color: "#6b7280" });
    }

    return rows.sort((a, b) => b.amount - a.amount);
  }, [categories, hiddenCategoryIdsForMonth, spentByCategoryId]);

  const expensesTxInMonth = useMemo(() => txInMonth.filter((t) => t.type === "expense"), [txInMonth]);

  const expensesByCategoryId = useMemo(() => {
    const m = new Map<string, TransactionRow[]>();
    expensesTxInMonth.forEach((t) => {
      const key = t.category_id ?? "__uncategorized__";
      const arr = m.get(key) ?? [];
      arr.push(t);
      m.set(key, arr);
    });
    for (const arr of m.values()) arr.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return m;
  }, [expensesTxInMonth]);

  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const arcPath = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
  };

  const MiniDonut = ({
    pct,
    color,
    warn,
  }: {
    pct: number;
    color: string;
    warn: boolean;
  }) => {
    const r = 14;
    const cx = 16;
    const cy = 16;
    const sweep = Math.max(0, Math.min(1, pct)) * 360;
    const bg = warn ? "#f97316" : color;

    return (
      <svg width="32" height="32" viewBox="0 0 32 32" className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a1a1a" strokeWidth="6" />
        {sweep > 0 && (
          <path
            d={arcPath(cx, cy, r - 3, 0, sweep)}
            fill={bg}
            opacity={0.9}
          />
        )}
        <circle cx={cx} cy={cy} r={r - 10} fill="#000" />
      </svg>
    );
  };

  const ExpenseDonutChart = ({
    segments,
    total,
  }: {
    segments: { label: string; amount: number; color: string }[];
    total: number;
  }) => {
    const size = 220;
    const cx = size / 2;
    const cy = size / 2;
    const rOuter = 84;
    const rInner = 54;

    const arcs =
      total > 0
        ? (() => {
            let angle = 0;
            return segments.map((s) => {
              const sweep = (s.amount / total) * 360;
              const start = angle;
              const end = angle + sweep;
              angle = end;

              const outerStart = polarToCartesian(cx, cy, rOuter, start);
              const outerEnd = polarToCartesian(cx, cy, rOuter, end);
              const innerEnd = polarToCartesian(cx, cy, rInner, end);
              const innerStart = polarToCartesian(cx, cy, rInner, start);

              const largeArc = sweep <= 180 ? 0 : 1;

              const d = [
                `M ${outerStart.x} ${outerStart.y}`,
                `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
                `L ${innerEnd.x} ${innerEnd.y}`,
                `A ${rInner} ${rInner} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
                "Z",
              ].join(" ");

              return (
                <path
                  key={`${s.label}-${start}`}
                  d={d}
                  fill={s.color}
                  opacity={0.92}
                  stroke="#000"
                  strokeWidth={1}
                  onMouseMove={(e) => {
                    const x = Math.min(window.innerWidth - 16, e.clientX + 14);
                    const y = Math.min(window.innerHeight - 16, e.clientY + 14);
                    setHoveredExpenseDonut({ label: s.label, amount: s.amount, color: s.color, x, y });
                  }}
                  onMouseLeave={() => setHoveredExpenseDonut(null)}
                />
              );
            });
          })()
        : [];

    return (
      <div className={`rounded border ${frameBorder} bg-black px-3 py-3`}>
        <div className={`mb-3 text-xs uppercase tracking-[0.5px] ${headingColor}`}>Expense breakdown</div>

        <div className="flex flex-col items-center gap-3">
          <div className="relative" style={{ width: size, height: size }}>
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              onMouseLeave={() => setHoveredExpenseDonut(null)}
            >
              <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={rOuter - rInner} />
              {total > 0 ? arcs : null}
              <circle cx={cx} cy={cy} r={rInner - 1} fill="#000" />
            </svg>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <div className={`text-[11px] uppercase tracking-[0.6px] ${headingColor}`}>Total expense</div>
              <div className="mt-1 text-[17px] font-semibold text-[#ff5555]">{fmt(total)}</div>
              <div className={`mt-1 text-[11px] ${headingColor}`}>{`${MONTHS[monthIndex]} ${year}`}</div>
            </div>
          </div>

          <div className="w-full space-y-2">
            {segments.length === 0 ? (
              <div className={`text-sm ${headingColor}`}>No categorized spending this month.</div>
            ) : (
              segments.map((s) => {
                const pct = total > 0 ? (s.amount / total) * 100 : 0;
                return (
                  <div key={s.label} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className={`truncate text-sm ${itemNameColor}`}>{s.label}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm text-white">{fmt(s.amount)}</div>
                      <div className={`text-[11px] ${headingColor}`}>{`${pct.toFixed(1)}%`}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const paidCount = billsMonthly.filter((b) => b.paid).length;
  const unpaidCount = billsMonthly.length - paidCount;
  const billsTotal = billsMonthly.reduce((sum, b) => sum + b.amount, 0);

  const totalAccountBalance = useMemo(() => {
    const byId = new Map<string, number>();
    accounts.forEach((a) => byId.set(a.id, a.opening_balance));

    transactions.forEach((t) => {
      if (t.type === "income" && t.account_id) byId.set(t.account_id, (byId.get(t.account_id) ?? 0) + t.amount);
      if (t.type === "expense" && t.account_id) byId.set(t.account_id, (byId.get(t.account_id) ?? 0) - t.amount);
      if (t.type === "transfer" && t.from_account_id && t.to_account_id) {
        byId.set(t.from_account_id, (byId.get(t.from_account_id) ?? 0) - t.amount);
        byId.set(t.to_account_id, (byId.get(t.to_account_id) ?? 0) + t.amount);
      }
    });

    return Array.from(byId.values()).reduce((s, n) => s + n, 0);
  }, [accounts, transactions]);

  const balanceByAccountId = useMemo(() => {
    const byId = new Map<string, number>();
    accounts.forEach((a) => byId.set(a.id, a.opening_balance));

    transactions.forEach((t) => {
      if (t.type === "income" && t.account_id) byId.set(t.account_id, (byId.get(t.account_id) ?? 0) + t.amount);
      if (t.type === "expense" && t.account_id) byId.set(t.account_id, (byId.get(t.account_id) ?? 0) - t.amount);
      if (t.type === "transfer" && t.from_account_id && t.to_account_id) {
        byId.set(t.from_account_id, (byId.get(t.from_account_id) ?? 0) - t.amount);
        byId.set(t.to_account_id, (byId.get(t.to_account_id) ?? 0) + t.amount);
      }
    });

    return byId;
  }, [accounts, transactions]);

  const lastChangeDateByAccountId = useMemo(() => {
    const byId = new Map<string, string>();
    const consider = (accountId: string | null, isoDate: string) => {
      if (!accountId) return;
      const prev = byId.get(accountId);
      if (!prev || isoDate > prev) byId.set(accountId, isoDate);
    };

    transactions.forEach((t) => {
      if (t.type === "expense" || t.type === "income") {
        consider(t.account_id, t.date);
        return;
      }
      if (t.type === "transfer") {
        consider(t.from_account_id, t.date);
        consider(t.to_account_id, t.date);
      }
    });

    return byId;
  }, [transactions]);

  const orderedAccounts = useMemo(() => {
    const preferred = ["Kasikorn", "Krungsri", "Krungthai", "Bangkok Bank", "Cash"];
    const byName = new Map(accounts.map((a) => [a.name, a] as const));
    const ordered: AccountRow[] = [];

    preferred.forEach((name) => {
      const a = byName.get(name);
      if (a) ordered.push(a);
    });

    accounts.forEach((a) => {
      if (!preferred.includes(a.name)) ordered.push(a);
    });

    return ordered;
  }, [accounts]);

  const totalIncome = monthIncome;
  const totalSpent = monthSpent;

  const categoriesRows = useMemo(
    () => [
      ["Shopping", "฿5,000", "13%", "฿0", "฿5,000", "฿556", "฿2,500", "#c084fc"],
      ["Entertainment", "฿2,000", "5%", "฿0", "฿2,000", "฿222", "฿1,000", "#fbbf24"],
      ["Bills & Utilities", "฿6,600", "17%", "฿0", "฿6,600", "฿733", "฿3,300", "#818cf8"],
      ["Transportation", "฿800", "2%", "฿0", "฿800", "฿89", "฿400", "#34d399"],
      ["Food & Dining", "฿7,000", "18%", "฿521", "฿6,479", "฿720", "฿3,240", "#00CCCC"],
      ["Housing", "฿4,000", "10%", "฿0", "฿4,000", "฿444", "฿2,000", "#f472b6"],
      ["Savings", "฿10,000", "26%", "฿0", "฿10,000", "฿1,111", "฿5,000", "#2dd4bf"],
      ["Other", "฿3,600", "9%", "฿0", "฿3,600", "฿400", "฿1,800", "#6b7280"],
    ],
    [],
  );

  const changeMonth = (dir: number) => {
    setMonthIndex((prev) => {
      const next = prev + dir;
      if (next < 0) {
        setYear((y) => y - 1);
        return 11;
      }
      if (next > 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return next;
    });
  };

  const toggleBill = async (index: number) => {
    const row = billsMonthly[index];
    if (!row || !session?.user?.id) return;
    if (!supabase) return;

    const nextPaid = !row.paid;
    setBillsMonthly((prev) => prev.map((b, i) => (i === index ? { ...b, paid: nextPaid } : b)));

    const { error } = await supabase
      .from("bills_monthly")
      .update({ paid: nextPaid })
      .eq("id", row.id)
      .eq("user_id", session.user.id);

    if (error) {
      setBillsMonthly((prev) => prev.map((b, i) => (i === index ? { ...b, paid: row.paid } : b)));
      setAuthError(error.message);
    }
  };

  const updateBillAmount = async (index: number, rawValue: string) => {
    const row = billsMonthly[index];
    if (!row || !session?.user?.id) return;
    if (!supabase) return;

    const value = Number.parseFloat(rawValue.replace(/[฿,]/g, ""));
    if (Number.isNaN(value)) return;

    setBillsMonthly((prev) => prev.map((b, i) => (i === index ? { ...b, amount: value } : b)));

    const { error } = await supabase
      .from("bills_monthly")
      .update({ amount: value })
      .eq("id", row.id)
      .eq("user_id", session.user.id);

    if (error) {
      setBillsMonthly((prev) => prev.map((b, i) => (i === index ? { ...b, amount: row.amount } : b)));
      setAuthError(error.message);
    }
  };

  const findCategoryByName = (categoryName: string) => {
    const normalized =
      categoryName === "Bills & Utilities"
        ? "Bills & Utilities"
        : categoryName === "Bills & Utils"
          ? "Bills & Utilities"
          : categoryName === "Transportation"
            ? "Transportation"
            : categoryName === "Transport"
              ? "Transportation"
              : categoryName;
    return categories.find((c) => c.name === normalized);
  };

  const hexToRgb = (hex: string) => {
    const raw = hex.replace("#", "").trim();
    const normalized = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;

    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;

    const n = Number.parseInt(normalized, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };

  const textColorForBg = (bgHex: string) => {
    const rgb = hexToRgb(bgHex);
    if (!rgb) return "#fff";
    const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return lum > 0.6 ? "#111" : "#fff";
  };

  const categoryDotColor = (categoryName: string) => {
    if (categoryName === "—") return "#6b7280";
    const row = findCategoryByName(categoryName);
    if (!row) return "#444747";
    return resolveExpenseCategoryDisplayColor(row);
  };

  const CategoryBadge = ({ category }: { category: string }) => {
    const bg = categoryDotColor(category);
    const fg = textColorForBg(bg);

    return (
      <span
        className="inline-flex rounded px-2 py-0.5 text-xs font-medium"
        style={{ backgroundColor: bg, color: fg }}
      >
        {category}
      </span>
    );
  };

  if (!supabase) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        <div className={`mx-auto max-w-md rounded border ${frameBorder} bg-black p-4`}>
          <div className={`text-sm ${headingColor}`}>Supabase ยังไม่ถูกตั้งค่า</div>
          <div className={`mt-2 text-sm ${itemNameColor}`}>
            ให้สร้างไฟล์ <span className="text-white">web-app/.env.local</span> แล้วใส่
            <br />
            <span className="text-white">NEXT_PUBLIC_SUPABASE_URL</span> และ{" "}
            <span className="text-white">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        <div className={`mx-auto max-w-md rounded border ${frameBorder} bg-black p-4`}>
          <div className="text-lg font-semibold text-white">Login</div>

          <label className={`mt-3 block text-sm ${headingColor}`}>Email</label>
          <input
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            placeholder="you@example.com"
            className={`mt-1 w-full rounded border ${frameBorder} bg-black px-3 py-2 text-white`}
            autoComplete="email"
            inputMode="email"
          />

          <button
            onClick={sendMagicLink}
            disabled={authBusy || !authEmail.trim()}
            className="mt-3 w-full rounded bg-[#00CCCC] px-3 py-2 text-sm font-medium text-[#111] disabled:opacity-50"
          >
            {authBusy ? "Sending..." : "Send magic link"}
          </button>

          {authError && <div className="mt-3 text-sm text-[#ff5555]">{authError}</div>}

          <div className={`mt-3 text-xs ${itemNameColor}`}>
            ระบบจะส่งลิงก์เข้าระบบไปที่อีเมลของคุณ → กดลิงก์แล้วจะกลับมาที่เว็บนี้
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black font-sans text-[15px] leading-[1.4] text-white">
      <aside className={`hidden w-[180px] shrink-0 flex-col border-r ${frameBorder} bg-black sm:flex lg:w-[150px]`}>
        <div className={`border-b ${frameBorder} px-3.5 py-2 text-xs font-medium leading-[1.5] tracking-[0.7px] text-[#00CCCC]`}>
          MONEY TRACKER
          <br />
          2026
        </div>
        <nav className="flex-1 py-1">
          {pageOrder.map((page) => (
            <button
              key={page}
              onClick={() => setActivePage(page)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm capitalize transition ${
                activePage === page
                  ? "bg-white/[0.03] text-white"
                  : `${headingColor} hover:bg-white/[0.02] hover:text-white`
              }`}
            >
              {page}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className={`sticky top-0 z-10 flex items-center justify-between border-b ${frameBorder} bg-black/80 px-3.5 py-2 backdrop-blur`}>
          <div className="pointer-events-none flex items-center gap-2" />

          <div className="pointer-events-auto absolute left-1/2 flex -translate-x-1/2 items-center gap-2">
            <button
              onClick={() => changeMonth(-1)}
              className={`flex h-5 w-5 items-center justify-center rounded border ${frameBorder} bg-white/[0.02] text-sm ${headingColor} hover:bg-white/[0.04] hover:text-white`}
            >
              ‹
            </button>
            <span className="text-sm font-medium text-white">{`${MONTHS[monthIndex]} ${year}`}</span>
            <button
              onClick={() => changeMonth(1)}
              className={`flex h-5 w-5 items-center justify-center rounded border ${frameBorder} bg-white/[0.02] text-sm ${headingColor} hover:bg-white/[0.04] hover:text-white`}
            >
              ›
            </button>
          </div>
          <div className="pointer-events-auto flex gap-1.5">
            <button onClick={openExpense} className="rounded bg-[#ff5555] px-2.5 py-1 text-sm font-medium text-white">
              + Expense
            </button>
            <button
              onClick={openIncome}
              className="rounded bg-[#00CCCC] px-2.5 py-1 text-sm font-medium text-[#111]"
            >
              + Income
            </button>
            <button
              onClick={openTransfer}
              className={`rounded border ${frameBorder} bg-white/[0.02] px-2.5 py-1 text-sm font-medium ${headingColor}`}
            >
              + Transfer
            </button>
            {activePage === "categories" && (
              <button
                onClick={openCategory}
                className={`rounded border ${frameBorder} bg-white/[0.02] px-2.5 py-1 text-sm font-medium ${headingColor} hover:bg-white/[0.04] hover:text-white`}
              >
                + Category
              </button>
            )}
            {activePage === "bills" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={openBill}
                  className={`rounded border ${frameBorder} bg-white/[0.02] px-2.5 py-1 text-sm font-medium ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                >
                  + Bill
                </button>
                <button
                  onClick={deleteAllBillsThisMonth}
                  className={`rounded border ${frameBorder} bg-white/[0.02] px-2.5 py-1 text-sm font-medium text-[#ff5555] hover:bg-white/[0.04] disabled:opacity-60`}
                  disabled={billSaving}
                  title="Delete all bills in this month"
                >
                  Clear bills
                </button>
              </div>
            )}
          </div>
        </div>

        <section className="flex-1 overflow-y-auto p-3.5">
          {monthLoading && (
            <div className={`mb-[10px] rounded border ${frameBorder} bg-black px-3 py-2 text-sm ${headingColor}`}>
              Loading…
            </div>
          )}
          {authError && (
            <div className={`mb-[10px] rounded border ${frameBorder} bg-black px-3 py-2 text-sm text-[#ff5555]`}>
              {authError}
            </div>
          )}

          {expenseOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <div className={`w-full max-w-md rounded border ${frameBorder} bg-black`}>
                <div className={`flex items-center justify-between border-b ${frameBorder} px-3.5 py-2`}>
                  <div className="text-sm font-semibold text-white">{expenseEditingId ? "Edit expense" : "Add expense"}</div>
                  <button
                    onClick={() => setExpenseOpen(false)}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-sm ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 p-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Date</label>
                      <div className="relative mt-1">
                        <button
                          type="button"
                          onClick={() => setExpenseCalendarOpen((v) => !v)}
                          className={`flex w-full items-center justify-between rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                        >
                          <span>{formatLongDate(expenseDraft.date)}</span>
                          <span className={headingColor}>▾</span>
                        </button>

                        {expenseCalendarOpen && (
                          <div className={`absolute left-0 top-[44px] z-10 w-[260px] rounded border ${frameBorder} bg-black p-3`}>
                            <div className={`mb-2 flex items-center justify-between text-xs uppercase tracking-[0.5px] ${headingColor}`}>
                              <span>{`${MONTHS[monthIndex]} ${year}`}</span>
                              <button
                                type="button"
                                onClick={() => setExpenseCalendarOpen(false)}
                                className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                              >
                                ✕
                              </button>
                            </div>

                            <div className={`grid grid-cols-7 gap-1 text-center text-[11px] ${headingColor}`}>
                              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                                <div key={`${d}-${i}`} className="py-1">
                                  {d}
                                </div>
                              ))}
                            </div>

                            {(() => {
                              const firstDow = new Date(year, monthIndex, 1).getDay(); // 0=Sun
                              const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
                              const selectedDay = Number(expenseDraft.date.slice(-2));
                              const cells: (number | null)[] = [];
                              for (let i = 0; i < firstDow; i++) cells.push(null);
                              for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                              while (cells.length % 7 !== 0) cells.push(null);
                              return (
                                <div className="mt-1 grid grid-cols-7 gap-1">
                                  {cells.map((d, i) => {
                                    if (!d) return <div key={`e-${i}`} className="h-8" />;
                                    const isSel = d === selectedDay;
                                    return (
                                      <button
                                        key={d}
                                        type="button"
                                        onClick={() => {
                                          const iso = `${monthKey}-${String(d).padStart(2, "0")}`;
                                          setExpenseDraft((prev) => ({ ...prev, date: iso }));
                                          setExpenseCalendarOpen(false);
                                        }}
                                        className={`h-8 rounded border text-sm ${
                                          isSel
                                            ? `border-[#00CCCC] bg-[#00CCCC]/10 text-[#00CCCC]`
                                            : `border-transparent bg-white/[0.02] text-white hover:bg-white/[0.04]`
                                        }`}
                                      >
                                        {d}
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Amount</label>
                      <input
                        value={expenseDraft.amount}
                        onChange={(e) => setExpenseDraft((d) => ({ ...d, amount: e.target.value }))}
                        placeholder="0.00"
                        inputMode="decimal"
                        className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Name</label>
                    <input
                      value={expenseDraft.name}
                      onChange={(e) => setExpenseDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="e.g. Coffee"
                      className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Account (required)</label>
                    <div className={`mt-1 flex gap-1 overflow-x-auto rounded border ${frameBorder} bg-white/[0.02] p-1`}>
                      {orderedAccounts.map((a) => {
                        const sel = expenseDraft.account_id === a.id;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setExpenseDraft((d) => ({ ...d, account_id: a.id }))}
                            className={`shrink-0 rounded px-2.5 py-1.5 text-center text-[11px] font-medium ${
                              sel ? "border border-[#444747] bg-black text-white shadow-[0_1px_0_rgba(255,255,255,0.04)]" : `${headingColor} hover:text-white`
                            }`}
                          >
                            {a.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Category (optional)</label>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setExpenseDraft((d) => ({ ...d, category_id: "" }))}
                        className={`rounded border px-2 py-2 text-center text-[10px] font-medium ${
                          expenseDraft.category_id === ""
                            ? "border-[#00CCCC] bg-[#00CCCC]/10 text-[#00CCCC]"
                            : `border-transparent bg-white/[0.02] ${itemNameColor} hover:text-white`
                        }`}
                      >
                        None
                      </button>
                      {sortExpenseCategoriesByDisplayOrder(
                        categories.filter((c) => c.kind === "expense" && !c.archived && !hiddenCategoryIdsForMonth.has(c.id)),
                      ).map((c) => {
                        const sel = expenseDraft.category_id === c.id;
                        const col = resolveExpenseCategoryDisplayColor(c);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setExpenseDraft((d) => ({ ...d, category_id: c.id }))}
                            className={`rounded border px-2 py-2 text-center ${
                              sel ? "border-[#00CCCC] bg-[#00CCCC]/10" : `border-transparent bg-white/[0.02] hover:border-[#444747]`
                            }`}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <span style={{ color: col }}>
                                <CategoryIcon name={c.name} className="inline-flex h-5 w-5 items-center justify-center" />
                              </span>
                              <span className={`line-clamp-2 text-[9px] leading-tight ${sel ? "text-white" : itemNameColor}`}>{c.name}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Note</label>
                    <textarea
                      value={expenseDraft.note}
                      onChange={(e) => setExpenseDraft((d) => ({ ...d, note: e.target.value }))}
                      placeholder="(optional)"
                      className={`mt-1 min-h-[84px] w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                    />
                  </div>
                </div>

                <div className={`flex items-center justify-end gap-2 border-t ${frameBorder} px-3.5 py-2.5`}>
                  {expenseEditingId && (
                    <button
                      onClick={deleteExpense}
                      disabled={expenseSaving}
                      className={`mr-auto rounded border ${frameBorder} bg-white/[0.02] px-3 py-2 text-sm font-medium text-[#ff5555] hover:bg-white/[0.04] disabled:opacity-50`}
                    >
                      Delete
                    </button>
                  )}
                  <button
                    onClick={() => setExpenseOpen(false)}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-3 py-2 text-sm font-medium ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveExpense}
                    disabled={expenseSaving}
                    className="rounded bg-[#ff5555] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {expenseSaving ? "Saving…" : expenseEditingId ? "Save changes" : "Save expense"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {incomeOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <div className={`w-full max-w-md rounded border ${frameBorder} bg-black`}>
                <div className={`flex items-center justify-between border-b ${frameBorder} px-3.5 py-2`}>
                  <div className="text-sm font-semibold text-white">{incomeEditingId ? "Edit income" : "Add income"}</div>
                  <button
                    onClick={closeIncomeModal}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-sm ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 p-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Date</label>
                      <div className="relative mt-1">
                        <button
                          type="button"
                          onClick={() => setIncomeCalendarOpen((v) => !v)}
                          className={`flex w-full items-center justify-between rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                        >
                          <span>{formatLongDate(incomeDraft.date)}</span>
                          <span className={headingColor}>▾</span>
                        </button>

                        {incomeCalendarOpen && (
                          <div className={`absolute left-0 top-[44px] z-10 w-[260px] rounded border ${frameBorder} bg-black p-3`}>
                            <div className={`mb-2 flex items-center justify-between text-xs uppercase tracking-[0.5px] ${headingColor}`}>
                              <span>{`${MONTHS[monthIndex]} ${year}`}</span>
                              <button
                                type="button"
                                onClick={() => setIncomeCalendarOpen(false)}
                                className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                              >
                                ✕
                              </button>
                            </div>

                            <div className={`grid grid-cols-7 gap-1 text-center text-[11px] ${headingColor}`}>
                              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                                <div key={`${d}-${i}-in`} className="py-1">
                                  {d}
                                </div>
                              ))}
                            </div>

                            {(() => {
                              const firstDow = new Date(year, monthIndex, 1).getDay();
                              const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
                              const selectedDay = Number(incomeDraft.date.slice(-2));
                              const cells: (number | null)[] = [];
                              for (let i = 0; i < firstDow; i++) cells.push(null);
                              for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                              while (cells.length % 7 !== 0) cells.push(null);
                              return (
                                <div className="mt-1 grid grid-cols-7 gap-1">
                                  {cells.map((d, i) => {
                                    if (!d) return <div key={`in-e-${i}`} className="h-8" />;
                                    const isSel = d === selectedDay;
                                    return (
                                      <button
                                        key={`in-${d}`}
                                        type="button"
                                        onClick={() => {
                                          const iso = `${monthKey}-${String(d).padStart(2, "0")}`;
                                          setIncomeDraft((prev) => ({ ...prev, date: iso }));
                                          setIncomeCalendarOpen(false);
                                        }}
                                        className={`h-8 rounded border text-sm ${
                                          isSel
                                            ? `border-[#00CCCC] bg-[#00CCCC]/10 text-[#00CCCC]`
                                            : `border-transparent bg-white/[0.02] text-white hover:bg-white/[0.04]`
                                        }`}
                                      >
                                        {d}
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Amount</label>
                      <input
                        value={incomeDraft.amount}
                        onChange={(e) => setIncomeDraft((d) => ({ ...d, amount: e.target.value }))}
                        placeholder="0.00"
                        inputMode="decimal"
                        className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Name</label>
                    <input
                      value={incomeDraft.name}
                      onChange={(e) => setIncomeDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="e.g. Salary"
                      className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Account (required)</label>
                    <div className={`mt-1 flex gap-1 overflow-x-auto rounded border ${frameBorder} bg-white/[0.02] p-1`}>
                      {orderedAccounts.map((a) => {
                        const sel = incomeDraft.account_id === a.id;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setIncomeDraft((d) => ({ ...d, account_id: a.id }))}
                            className={`shrink-0 rounded px-2.5 py-1.5 text-center text-[11px] font-medium ${
                              sel ? "border border-[#444747] bg-black text-white shadow-[0_1px_0_rgba(255,255,255,0.04)]" : `${headingColor} hover:text-white`
                            }`}
                          >
                            {a.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Note</label>
                    <textarea
                      value={incomeDraft.note}
                      onChange={(e) => setIncomeDraft((d) => ({ ...d, note: e.target.value }))}
                      placeholder="(optional)"
                      className={`mt-1 min-h-[84px] w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                    />
                  </div>
                </div>

                <div className={`flex items-center justify-end gap-2 border-t ${frameBorder} px-3.5 py-2.5`}>
                  {incomeEditingId && (
                    <button
                      onClick={() => setIncomeDeleteConfirmOpen(true)}
                      disabled={incomeSaving}
                      className={`mr-auto rounded border ${frameBorder} bg-white/[0.02] px-3 py-2 text-sm font-medium text-[#ff5555] hover:bg-white/[0.04] disabled:opacity-50`}
                    >
                      Delete
                    </button>
                  )}
                  <button
                    onClick={closeIncomeModal}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-3 py-2 text-sm font-medium ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveIncome}
                    disabled={incomeSaving}
                    className="rounded bg-[#00CCCC] px-3 py-2 text-sm font-medium text-[#111] disabled:opacity-50"
                  >
                    {incomeSaving ? "Saving…" : incomeEditingId ? "Save changes" : "Save income"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {incomeDeleteConfirmOpen && incomeEditingId && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
              <div className={`w-full max-w-md rounded border ${frameBorder} bg-black`}>
                <div className={`flex items-center justify-between border-b ${frameBorder} px-3.5 py-2`}>
                  <div className="text-sm font-semibold text-white">Delete this income?</div>
                  <button
                    onClick={() => setIncomeDeleteConfirmOpen(false)}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-sm ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2 p-3.5">
                  <button
                    type="button"
                    onClick={() => setIncomeDeleteConfirmOpen(false)}
                    disabled={incomeSaving}
                    className={`w-full rounded border ${frameBorder} bg-white/[0.02] px-3 py-3 text-left text-sm font-medium text-white hover:bg-white/[0.04] disabled:opacity-50`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setIncomeDeleteConfirmOpen(false);
                      await deleteIncome();
                    }}
                    disabled={incomeSaving}
                    className="w-full rounded bg-[#ff5555] px-3 py-3 text-left text-sm font-semibold text-[#111] disabled:opacity-50"
                  >
                    Delete income
                  </button>
                </div>
              </div>
            </div>
          )}

          {transferOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <div className={`w-full max-w-md rounded border ${frameBorder} bg-black`}>
                <div className={`flex items-center justify-between border-b ${frameBorder} px-3.5 py-2`}>
                  <div className="text-sm font-semibold text-white">{transferEditingId ? "Edit transfer" : "Add transfer"}</div>
                  <button
                    onClick={() => setTransferOpen(false)}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-sm ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 p-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Date</label>
                      <div className="relative mt-1">
                        <button
                          type="button"
                          onClick={() => setTransferCalendarOpen((v) => !v)}
                          className={`flex w-full items-center justify-between rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                        >
                          <span>{formatLongDate(transferDraft.date)}</span>
                          <span className={headingColor}>▾</span>
                        </button>

                        {transferCalendarOpen && (
                          <div className={`absolute left-0 top-[44px] z-10 w-[260px] rounded border ${frameBorder} bg-black p-3`}>
                            <div className={`mb-2 flex items-center justify-between text-xs uppercase tracking-[0.5px] ${headingColor}`}>
                              <span>{`${MONTHS[monthIndex]} ${year}`}</span>
                              <button
                                type="button"
                                onClick={() => setTransferCalendarOpen(false)}
                                className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                              >
                                ✕
                              </button>
                            </div>

                            <div className={`grid grid-cols-7 gap-1 text-center text-[11px] ${headingColor}`}>
                              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                                <div key={`${d}-${i}-tr`} className="py-1">
                                  {d}
                                </div>
                              ))}
                            </div>

                            {(() => {
                              const firstDow = new Date(year, monthIndex, 1).getDay();
                              const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
                              const selectedDay = Number(transferDraft.date.slice(-2));
                              const cells: (number | null)[] = [];
                              for (let i = 0; i < firstDow; i++) cells.push(null);
                              for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                              while (cells.length % 7 !== 0) cells.push(null);
                              return (
                                <div className="mt-1 grid grid-cols-7 gap-1">
                                  {cells.map((d, i) => {
                                    if (!d) return <div key={`tr-e-${i}`} className="h-8" />;
                                    const isSel = d === selectedDay;
                                    return (
                                      <button
                                        key={`tr-${d}`}
                                        type="button"
                                        onClick={() => {
                                          const iso = `${monthKey}-${String(d).padStart(2, "0")}`;
                                          setTransferDraft((prev) => ({ ...prev, date: iso }));
                                          setTransferCalendarOpen(false);
                                        }}
                                        className={`h-8 rounded border text-sm ${
                                          isSel
                                            ? `border-[#00CCCC] bg-[#00CCCC]/10 text-[#00CCCC]`
                                            : `border-transparent bg-white/[0.02] text-white hover:bg-white/[0.04]`
                                        }`}
                                      >
                                        {d}
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Amount</label>
                      <input
                        value={transferDraft.amount}
                        onChange={(e) => setTransferDraft((d) => ({ ...d, amount: e.target.value }))}
                        placeholder="0.00"
                        inputMode="decimal"
                        className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Name</label>
                    <input
                      value={transferDraft.name}
                      onChange={(e) => setTransferDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="e.g. Transfer"
                      className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>From account</label>
                    <div className={`mt-1 flex gap-1 overflow-x-auto rounded border ${frameBorder} bg-white/[0.02] p-1`}>
                      {orderedAccounts.map((a) => {
                        const sel = transferDraft.from_account_id === a.id;
                        return (
                          <button
                            key={`from-${a.id}`}
                            type="button"
                            onClick={() => setTransferDraft((d) => ({ ...d, from_account_id: a.id }))}
                            className={`shrink-0 rounded px-2.5 py-1.5 text-center text-[11px] font-medium ${
                              sel ? "border border-[#444747] bg-black text-white shadow-[0_1px_0_rgba(255,255,255,0.04)]" : `${headingColor} hover:text-white`
                            }`}
                          >
                            {a.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className={`mt-2 block text-xs uppercase tracking-[0.5px] ${headingColor}`}>To account</label>
                    <div className={`mt-1 flex gap-1 overflow-x-auto rounded border ${frameBorder} bg-white/[0.02] p-1`}>
                      {orderedAccounts.map((a) => {
                        const sel = transferDraft.to_account_id === a.id;
                        return (
                          <button
                            key={`to-${a.id}`}
                            type="button"
                            onClick={() => setTransferDraft((d) => ({ ...d, to_account_id: a.id }))}
                            className={`shrink-0 rounded px-2.5 py-1.5 text-center text-[11px] font-medium ${
                              sel ? "border border-[#444747] bg-black text-white shadow-[0_1px_0_rgba(255,255,255,0.04)]" : `${headingColor} hover:text-white`
                            }`}
                          >
                            {a.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Note</label>
                    <textarea
                      value={transferDraft.note}
                      onChange={(e) => setTransferDraft((d) => ({ ...d, note: e.target.value }))}
                      placeholder="(optional)"
                      className={`mt-1 min-h-[84px] w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                    />
                  </div>
                </div>

                <div className={`flex items-center justify-end gap-2 border-t ${frameBorder} px-3.5 py-2.5`}>
                  {transferEditingId && (
                    <button
                      onClick={deleteTransfer}
                      disabled={transferSaving}
                      className={`mr-auto rounded border ${frameBorder} bg-white/[0.02] px-3 py-2 text-sm font-medium text-[#ff5555] hover:bg-white/[0.04] disabled:opacity-50`}
                    >
                      Delete
                    </button>
                  )}
                  <button
                    onClick={() => setTransferOpen(false)}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-3 py-2 text-sm font-medium ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveTransfer}
                    disabled={transferSaving}
                    className="rounded bg-[#00CCCC] px-3 py-2 text-sm font-medium text-[#111] disabled:opacity-50"
                  >
                    {transferSaving ? "Saving…" : transferEditingId ? "Save changes" : "Save transfer"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {goalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <div className={`w-full max-w-md rounded border ${frameBorder} bg-black`}>
                <div className={`flex items-center justify-between border-b ${frameBorder} px-3.5 py-2`}>
                  <div className="text-sm font-semibold text-white">Add Goal</div>
                  <button
                    onClick={() => setGoalOpen(false)}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-sm ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 p-3.5">
                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Name</label>
                    <input
                      value={goalAddDraft.name}
                      onChange={(e) => setGoalAddDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="e.g. Savings"
                      className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Color</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        { label: "Teal", value: "#103544" },
                        { label: "Rose", value: "#441933" },
                        { label: "Sand", value: "#5e4f2a" },
                        { label: "Brick", value: "#561e1e" },
                        { label: "Olive", value: "#2d510a" },
                        { label: "Violet", value: "#37154c" },
                      ].map((c) => {
                        const sel = (goalAddDraft.color || "").toLowerCase() === c.value.toLowerCase();
                        return (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setGoalAddDraft((d) => ({ ...d, color: c.value }))}
                            className={`rounded border px-2.5 py-1.5 text-[11px] font-medium ${
                              sel ? "border-[#444747] bg-black text-white" : `border-transparent bg-white/[0.02] ${headingColor} hover:bg-white/[0.04] hover:text-white`
                            }`}
                            title={c.value}
                          >
                            <span className="inline-flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.value }} />
                              <span>{c.label}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Goal amount</label>
                      <input
                        value={goalAddDraft.goal_amount}
                        onChange={(e) => setGoalAddDraft((d) => ({ ...d, goal_amount: e.target.value }))}
                        placeholder="0.00"
                        inputMode="decimal"
                        className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Balance already have</label>
                      <input
                        value={goalAddDraft.balance_amount}
                        onChange={(e) => setGoalAddDraft((d) => ({ ...d, balance_amount: e.target.value }))}
                        placeholder="0.00"
                        inputMode="decimal"
                        className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                      />
                    </div>
                  </div>
                </div>

                <div className={`flex items-center justify-end gap-2 border-t ${frameBorder} px-3.5 py-2.5`}>
                  <button
                    onClick={() => setGoalOpen(false)}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-3 py-2 text-sm font-medium ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const name = goalAddDraft.name.trim();
                      if (!name) {
                        setAuthError("Please enter a goal name");
                        return;
                      }
                      const id =
                        typeof crypto !== "undefined" && "randomUUID" in crypto
                          ? (crypto.randomUUID() as string)
                          : `goal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
                      setGoals((prev) => [
                        ...prev,
                        {
                          id,
                          name,
                          goal_amount: goalAddDraft.goal_amount.trim(),
                          balance_amount: goalAddDraft.balance_amount.trim(),
                          color: goalAddDraft.color,
                        },
                      ]);
                      setGoalOpen(false);
                    }}
                    className="rounded bg-[#00CCCC] px-3 py-2 text-sm font-medium text-[#111]"
                  >
                    Save goal
                  </button>
                </div>
              </div>
            </div>
          )}

          {goalEditOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <div className={`w-full max-w-md rounded border ${frameBorder} bg-black`}>
                <div className={`flex items-center justify-between border-b ${frameBorder} px-3.5 py-2`}>
                  <div className="text-sm font-semibold text-white">Edit goal</div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setGoalEditOpen(false)}
                      className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-sm ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="space-y-3 p-3.5">
                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Name</label>
                    <input
                      value={goalEditDraft.name}
                      onChange={(e) => setGoalEditDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="e.g. House"
                      className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Balance</label>
                      <input
                        value={goalEditDraft.balance_amount}
                        onChange={(e) => setGoalEditDraft((d) => ({ ...d, balance_amount: e.target.value }))}
                        placeholder="0.00"
                        inputMode="decimal"
                        className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Goal</label>
                      <input
                        value={goalEditDraft.goal_amount}
                        onChange={(e) => setGoalEditDraft((d) => ({ ...d, goal_amount: e.target.value }))}
                        placeholder="0.00"
                        inputMode="decimal"
                        className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                      />
                    </div>
                  </div>
                </div>

                <div className={`flex items-center justify-end gap-2 border-t ${frameBorder} px-3.5 py-2.5`}>
                  {goalEditId && (
                    <button
                      type="button"
                      onClick={() => deleteGoal(goalEditId)}
                      className={`mr-auto rounded border ${frameBorder} bg-white/[0.02] px-3 py-2 text-sm font-medium text-[#ff5555] hover:bg-white/[0.04]`}
                    >
                      Delete
                    </button>
                  )}
                  <button
                    onClick={() => setGoalEditOpen(false)}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-3 py-2 text-sm font-medium ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveGoalEdit}
                    className="rounded bg-[#00CCCC] px-3 py-2 text-sm font-medium text-[#111]"
                  >
                    Save changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {accountOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <div className={`w-full max-w-md rounded border ${frameBorder} bg-black`}>
                <div className={`flex items-center justify-between border-b ${frameBorder} px-3.5 py-2`}>
                  <div className="text-sm font-semibold text-white">Add account</div>
                  <button
                    onClick={closeAccountModal}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-sm ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 p-3.5">
                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Account</label>
                    <input
                      value={accountDraft.name}
                      onChange={(e) => setAccountDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="e.g. Kasikorn"
                      className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Color</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        { label: "None", value: "" },
                        { label: "Navy", value: "#102033" },
                        { label: "Teal", value: "#022d29" },
                        { label: "Olive", value: "#1e261d" },
                        { label: "Underworld", value: "#23231b" },
                        { label: "Wine", value: "#1e1d28" },
                        { label: "Wood", value: "#191010" },
                        { label: "Carob", value: "#19170b" },
                        { label: "Gray", value: "#161616" },
                      ].map((c) => {
                        const sel = accountDraft.color === c.value;
                        return (
                          <button
                            key={c.label}
                            type="button"
                            onClick={() => setAccountDraft((d) => ({ ...d, color: c.value }))}
                            className={`rounded border px-2.5 py-1.5 text-[11px] font-medium ${
                              sel ? "border-[#444747] bg-black text-white" : `border-transparent bg-white/[0.02] ${headingColor} hover:bg-white/[0.04] hover:text-white`
                            }`}
                          >
                            <span className="inline-flex items-center gap-2">
                              {c.value ? <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.value }} /> : <span className="h-2.5 w-2.5 rounded-full bg-white/10" />}
                              <span>{c.label}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Initial Amount</label>
                    <input
                      value={accountDraft.opening_balance}
                      onChange={(e) => setAccountDraft((d) => ({ ...d, opening_balance: e.target.value }))}
                      placeholder="0.00"
                      inputMode="decimal"
                      className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                    />
                  </div>
                </div>

                <div className={`flex items-center justify-end gap-2 border-t ${frameBorder} px-3.5 py-2.5`}>
                  <button
                    onClick={closeAccountModal}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-3 py-2 text-sm font-medium ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveAccount}
                    disabled={accountSaving}
                    className="rounded bg-[#00CCCC] px-3 py-2 text-sm font-medium text-[#111] disabled:opacity-50"
                  >
                    {accountSaving ? "Saving…" : "Add"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {accountEditOpen && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
              <div className={`w-full max-w-md rounded border ${frameBorder} bg-black`}>
                <div className={`flex items-center justify-between border-b ${frameBorder} px-3.5 py-2`}>
                  <div className="text-sm font-semibold text-white">Edit account</div>
                  <button
                    onClick={closeAccountEditModal}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-sm ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 p-3.5">
                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Account</label>
                    <input
                      value={accountEditDraft.name}
                      onChange={(e) => setAccountEditDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="e.g. Kasikorn"
                      className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Color</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        { label: "None", value: "" },
                        { label: "Navy", value: "#102033" },
                        { label: "Teal", value: "#022d29" },
                        { label: "Olive", value: "#1e261d" },
                        { label: "Underworld", value: "#23231b" },
                        { label: "Wine", value: "#1e1d28" },
                        { label: "Wood", value: "#191010" },
                        { label: "Carob", value: "#19170b" },
                        { label: "Gray", value: "#161616" },
                      ].map((c) => {
                        const sel = accountEditDraft.color === c.value;
                        return (
                          <button
                            key={c.label}
                            type="button"
                            onClick={() => setAccountEditDraft((d) => ({ ...d, color: c.value }))}
                            className={`rounded border px-2.5 py-1.5 text-[11px] font-medium ${
                              sel ? "border-[#444747] bg-black text-white" : `border-transparent bg-white/[0.02] ${headingColor} hover:bg-white/[0.04] hover:text-white`
                            }`}
                          >
                            <span className="inline-flex items-center gap-2">
                              {c.value ? <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.value }} /> : <span className="h-2.5 w-2.5 rounded-full bg-white/10" />}
                              <span>{c.label}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Initial Amount</label>
                    <input
                      value={accountEditDraft.opening_balance}
                      onChange={(e) => setAccountEditDraft((d) => ({ ...d, opening_balance: e.target.value }))}
                      placeholder="0.00"
                      inputMode="decimal"
                      className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                    />
                  </div>
                </div>

                <div className={`flex items-center justify-end gap-2 border-t ${frameBorder} px-3.5 py-2.5`}>
                  <button
                    type="button"
                    onClick={() => setAccountDeleteConfirmOpen(true)}
                    disabled={accountSaving}
                    className={`mr-auto rounded border ${frameBorder} bg-white/[0.02] px-3 py-2 text-sm font-medium text-[#ff5555] hover:bg-white/[0.04] disabled:opacity-50`}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={closeAccountEditModal}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-3 py-2 text-sm font-medium ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={requestSaveAccountEdit}
                    disabled={accountSaving}
                    className="rounded bg-[#00CCCC] px-3 py-2 text-sm font-medium text-[#111] disabled:opacity-50"
                  >
                    Save changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {accountDeleteConfirmOpen && accountEditId && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
              <div className={`w-full max-w-md rounded border ${frameBorder} bg-black`}>
                <div className={`flex items-center justify-between border-b ${frameBorder} px-3.5 py-2`}>
                  <div className="text-sm font-semibold text-white">Would you like to delete it?</div>
                  <button
                    onClick={() => setAccountDeleteConfirmOpen(false)}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-sm ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-2 p-3.5">
                  <button
                    type="button"
                    onClick={() => setAccountDeleteConfirmOpen(false)}
                    disabled={accountSaving}
                    className={`w-full rounded border ${frameBorder} bg-white/[0.02] px-3 py-3 text-left text-sm font-medium text-white hover:bg-white/[0.04] disabled:opacity-50`}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setAccountDeleteConfirmOpen(false);
                      await commitDeleteAccountEdit();
                    }}
                    disabled={accountSaving}
                    className="w-full rounded bg-[#ff5555] px-3 py-3 text-left text-sm font-semibold text-[#111] disabled:opacity-50"
                  >
                    Yes
                  </button>
                </div>
              </div>
            </div>
          )}

          {categoryOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <div className={`w-full max-w-md rounded border ${frameBorder} bg-black`}>
                <div className={`flex items-center justify-between border-b ${frameBorder} px-3.5 py-2`}>
                  <div className="text-sm font-semibold text-white">Add category</div>
                  <button
                    onClick={() => setCategoryOpen(false)}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-sm ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 p-3.5">
                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Add scope</label>
                    <div className={`mt-1 flex flex-wrap gap-2`}>
                      {[
                        { id: "this_month", label: "This month only" },
                        { id: "all_future", label: "All future months" },
                      ].map((o) => {
                        const sel = categoryAddScope === (o.id as any);
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => setCategoryAddScope(o.id as any)}
                            className={`rounded border px-3 py-2 text-left text-sm ${
                              sel ? "border-[#444747] bg-black text-white" : `border-transparent bg-white/[0.02] ${headingColor} hover:bg-white/[0.04] hover:text-white`
                            }`}
                          >
                            <span className="inline-flex items-center gap-2">
                              <span className={`inline-block h-2.5 w-2.5 rounded-full border ${sel ? "border-[#00CCCC] bg-[#00CCCC]/20" : "border-white/20 bg-transparent"}`} />
                              <span>{o.label}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="mt-0.5 flex flex-wrap gap-2">
                      {presetBadges.map((b) => {
                        const sel = categoryBadgeMode === "preset" && categoryDraft.name === b.name;
                        return (
                          <button
                            key={b.name}
                            type="button"
                            onClick={() => {
                              setCategoryBadgeMode("preset");
                              setCategoryDraft((d) => ({ ...d, name: b.name }));
                            }}
                            className={`rounded border px-3 py-2 text-left text-sm ${
                              sel ? "border-[#444747] bg-black text-white" : `border-transparent bg-white/[0.02] ${headingColor} hover:bg-white/[0.04] hover:text-white`
                            }`}
                          >
                            <span className="inline-flex items-center">
                              <span
                                className="rounded-full px-3 py-1 text-[12px] font-semibold text-black"
                                style={{ backgroundColor: b.color }}
                              >
                                {b.name}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                      {categoryBadgeMode === "custom" ? (
                        <div className={`rounded border border-[#444747] bg-black px-3 py-2`}>
                          <div className="inline-flex items-center gap-2">
                            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[12px] font-semibold text-white">+</span>
                            <input
                              value={categoryDraft.name}
                              onChange={(e) => setCategoryDraft((d) => ({ ...d, name: e.target.value }))}
                              autoFocus
                              className="w-[180px] bg-transparent text-[12px] font-semibold text-white outline-none placeholder:text-white/40"
                              placeholder="New category"
                            />
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setCategoryBadgeMode("custom");
                            setCategoryDraft((d) => ({ ...d, name: "" }));
                          }}
                          className={`rounded border px-3 py-2 text-left text-sm ${
                            `border-transparent bg-white/[0.02] ${headingColor} hover:bg-white/[0.04] hover:text-white`
                          }`}
                        >
                          <span className="inline-flex items-center">
                            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[12px] font-semibold text-white">+</span>
                          </span>
                        </button>
                      )}
                    </div>
                    <div className="mt-3">
                      <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Color</label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[
                          { label: "Teal", value: "#103544" },
                          { label: "Rose", value: "#441933" },
                          { label: "Sand", value: "#5e4f2a" },
                          { label: "Brick", value: "#561e1e" },
                          { label: "Olive", value: "#2d510a" },
                          { label: "Violet", value: "#37154c" },
                        ].map((c) => {
                          const sel = (categoryDraft.color || "").toLowerCase() === c.value.toLowerCase();
                          return (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => setCategoryDraft((d) => ({ ...d, color: c.value }))}
                              className={`rounded border px-2.5 py-1.5 text-[11px] font-medium ${
                                sel ? "border-[#444747] bg-black text-white" : `border-transparent bg-white/[0.02] ${headingColor} hover:bg-white/[0.04] hover:text-white`
                              }`}
                              title={c.value}
                            >
                              <span className="inline-flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.value }} />
                                <span>{c.label}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Monthly budget</label>
                    <input
                      value={categoryDraft.monthly_budget}
                      onChange={(e) => setCategoryDraft((d) => ({ ...d, monthly_budget: e.target.value }))}
                      inputMode="decimal"
                      className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className={`flex items-center justify-end gap-2 border-t ${frameBorder} px-3.5 py-2.5`}>
                  <button
                    onClick={() => setCategoryOpen(false)}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-3 py-2 text-sm font-medium ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveCategory}
                    disabled={categorySaving}
                    className="rounded bg-[#00CCCC] px-3 py-2 text-sm font-medium text-[#111] disabled:opacity-50"
                  >
                    {categorySaving ? "Adding…" : "Add"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {categoryEditOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <div className={`w-full max-w-md rounded border ${frameBorder} bg-black`}>
                <div className={`flex items-center justify-between border-b ${frameBorder} px-3.5 py-2`}>
                  <div className="text-sm font-semibold text-white">Edit category</div>
                  <button
                    onClick={() => setCategoryEditOpen(false)}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-sm ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 p-3.5">
                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Name</label>
                    <input
                      value={categoryEditName}
                      onChange={(e) => setCategoryEditName(e.target.value)}
                      className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                      placeholder="e.g. Groceries"
                    />
                  </div>
                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Monthly budget</label>
                    <input
                      value={categoryEditBudgetRaw}
                      onChange={(e) => setCategoryEditBudgetRaw(e.target.value)}
                      inputMode="decimal"
                      className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                      placeholder="0.00"
                    />
                    <div className={`mt-1 text-[11px] ${headingColor}`}>{`This changes only ${MONTHS[monthIndex]} ${year}`}</div>
                  </div>
                </div>

                <div className={`flex items-center justify-end gap-2 border-t ${frameBorder} px-3.5 py-2.5`}>
                  <button
                    onClick={() => {
                      setCategoryDeleteConfirmOpen(true);
                    }}
                    disabled={categoryEditSaving}
                    className={`mr-auto rounded border ${frameBorder} bg-white/[0.02] px-3 py-2 text-sm font-medium text-[#ff5555] hover:bg-white/[0.04] disabled:opacity-50`}
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setCategoryEditOpen(false)}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-3 py-2 text-sm font-medium ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveCategoryEdit}
                    disabled={categoryEditSaving}
                    className="rounded bg-[#00CCCC] px-3 py-2 text-sm font-medium text-[#111] disabled:opacity-50"
                  >
                    {categoryEditSaving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {categoryApplyConfirmOpen && categoryEditId && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
              <div className={`w-full max-w-md rounded border ${frameBorder} bg-black`}>
                <div className={`flex items-center justify-between border-b ${frameBorder} px-3.5 py-2`}>
                  <div className="text-sm font-semibold text-white">Would you like to apply this category to all future months?</div>
                  <button
                    onClick={() => setCategoryApplyConfirmOpen(false)}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-sm ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2 p-3.5">
                  <button
                    type="button"
                    onClick={async () => {
                      setCategoryApplyConfirmOpen(false);
                      await saveCategoryEditWithConfirm({ applyToFuture: false });
                    }}
                    disabled={categoryConfirmBusy || categoryEditSaving}
                    className={`w-full rounded border ${frameBorder} bg-white/[0.02] px-3 py-3 text-left text-sm font-medium text-white hover:bg-white/[0.04] disabled:opacity-50`}
                  >
                    This month only
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setCategoryApplyConfirmOpen(false);
                      await saveCategoryEditWithConfirm({ applyToFuture: true });
                    }}
                    disabled={categoryConfirmBusy || categoryEditSaving}
                    className="w-full rounded bg-[#00CCCC] px-3 py-3 text-left text-sm font-semibold text-[#111] disabled:opacity-50"
                  >
                    Apply to all future months
                  </button>
                </div>
              </div>
            </div>
          )}

          {categoryDeleteConfirmOpen && categoryEditId && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
              <div className={`w-full max-w-md rounded border ${frameBorder} bg-black`}>
                <div className={`flex items-center justify-between border-b ${frameBorder} px-3.5 py-2`}>
                  <div className="text-sm font-semibold text-white">Would you like to delete this category to all future months</div>
                  <button
                    onClick={() => setCategoryDeleteConfirmOpen(false)}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-sm ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2 p-3.5">
                  <button
                    type="button"
                    onClick={async () => {
                      setCategoryDeleteConfirmOpen(false);
                      setCategoryEditOpen(false);
                      await hideCategoryForMonth({ id: categoryEditId, mKey: monthKey });
                    }}
                    disabled={categoryConfirmBusy || categoryEditSaving}
                    className={`w-full rounded border ${frameBorder} bg-white/[0.02] px-3 py-3 text-left text-sm font-medium text-white hover:bg-white/[0.04] disabled:opacity-50`}
                  >
                    This month only
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setCategoryDeleteConfirmOpen(false);
                      setCategoryEditOpen(false);
                      await hideCategoryAllFutureMonths({ id: categoryEditId });
                    }}
                    disabled={categoryConfirmBusy || categoryEditSaving}
                    className="w-full rounded bg-[#ff5555] px-3 py-3 text-left text-sm font-semibold text-[#111] disabled:opacity-50"
                  >
                    Delete all future months
                  </button>
                </div>
              </div>
            </div>
          )}

          {billOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <div className={`w-full max-w-md rounded border ${frameBorder} bg-black`}>
                <div className={`flex items-center justify-between border-b ${frameBorder} px-3.5 py-2`}>
                  <div className="text-sm font-semibold text-white">{billEditingId ? "Edit bill" : "Add bill"}</div>
                  <button
                    onClick={() => setBillOpen(false)}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-sm ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 p-3.5">
                  <div>
                    <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Name</label>
                    <input
                      value={billDraft.name}
                      onChange={(e) => setBillDraft((d) => ({ ...d, name: e.target.value }))}
                      className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                      placeholder="e.g. Internet"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Due date</label>
                      <div className="relative mt-1">
                        <button
                          type="button"
                          onClick={() => setBillCalendarOpen((v) => !v)}
                          className={`flex w-full items-center justify-between rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                        >
                          <span>{billDraft.due_date ? formatLongDate(billDraft.due_date) : "Select date"}</span>
                          <span className={headingColor}>▾</span>
                        </button>

                        {billCalendarOpen && (
                          <div className={`absolute left-0 top-[44px] z-10 w-[260px] rounded border ${frameBorder} bg-black p-3`}>
                            <div className={`mb-2 flex items-center justify-between text-xs uppercase tracking-[0.5px] ${headingColor}`}>
                              <span>{`${MONTHS[monthIndex]} ${year}`}</span>
                              <button
                                type="button"
                                onClick={() => setBillCalendarOpen(false)}
                                className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                              >
                                ✕
                              </button>
                            </div>

                            <div className={`grid grid-cols-7 gap-1 text-center text-[11px] ${headingColor}`}>
                              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                                <div key={`${d}-${i}`} className="py-1">
                                  {d}
                                </div>
                              ))}
                            </div>

                            {(() => {
                              const firstDow = new Date(year, monthIndex, 1).getDay(); // 0=Sun
                              const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
                              const selectedDay = billDraft.due_date ? Number(billDraft.due_date.slice(-2)) : -1;
                              const cells: (number | null)[] = [];
                              for (let i = 0; i < firstDow; i++) cells.push(null);
                              for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                              while (cells.length % 7 !== 0) cells.push(null);
                              return (
                                <div className="mt-1 grid grid-cols-7 gap-1">
                                  {cells.map((d, i) => {
                                    if (!d) return <div key={`b-${i}`} className="h-8" />;
                                    const isSel = d === selectedDay;
                                    return (
                                      <button
                                        key={d}
                                        type="button"
                                        onClick={() => {
                                          const iso = `${monthKey}-${String(d).padStart(2, "0")}`;
                                          setBillDraft((prev) => ({ ...prev, due_date: iso }));
                                          setBillCalendarOpen(false);
                                        }}
                                        className={`h-8 rounded border text-sm ${
                                          isSel
                                            ? `border-[#00CCCC] bg-[#00CCCC]/10 text-[#00CCCC]`
                                            : `border-transparent bg-white/[0.02] text-white hover:bg-white/[0.04]`
                                        }`}
                                      >
                                        {d}
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className={`block text-xs uppercase tracking-[0.5px] ${headingColor}`}>Amount</label>
                      <input
                        value={billDraft.amount}
                        onChange={(e) => setBillDraft((d) => ({ ...d, amount: e.target.value }))}
                        inputMode="decimal"
                        className={`mt-1 w-full rounded border ${frameBorder} bg-black px-2.5 py-2 text-sm text-white`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className={`text-xs uppercase tracking-[0.5px] ${headingColor}`}>Paid</div>
                    <button
                      type="button"
                      onClick={() => setBillDraft((d) => ({ ...d, paid: !d.paid }))}
                      className={`rounded px-2 py-0.5 text-xs ${
                        billDraft.paid ? "bg-[#00CCCC]/10 text-[#00CCCC]" : "bg-[#ff5555]/10 text-[#ff5555]"
                      }`}
                    >
                      {billDraft.paid ? "Paid" : "Unpaid"}
                    </button>
                  </div>
                </div>

                <div className={`flex items-center justify-end gap-2 border-t ${frameBorder} px-3.5 py-2.5`}>
                  {billEditingId && (
                    <button
                      onClick={() => setBillDeleteConfirmOpen(true)}
                      disabled={billSaving}
                      className={`mr-auto rounded border ${frameBorder} bg-white/[0.02] px-3 py-2 text-sm font-medium text-[#ff5555] hover:bg-white/[0.04] disabled:opacity-50`}
                    >
                      Delete
                    </button>
                  )}
                  <button
                    onClick={() => setBillOpen(false)}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-3 py-2 text-sm font-medium ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setBillConfirmMode(billEditingId ? "edit" : "create");
                      setBillConfirmOpen(true);
                    }}
                    disabled={billSaving}
                    className="rounded bg-[#00CCCC] px-3 py-2 text-sm font-medium text-[#111] disabled:opacity-50"
                  >
                    {billSaving ? "Saving…" : billEditingId ? "Save changes" : "Save bill"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {billConfirmOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
              <div className={`w-full max-w-md rounded border ${frameBorder} bg-black`}>
                <div className={`flex items-center justify-between border-b ${frameBorder} px-3.5 py-2`}>
                  <div className="text-sm font-semibold text-white">
                    {billConfirmMode === "create"
                      ? "Would you like this bill to repeat every month?"
                      : "Would you like to apply this change to all future months?"}
                  </div>
                  <button
                    onClick={() => setBillConfirmOpen(false)}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-sm ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2 p-3.5">
                  <button
                    type="button"
                    onClick={async () => {
                      setBillConfirmOpen(false);
                      await saveBillWithConfirm({ repeat: false, applyToFuture: false });
                    }}
                    className={`w-full rounded border ${frameBorder} bg-white/[0.02] px-3 py-3 text-left text-sm font-medium text-white hover:bg-white/[0.04]`}
                  >
                    This month only
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setBillConfirmOpen(false);
                      await saveBillWithConfirm({
                        repeat: billConfirmMode === "create",
                        applyToFuture: billConfirmMode === "edit",
                      });
                    }}
                    className="w-full rounded bg-[#00CCCC] px-3 py-3 text-left text-sm font-semibold text-[#111]"
                  >
                    {billConfirmMode === "create" ? "Repeat every month" : "Apply to all future months"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {billDeleteConfirmOpen && billEditingId && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
              <div className={`w-full max-w-md rounded border ${frameBorder} bg-black`}>
                <div className={`flex items-center justify-between border-b ${frameBorder} px-3.5 py-2`}>
                  <div className="text-sm font-semibold text-white">Would you like to delete this bill to all future months</div>
                  <button
                    onClick={() => setBillDeleteConfirmOpen(false)}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-sm ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2 p-3.5">
                  <button
                    type="button"
                    onClick={async () => {
                      setBillDeleteConfirmOpen(false);
                      await deleteBillWithConfirm({ allFuture: false });
                    }}
                    className={`w-full rounded border ${frameBorder} bg-white/[0.02] px-3 py-3 text-left text-sm font-medium text-white hover:bg-white/[0.04]`}
                  >
                    This month only
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setBillDeleteConfirmOpen(false);
                      await deleteBillWithConfirm({ allFuture: true });
                    }}
                    className="w-full rounded bg-[#ff5555] px-3 py-3 text-left text-sm font-semibold text-[#111]"
                  >
                    Delete all future months
                  </button>
                </div>
              </div>
            </div>
          )}

          {activePage === "dashboard" && (
            <>
              <div className="mb-[10px] grid gap-[10px] sm:grid-cols-2 lg:grid-cols-4">
              <div className={`rounded border ${frameBorder} bg-[#141414] px-2.5 py-2`}><div className={`mb-1 text-xs uppercase tracking-[0.5px] ${headingColor}`}>Income</div><div className="text-[15px] text-white">{fmt(totalIncome)}</div></div>
                <div className={`rounded border ${frameBorder} bg-[#141414] px-2.5 py-2`}><div className={`mb-1 text-xs uppercase tracking-[0.5px] ${headingColor}`}>Spent</div><div className="text-[15px] text-[#ff5555]">{fmt(totalSpent)}</div></div>
                <div className={`rounded border ${frameBorder} bg-[#141414] px-2.5 py-2`}><div className={`mb-1 text-xs uppercase tracking-[0.5px] ${headingColor}`}>Net</div><div className="text-[15px] text-[#ff5555]">{fmt(totalIncome - totalSpent)}</div></div>
                <div className={`rounded border ${frameBorder} bg-[#141414] px-2.5 py-2`}><div className={`mb-1 text-xs uppercase tracking-[0.5px] ${headingColor}`}>All assets</div><div className="text-[15px] text-[#00CCCC]">{fmt(totalAccountBalance)}</div></div>
              </div>

              <div className="grid gap-[10px] lg:grid-cols-[1fr_1.15fr_0.85fr]">
                <div className="flex flex-col gap-[10px]">
                  <div className={panelClass}>
                    <div className={dashPanelHeaderClass}>
                      <span>Accounts</span>
                      <button
                        type="button"
                        onClick={openAccount}
                        className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-[11px] font-medium ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                      >
                        + Account
                      </button>
                    </div>
                    <div className="px-2.5 py-2">
                      <div className="grid grid-cols-2 gap-[10px]">
                        {orderedAccounts.map((a) => {
                          const lastDate = lastChangeDateByAccountId.get(a.id);
                          const bg = (a as any).color ? ((a as any).color as string) : "#000";
                          const border = "#444747";
                          return (
                            <div
                              key={a.id}
                          className={`rounded border px-2.5 py-2`}
                          style={{
                            backgroundColor: bg,
                            borderColor: border,
                          }}
                            >
                              <div className={`text-xs uppercase tracking-[0.5px] ${itemNameColor}`}>{a.name}</div>
                              <div className="mt-1 text-[15px] text-white">
                                {fmt(balanceByAccountId.get(a.id) ?? a.opening_balance)}
                              </div>
                              <div className={`mt-1 text-xs ${headingColor}`}>
                            Last updated: {lastDate ? formatLongDate(lastDate) : "—"}
                              </div>
                            </div>
                          );
                        })}
                        {orderedAccounts.length % 2 === 1 && (
                          <div aria-hidden className={`rounded border ${frameBorder} bg-black/0 px-2.5 py-2 opacity-0`} />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={panelClass}>
                  <div className={dashPanelHeaderClass}>
                    <span>Savings Goal</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthError(null);
                        setGoalAddDraft({ name: "", goal_amount: "", balance_amount: "", color: "#103544" });
                        setGoalOpen(true);
                      }}
                      className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-[11px] font-medium ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                    >
                      + Goal
                    </button>
                  </div>
                    <div className="p-2.5">
                      <div className="space-y-2">
                        {goals.map((g) => {
                          const goalValue = (() => {
                            const n = Number.parseFloat((g.goal_amount || "").replace(/[฿,]/g, ""));
                            return Number.isFinite(n) && n > 0 ? n : 0;
                          })();
                          const balanceValue = (() => {
                            const n = Number.parseFloat((g.balance_amount || "").replace(/[฿,]/g, ""));
                            return Number.isFinite(n) ? n : 0;
                          })();
                          const pct = goalValue > 0 ? Math.max(0, Math.min(1, balanceValue / goalValue)) : 0;
                          const remaining = Math.max(0, goalValue - balanceValue);

                          return (
                            <div key={g.id} className={`rounded border ${frameBorder} bg-black px-3 py-2`}>
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start gap-2">
                                    <button
                                      type="button"
                                      onClick={() => openGoalEdit(g)}
                                      className={`truncate text-left text-sm font-semibold ${itemNameColor} hover:text-white`}
                                      title="Click to edit"
                                    >
                                      {g.name}
                                    </button>
                                  </div>
                                  <div className="mt-0.5 whitespace-nowrap text-[13px] font-semibold" style={{ color: (g as any).color || "#00CCCC" }}>
                                    {fmt(balanceValue)}
                                    <span className={`ml-1 text-[11px] font-medium ${headingColor}`}>{`/ ${fmt(goalValue)}`}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-1 h-1.5 rounded bg-white/10">
                                <div className="h-full rounded" style={{ width: `${(pct * 100).toFixed(1)}%`, backgroundColor: (g as any).color || "#00CCCC" }} />
                              </div>

                              <div className={`mt-1.5 flex justify-between text-xs ${headingColor}`}>
                                <span>{`${Math.round(pct * 100)}%`}</span>
                                <span>{`${fmt(remaining)} remaining`}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className={panelClass}>
                    <div className={dashPanelHeaderClass}>
                      <span>Bills</span>
                      <div className="flex items-center gap-2">
                        <div className={`text-[11px] font-semibold ${headingColor}`}>{`${paidCount}/${billsMonthly.length}`}</div>
                        <button
                          type="button"
                          onClick={openBill}
                          className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-[11px] font-medium ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                        >
                          + Bill
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-[10px] px-2.5 py-2">
                      {billsMonthly.map((bill, i) => (
                        <div
                          key={`${bill.id}-${i}`}
                          className={`rounded border px-2.5 py-2`}
                          style={{
                            backgroundColor: "#000",
                            borderColor: "#444747",
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className={`truncate text-sm ${itemNameColor}`}>
                                {bill.name} • {fmt(bill.amount)}
                              </div>
                              <div className={`mt-0.5 text-xs ${headingColor}`}>Due {bill.due_date ? formatLongDate(bill.due_date) : "—"}</div>
                            </div>
                            <div className="shrink-0 text-right">
                              <button
                                onClick={() => toggleBill(i)}
                                className={`mt-1 rounded px-2 py-0.5 text-xs ${
                                  bill.paid ? "bg-[#00CCCC]/10 text-[#00CCCC]" : "bg-[#ff5555]/10 text-[#ff5555]"
                                }`}
                              >
                                {bill.paid ? "Paid" : "Unpaid"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-[10px]">
                  <div className={panelClass}>
                    <div className={dashPanelHeaderClass}>
                      <span>Budget by Category</span>
                      <button
                        type="button"
                        onClick={openCategory}
                        className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-[11px] font-medium ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                      >
                        + Category
                      </button>
                    </div>
                    <div className="grid gap-[10px] px-2.5 py-2">
                      {budgetCards.map((b) => {
                        const rem = b.budget - b.spent;
                        const pct = b.budget > 0 ? Math.min(b.spent / b.budget, 1) : 0;
                        const fillColor = resolveExpenseCategoryDisplayColor(b.category);
                        return (
                          <div
                            key={b.category.id}
                            className={`rounded border ${frameBorder} bg-black px-2.5 py-2`}
                            style={undefined}
                          >
                            <div className="flex items-baseline justify-between">
                              <div className={`flex items-center gap-1.5 text-xs uppercase tracking-[0.5px] ${itemNameColor}`}>
                                <CategoryIcon name={b.category.name} />
                                <span>{b.category.name}</span>
                              </div>
                              <div className={`text-sm ${b.spent === 0 ? "text-[#00CCCC]" : "text-[#ff5555]"}`}>{b.spent === 0 ? "—" : fmt(b.spent)}</div>
                            </div>
                            <div className={`mt-1 flex justify-between text-xs ${headingColor}`}>
                              <span>Budget {b.budget === 0 ? "—" : fmt(b.budget)}</span>
                              <span>
                                Remaining <span className="text-white">{fmt(rem)}</span>
                              </span>
                            </div>
                            <div className="mt-2 h-2 rounded bg-white/10">
                              <div className="h-full rounded" style={{ width: `${(pct * 100).toFixed(1)}%`, backgroundColor: fillColor }} />
                            </div>
                            <div className={`mt-1 flex justify-between text-xs ${headingColor}`}>
                              <span>{`${(pct * 100).toFixed(0)}% used`}</span>
                              <span>{`≈ ฿${Math.round(rem / DAYS_LEFT_FALLBACK)}/day`}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-[10px]">
                  <div className={panelClass}>
                    <div className={dashPanelHeaderClass}>Expenses</div>
                    <div className="px-2.5 py-2">
                      {txInMonth.filter((t) => t.type === "expense").map((t) => {
                        const catName = categories.find((c) => c.id === t.category_id)?.name ?? "—";
                        const accName = accounts.find((a) => a.id === t.account_id)?.name ?? "—";
                        return (
                        <div
                          key={t.id}
                          className={`border-b ${frameBorder} py-1.5 text-sm last:border-0`}
                        >
                          <div className="mb-0.5 flex justify-between">
                            <button
                              type="button"
                              onClick={() => openEditExpense(t)}
                              className={`text-left ${itemNameColor} hover:text-white`}
                            >
                              {t.name}
                            </button>
                            <span className="text-[#ff5555]">{fmt(t.amount)}</span>
                          </div>
                          <div className={`flex justify-between text-xs ${headingColor}`}>
                            <CategoryBadge category={catName} />
                            <span>{formatLongDate(t.date)}</span>
                          </div>
                          <div className={`mt-0.5 text-[11px] ${headingColor}`}>{accName}</div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className={panelClass}>
                    <div className={dashPanelHeaderClass}>Income</div>
                    <div className="px-2.5 py-2">
                      {txInMonth.filter((t) => t.type === "income").length === 0 ? (
                        <div className={`p-5 text-center text-sm ${headingColor}`}>No income this month</div>
                      ) : (
                        txInMonth
                          .filter((t) => t.type === "income")
                          .map((t) => {
                            const accName = accounts.find((a) => a.id === t.account_id)?.name ?? "—";
                            return (
                              <div
                                key={t.id}
                                className={`border-b ${frameBorder} py-2 text-sm last:border-0`}
                              >
                                <div className="mb-0.5 flex justify-between">
                                  <button
                                    type="button"
                                    onClick={() => openEditIncome(t)}
                                    className={`text-left ${itemNameColor} hover:text-white`}
                                  >
                                    {t.name}
                                  </button>
                                  <span className="text-[#00CCCC]">{fmt(t.amount)}</span>
                                </div>
                                <div className={`flex justify-between text-xs ${headingColor}`}>
                                  <span>{accName}</span>
                                  <span>{formatLongDate(t.date)}</span>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>

                  <div className={panelClass}>
                    <div className={dashPanelHeaderClass}>Transfers</div>
                    <div className="px-2.5 py-2">
                      {txInMonth.filter((t) => t.type === "transfer").length === 0 ? (
                        <div className={`p-5 text-center text-sm ${headingColor}`}>No transfers this month</div>
                      ) : (
                        txInMonth
                          .filter((t) => t.type === "transfer")
                          .map((t) => {
                            const from = accounts.find((a) => a.id === t.from_account_id)?.name ?? "—";
                            const to = accounts.find((a) => a.id === t.to_account_id)?.name ?? "—";
                            return (
                              <div key={t.id} className={`border-b ${frameBorder} py-2 text-sm last:border-0`}>
                                <div className="mb-0.5 flex justify-between">
                                  <button
                                    type="button"
                                    onClick={() => openEditTransfer(t)}
                                    className={`text-left ${itemNameColor} hover:text-white`}
                                  >
                                    {t.name}
                                  </button>
                                  <span className="text-white">{fmt(t.amount)}</span>
                                </div>
                                <div className={`mt-0.5 flex justify-between text-[11px] ${headingColor}`}>
                                  <span>
                                    <span className="text-[#898989]">From account</span> <span className="text-white/80">{from}</span>
                                  </span>
                                  <span>
                                    <span className="text-[#898989]">To account</span> <span className="text-white/80">{to}</span>
                                  </span>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activePage === "accounts" && (
            <div className="flex flex-col gap-[10px]">
              <div className="grid gap-[10px] sm:grid-cols-3">
                <div className={summaryCardClass}>
                  <div className={`mb-1 text-xs uppercase tracking-[0.5px] ${headingColor}`}>Total income (all time)</div>
                  <div className="text-[15px] text-white">{fmt(0)}</div>
                </div>
                <div className={summaryCardClass}>
                  <div className={`mb-1 text-xs uppercase tracking-[0.5px] ${headingColor}`}>Total expenses (all time)</div>
                  <div className="text-[15px] text-[#ff5555]">{fmt(totalSpent)}</div>
                </div>
                <div className={summaryCardClass}>
                  <div className={`mb-1 text-xs uppercase tracking-[0.5px] ${headingColor}`}>Net balance</div>
                  <div className="text-[15px] text-[#00CCCC]">{fmt(totalAccountBalance)}</div>
                </div>
              </div>

              <div className={panelClass}>
                <div className={panelHeaderClass}>
                  <span>Accounts</span>
                  <button
                    type="button"
                    onClick={openAccount}
                    className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-[11px] font-medium ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                  >
                    + Account
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className={tableHeadRowClass}>
                        <th className="px-2.5 py-2 text-left font-normal">Account</th>
                        <th className="px-2.5 py-2 text-right font-normal">Initial Amount</th>
                        <th className="px-2.5 py-2 text-right font-normal">Balance</th>
                        <th className="px-2.5 py-2 text-right font-normal">Total expense (month)</th>
                        <th className="px-2.5 py-2 text-right font-normal">Last updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderedAccounts.map((a) => {
                        const bal = balanceByAccountId.get(a.id) ?? a.opening_balance;
                        const monthAccExpense = txInMonth
                          .filter((t) => t.type === "expense" && t.account_id === a.id)
                          .reduce((s, t) => s + t.amount, 0);
                        const last = lastChangeDateByAccountId.get(a.id);
                        return (
                          <tr key={a.id} className={`border-b ${frameBorder} last:border-0`}>
                            <td className={`px-2.5 py-2.5 ${itemNameColor}`}>
                              <button type="button" onClick={() => openAccountEdit(a)} className="text-left hover:text-white" title="Click to edit account">
                                {a.name}
                              </button>
                            </td>
                            <td className={`px-2.5 py-2.5 text-right ${itemNameColor}`}>
                              <span className="text-white">{fmt(a.opening_balance)}</span>
                            </td>
                            <td className="px-2.5 py-2.5 text-right text-white">{fmt(bal)}</td>
                            <td className="px-2.5 py-2.5 text-right text-[#ff5555]">{monthAccExpense === 0 ? "—" : fmt(monthAccExpense)}</td>
                            <td className={`px-2.5 py-2.5 text-right ${itemNameColor}`}>{last ? formatLongDate(last) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className={panelClass}>
                <div className={panelHeaderClass}>Transfers</div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className={tableHeadRowClass}>
                        <th className="px-2.5 py-2 text-left font-normal">Name</th>
                        <th className="px-2.5 py-2 text-right font-normal">Date</th>
                        <th className="px-2.5 py-2 text-right font-normal">Amount</th>
                        <th className="px-2.5 py-2 text-right font-normal">From</th>
                        <th className="px-2.5 py-2 text-right font-normal">To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txInMonth
                        .filter((t) => t.type === "transfer")
                        .map((t) => {
                          const from = accounts.find((a) => a.id === t.from_account_id)?.name ?? "—";
                          const to = accounts.find((a) => a.id === t.to_account_id)?.name ?? "—";
                          return (
                            <tr key={t.id} className={`border-b ${frameBorder} last:border-0`}>
                            <td className={`px-2.5 py-2.5 ${itemNameColor}`}>
                              <button type="button" onClick={() => openEditTransfer(t)} className="text-left hover:text-white">
                                {t.name}
                              </button>
                            </td>
                              <td className={`px-2.5 py-2.5 text-right ${itemNameColor}`}>{t.date}</td>
                              <td className="px-2.5 py-2.5 text-right text-[#ff5555]">{fmt(t.amount)}</td>
                              <td className={`px-2.5 py-2.5 text-right ${itemNameColor}`}>{from}</td>
                              <td className={`px-2.5 py-2.5 text-right ${itemNameColor}`}>{to}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activePage === "bills" && (
            <div className="flex flex-col gap-[10px]">
              <div className="grid gap-[10px] sm:grid-cols-3">
                <div className={summaryCardClass}>
                  <div className={`mb-1 text-xs uppercase tracking-[0.5px] ${headingColor}`}>Monthly total</div>
                  <div className="text-[15px] text-[#00CCCC]">{fmt(billsTotal)}</div>
                </div>
                <div className={summaryCardClass}>
                  <div className={`mb-1 text-xs uppercase tracking-[0.5px] ${headingColor}`}>Paid</div>
                  <div className="text-[15px] text-[#00CCCC]">
                    {paidCount} item{paidCount !== 1 ? "s" : ""}
                  </div>
                </div>
                <div className={summaryCardClass}>
                  <div className={`mb-1 text-xs uppercase tracking-[0.5px] ${headingColor}`}>Unpaid</div>
                  <div className="text-[15px] text-[#ff5555]">
                    {unpaidCount} item{unpaidCount !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              <div className={panelClass}>
                <div className={panelHeaderClass}>{`Bills — ${MONTHS[monthIndex]} ${year}`}</div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className={tableHeadRowClass}>
                        <th className="px-2.5 py-2 text-left font-normal">Name</th>
                        <th className="px-2.5 py-2 text-right font-normal">Due</th>
                        <th className="px-2.5 py-2 text-right font-normal">Amount</th>
                        <th className="px-2.5 py-2 text-right font-normal">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billsMonthly.map((bill, i) => {
                        return (
                        <tr key={`${bill.name}-${i}`} className={`border-b ${frameBorder} last:border-0`}>
                          <td className={`px-2.5 py-2.5 text-left ${itemNameColor}`}>
                            <button onClick={() => openEditBillMonthly(bill)} className={`text-left hover:text-white`}>
                              {bill.name}
                            </button>
                          </td>
                          <td className={`px-2.5 py-2.5 text-right ${itemNameColor}`}>
                            {bill.due_date ? formatLongDate(bill.due_date) : "—"}
                          </td>
                          <td className="px-2.5 py-2.5 text-right">
                            <input
                              value={fmt(bill.amount)}
                              onChange={(e) => updateBillAmount(i, e.target.value)}
                              className={`w-[88px] rounded border border-transparent bg-white/[0.02] px-1.5 py-0.5 text-right text-sm text-[#d0d0d0] outline-none focus:border-[#444747] focus:text-white`}
                            />
                          </td>
                          <td className="px-2.5 py-2.5 text-right">
                            <button
                              onClick={() => toggleBill(i)}
                              className={`rounded px-2 py-0.5 text-xs ${
                                bill.paid ? "bg-[#00CCCC]/10 text-[#00CCCC]" : "bg-[#ff5555]/10 text-[#ff5555]"
                              }`}
                            >
                              {bill.paid ? "Paid" : "Unpaid"}
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {activePage === "categories" && (
            <div className="flex flex-col gap-[10px]">
            <div className={panelClass}>
              <div className={panelHeaderClass}>Budget by Category</div>
              <div className="overflow-x-auto">
                <div className="min-w-[860px]">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className={tableHeadRowClass}>
                      <th className="px-2.5 py-2 text-left font-normal">Category</th>
                      <th className="px-2.5 py-2 text-right font-normal">Spent</th>
                      <th className="px-2.5 py-2 text-right font-normal">Monthly Budget</th>
                      <th className="px-2.5 py-2 text-right font-normal">Usage</th>
                      <th className="px-2.5 py-2 text-right font-normal">Remaining</th>
                      <th className="px-2.5 py-2 text-right font-normal">Daily budget</th>
                      <th className="px-2.5 py-2 text-right font-normal">Weekly budget</th>
                      <th className="px-2.5 py-2 text-right font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetCards.map((b) => {
                      const budgetAmt = b.budget;
                      const spentAmt = b.spent;
                      const remaining = budgetAmt - spentAmt;
                      const usedPct = budgetAmt > 0 ? Math.min(spentAmt / budgetAmt, 1) : 0;
                      const usagePctDisplay = budgetAmt > 0 ? usedPct * 100 : null;
                      const warn = usedPct >= 0.85;
                      const fillClass = warn ? "bg-[#ff5555]" : "bg-[#00CCCC]";
                      const dot = resolveExpenseCategoryDisplayColor(b.category);
                      const budgetSharePct = budgetShareDenominator > 0 ? (budgetAmt / budgetShareDenominator) * 100 : 0;
                      return (
                      <tr key={b.category.id} className={`border-b ${frameBorder} last:border-0`}>
                        <td className="px-2.5 py-2.5">
                          <div className="min-w-[160px]">
                            <div className="flex items-center">
                              <span
                                className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: dot }}
                              />
                              <button
                                type="button"
                                onClick={() => openCategoryEdit(b.category)}
                                className="flex flex-1 items-center gap-1.5 text-left"
                                title="Click to edit category"
                              >
                                <CategoryIcon name={b.category.name} />
                                <span className={`${itemNameColor} hover:text-white`}>{b.category.name}</span>
                              </button>
                            </div>
                          </div>
                        </td>
                        <td
                          className={`px-2.5 py-2.5 text-right ${spentAmt === 0 ? "text-[#00CCCC]" : "text-[#ff5555]"}`}
                          onMouseEnter={(e) => {
                            const rect = (e.currentTarget as HTMLTableCellElement).getBoundingClientRect();
                            setHoveredCategory({
                              categoryId: b.category.id,
                              x: Math.min(window.innerWidth - 16, rect.right + 12),
                              y: Math.min(window.innerHeight - 16, rect.top),
                            });
                          }}
                          onMouseLeave={() => setHoveredCategory(null)}
                        >
                          <span className="cursor-default">{spentAmt === 0 ? "฿0" : fmt(spentAmt)}</span>
                        </td>
                        <td className={`px-2.5 py-2.5 text-right ${itemNameColor}`}>
                          {budgetEditCategoryId === b.category.id ? (
                            <div className="flex flex-col items-end gap-1">
                              <input
                                value={budgetEditRaw}
                                onChange={(e) => setBudgetEditRaw(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") commitEditBudget();
                                  if (e.key === "Escape") cancelEditBudget();
                                }}
                                onBlur={() => commitEditBudget()}
                                disabled={budgetEditSaving}
                                placeholder="0.00"
                                className={`w-[120px] rounded border ${frameBorder} bg-black px-2 py-1 text-right text-[11px] text-white outline-none focus:border-[#444747] disabled:opacity-60`}
                                autoFocus
                              />
                              <div className="text-[11px] text-[#898989]">{`${budgetSharePct.toFixed(0)}%`}</div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => beginEditBudget(b.category.id, budgetAmt)}
                              className="flex w-full flex-col items-end leading-tight"
                              title="Click to edit monthly budget"
                            >
                              <div className="text-white">{budgetAmt === 0 ? fmt(0) : fmt(budgetAmt)}</div>
                              <div className="text-[11px] text-[#898989]">{budgetAmt === 0 ? "" : `${budgetSharePct.toFixed(0)}%`}</div>
                            </button>
                          )}
                        </td>
                        <td className="px-2.5 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className={`text-xs ${headingColor}`}>
                              {budgetAmt === 0 ? (
                                "—"
                              ) : (
                                <div className="text-white">{`${usagePctDisplay?.toFixed(0)}%`}</div>
                              )}
                            </div>
                            <MiniDonut pct={budgetAmt > 0 ? usedPct : 0} color={dot} warn={false} />
                          </div>
                        </td>
                        <td className={`px-2.5 py-2.5 text-right text-white`}>{fmt(Math.max(remaining, 0))}</td>
                        {(() => {
                          const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
                          const remSafe = Math.max(remaining, 0);
                          const daily = daysInMonth > 0 ? remSafe / daysInMonth : 0;
                          const weekly = daysInMonth > 0 ? (remSafe * 7) / daysInMonth : 0;
                          return (
                            <>
                              <td className={`px-2.5 py-2.5 text-right ${itemNameColor}`}>{`฿${Math.round(daily)}`}</td>
                              <td className={`px-2.5 py-2.5 text-right ${itemNameColor}`}>{`฿${Math.round(weekly)}`}</td>
                            </>
                          );
                        })()}
                        <td className="px-2.5 py-2.5 text-right">
                          {budgetAmt === 0 ? (
                            <span className={headingColor}>—</span>
                          ) : (
                            <span className={`inline-flex items-center justify-end gap-1.5 text-xs ${warn ? "text-[#ff5555]" : "text-[#00CCCC]"}`}>
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                              <span>{`${fmt(spentAmt)} used`}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2} />
                      <td className="px-2.5 py-2 text-right">
                        {budgetTotalOverrideOpen ? (
                          <input
                            value={budgetTotalOverrideRaw}
                            onChange={(e) => setBudgetTotalOverrideRaw(e.target.value)}
                            placeholder={fmt(budgetCardsTotal)}
                            className={`w-[140px] rounded border ${frameBorder} bg-black px-2 py-1 text-right text-[11px] text-white outline-none focus:border-[#444747]`}
                          />
                        ) : (
                          <button type="button" onClick={() => setBudgetTotalOverrideOpen(true)} className="text-[11px] text-white" title="Click to edit total">
                            {fmt(budgetShareDenominator)}
                          </button>
                        )}
                      </td>
                      <td colSpan={5} />
                    </tr>
                    {budgetTotalOverrideOpen && (
                      <tr>
                        <td colSpan={2} />
                        <td className="px-2.5 pb-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setBudgetTotalOverrideOpen(false)}
                              className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-[11px] ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                            >
                              Done
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setBudgetTotalOverrideRaw("");
                                setBudgetTotalOverrideOpen(false);
                              }}
                              className={`rounded border ${frameBorder} bg-white/[0.02] px-2 py-1 text-[11px] ${headingColor} hover:bg-white/[0.04] hover:text-white`}
                            >
                              Reset
                            </button>
                          </div>
                        </td>
                        <td colSpan={5} />
                      </tr>
                    )}
                  </tfoot>
                </table>
                </div>
              </div>
            </div>

            {hoveredCategory && (
              <div
                className={`pointer-events-none fixed z-50 w-[320px] rounded border ${frameBorder} bg-black px-3 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.55)]`}
                style={{ left: hoveredCategory.x, top: hoveredCategory.y }}
              >
                {(() => {
                  const cat = categories.find((c) => c.id === hoveredCategory.categoryId);
                  const dot = cat ? resolveExpenseCategoryDisplayColor(cat) : "#6b7280";
                  const rows = expensesByCategoryId.get(hoveredCategory.categoryId) ?? [];
                  return (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />
                        <div className={`text-xs uppercase tracking-[0.5px] ${itemNameColor}`}>{cat?.name ?? "Category"}</div>
                      </div>
                      <div className={`mt-2 max-h-[220px] space-y-2 overflow-auto text-sm ${headingColor}`}>
                        {rows.length === 0 ? (
                          <div className="text-xs">No expenses this month.</div>
                        ) : (
                          rows.slice(0, 10).map((t) => (
                            <div key={t.id} className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className={`truncate text-sm ${itemNameColor}`}>{t.name}</div>
                                <div className={`mt-0.5 text-[11px] ${headingColor}`}>{formatLongDate(t.date)}</div>
                              </div>
                              <div className="shrink-0 text-right text-sm text-[#ff5555]">{fmt(t.amount)}</div>
                            </div>
                          ))
                        )}
                        {rows.length > 10 && <div className="text-[11px]">…and {rows.length - 10} more</div>}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            </div>
          )}

          {activePage === "expenses" && (
            <div className="flex flex-col gap-[10px]">
              <div className="grid gap-[10px] sm:grid-cols-3">
                <div className={summaryCardClass}>
                  <div className={`mb-1 text-xs uppercase tracking-[0.5px] ${headingColor}`}>Total expense (this month)</div>
                  <div className="text-[15px] text-[#ff5555]">{fmt(monthSpent)}</div>
                </div>
              </div>
              <div className="grid items-start gap-[10px] lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
                <div className={panelClass}>
                  <div className={panelHeaderClass}>Expenses</div>
                  <div className="overflow-x-auto">
                    <table className="w-full max-w-full border-collapse text-sm">
                      <thead>
                        <tr className={tableHeadRowClass}>
                          <th className="px-2 py-2 text-left font-normal">Name</th>
                          <th className="px-2 py-2 text-right font-normal">Amount</th>
                          <th className="px-2 py-2 text-right font-normal">Date</th>
                          <th className="hidden px-2 py-2 text-right font-normal sm:table-cell">Category</th>
                          <th className="hidden px-2 py-2 text-right font-normal md:table-cell">Account</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txInMonth
                          .filter((t) => t.type === "expense")
                          .map((t) => {
                            const acc = accounts.find((a) => a.id === t.account_id)?.name ?? "—";
                            const cat = categories.find((c) => c.id === t.category_id)?.name ?? "—";
                            return (
                              <tr key={t.id} className={`border-b ${frameBorder} last:border-0`}>
                                <td className={`max-w-[140px] truncate px-2 py-1.5 ${itemNameColor}`}>
                                  <button onClick={() => openEditExpense(t)} className="text-left hover:text-white">
                                    {t.name}
                                  </button>
                                </td>
                                <td className="whitespace-nowrap px-2 py-1.5 text-right text-[#ff5555]">{fmt(t.amount)}</td>
                                <td className={`whitespace-nowrap px-2 py-1.5 text-right ${itemNameColor}`}>{formatLongDate(t.date)}</td>
                                <td className={`hidden px-2 py-1.5 text-right sm:table-cell`}>
                                  <span className="flex justify-end">
                                    <CategoryBadge category={cat} />
                                  </span>
                                </td>
                                <td className={`hidden px-2 py-1.5 text-right md:table-cell ${itemNameColor}`}>{acc}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <ExpenseDonutChart
                  segments={expenseDonutSegments.map(({ label, amount, color }) => ({ label, amount, color }))}
                  total={monthSpent}
                />
              </div>
            </div>
          )}

          {activePage === "income" && (
            <div className="flex flex-col gap-[10px]">
              <div className="grid gap-[10px] sm:grid-cols-3">
                <div className={summaryCardClass}>
                  <div className={`mb-1 text-xs uppercase tracking-[0.5px] ${headingColor}`}>Total income (this month)</div>
                  <div className="text-[15px] text-[#00CCCC]">{fmt(monthIncome)}</div>
                </div>
              </div>

              <div className={panelClass}>
                <div className={panelHeaderClass}>Income</div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className={tableHeadRowClass}>
                        <th className="px-2.5 py-2 text-left font-normal">Name</th>
                        <th className="px-2.5 py-2 text-right font-normal">Amount</th>
                        <th className="px-2.5 py-2 text-right font-normal">Date</th>
                        <th className="px-2.5 py-2 text-right font-normal">Account</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txInMonth.filter((t) => t.type === "income").length === 0 ? (
                        <tr>
                          <td colSpan={4} className={`px-2.5 py-6 text-center text-sm ${headingColor}`}>
                            No income this month
                          </td>
                        </tr>
                      ) : (
                        txInMonth
                          .filter((t) => t.type === "income")
                          .map((t) => {
                            const acc = accounts.find((a) => a.id === t.account_id)?.name ?? "—";
                            return (
                              <tr key={t.id} className={`border-b ${frameBorder} last:border-0`}>
                                <td className={`px-2.5 py-2.5 ${itemNameColor}`}>
                                  <button type="button" onClick={() => openEditIncome(t)} className="text-left hover:text-white">
                                    {t.name}
                                  </button>
                                </td>
                                <td className="px-2.5 py-2.5 text-right text-[#00CCCC]">{fmt(t.amount)}</td>
                                <td className={`px-2.5 py-2.5 text-right ${itemNameColor}`}>{formatLongDate(t.date)}</td>
                                <td className={`px-2.5 py-2.5 text-right ${itemNameColor}`}>{acc}</td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {hoveredExpenseDonut && (
            <div
              className={`pointer-events-none fixed z-50 w-fit max-w-[280px] rounded border ${frameBorder} bg-black px-3 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.55)]`}
              style={{ left: hoveredExpenseDonut.x, top: hoveredExpenseDonut.y }}
            >
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: hoveredExpenseDonut.color }} />
                <div className={`text-xs uppercase tracking-[0.5px] ${itemNameColor}`}>{hoveredExpenseDonut.label}</div>
              </div>
              <div className="mt-1 text-sm font-semibold text-[#ff5555]">{fmt(hoveredExpenseDonut.amount)}</div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
