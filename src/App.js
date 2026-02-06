/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import {
  Calendar,
  UserPlus,
  Trash2,
  Plus,
  DollarSign,
  Users,
  TrendingUp,
  FileText,
} from "lucide-react";

const DOC_PATH = { col: "teams", id: "team_default" };
const MIN_MONTH = "2025-11";

const SalesManagementSheet = () => {
  // ----------------------------
  // Local initial loaders (fallback)
  // ----------------------------
  const loadDataFallback = () => [
    { id: 1, date: "2026-02-01", staff: "後藤陽喜", sales: 16000, cost: 13000, memo: "" },
    { id: 2, date: "2026-02-01", staff: "坂田優希", sales: 16000, cost: 13000, memo: "" },
  ];

  const loadStaffFallback = () => [
    "後藤陽喜",
    "坂田優希",
    "林侑吾",
    "斉藤洋斗",
    "松田弘之",
    "東桂木光希",
  ];

  // ----------------------------
  // State
  // ----------------------------
  const [activeTab, setActiveTab] = useState("data");

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return ym < MIN_MONTH ? MIN_MONTH : ym;
  });

  const [staffList, setStaffList] = useState(loadStaffFallback);
  const [newStaffName, setNewStaffName] = useState("");
  const [dataRows, setDataRows] = useState(loadDataFallback);

  const [syncStatus, setSyncStatus] = useState("connecting");
  const isApplyingRemote = useRef(false);
  const saveTimer = useRef(null);
  const hasHydrated = useRef(false);
  const lastLocalWriteAt = useRef(0);

  // ----------------------------
  // Firestore: realtime load
  // ----------------------------
  useEffect(() => {
    const ref = doc(db, DOC_PATH.col, DOC_PATH.id);
    const unsub = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      async (snap) => {
        if (snap.metadata.hasPendingWrites) return;

        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
          return; 
        }

        if (!snap.exists()) {
          try {
            isApplyingRemote.current = true;
            const now = Date.now();
            await setDoc(ref, {
              staffList: loadStaffFallback(),
              salesData: loadDataFallback(),
              updatedAt: now,
            });
            isApplyingRemote.current = false;
            hasHydrated.current = true;
            setSyncStatus("synced");
            return;
          } catch (e) {
            console.error(e);
            setSyncStatus("error");
            isApplyingRemote.current = false;
            return;
          }
        }

        try {
          const d = snap.data() || {};
          const remoteUpdatedAt = Number(d.updatedAt || 0);
          if (remoteUpdatedAt && remoteUpdatedAt < lastLocalWriteAt.current) {
            return;
          }
          const remoteStaff = Array.isArray(d.staffList) ? d.staffList : loadStaffFallback();
          const remoteRows = Array.isArray(d.salesData) ? d.salesData : loadDataFallback();

          isApplyingRemote.current = true;
          setStaffList(remoteStaff);
          setDataRows(remoteRows);
          isApplyingRemote.current = false;
          hasHydrated.current = true;
          setSyncStatus("synced");
        } catch (e) {
          console.error(e);
          setSyncStatus("error");
          isApplyingRemote.current = false;
        }
      },
      (err) => {
        console.error(err);
        setSyncStatus("error");
      }
    );
    return () => unsub();
  }, []);

  const writeToFirestore = async (nextStaffList, nextDataRows) => {
    const ref = doc(db, DOC_PATH.col, DOC_PATH.id);
    const now = Date.now();
    lastLocalWriteAt.current = now;
    await setDoc(
      ref,
      {
        staffList: nextStaffList,
        salesData: nextDataRows,
        updatedAt: now,
      },
      { merge: true }
    );
  };

  const scheduleSave = () => {
    if (!hasHydrated.current) return;
    if (isApplyingRemote.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await writeToFirestore(staffList, dataRows);
        setSyncStatus("synced");
      } catch (e) {
        console.error(e);
        setSyncStatus("error");
      }
    }, 500);
  };

  useEffect(() => {
    scheduleSave();
  }, [staffList, dataRows]);

  const addStaff = async () => {
    const name = newStaffName.trim();
    if (!name || staffList.includes(name)) { setNewStaffName(""); return; }
    const next = [...staffList, name];
    setStaffList(next);
    setNewStaffName("");
  };

  const removeStaff = async (staffName) => {
    if (!window.confirm(`${staffName}を削除しますか?`)) return;
    setStaffList(staffList.filter((s) => s !== staffName));
  };

  const addRow = () => {
    const uid = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setDataRows((prev) => [
      ...prev,
      { id: uid, date: selectedMonth + "-01", staff: "", sales: 0, cost: 0, memo: "" },
    ]);
  };

  const deleteRow = (id) => {
    setDataRows(dataRows.filter((row) => row.id !== id));
  };

  const updateRow = (id, field, value) => {
    setDataRows(
      dataRows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const calculateProfit = (sales, cost) => sales - cost;

  const generateMonths = () => {
    const months = [];
    const [minY, minM] = MIN_MONTH.split("-").map(Number);
    const start = new Date(minY, minM - 1, 1);
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 18, 1);
    const cur = new Date(start);
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, "0");
      months.push(`${y}-${m}`);
      cur.setMonth(cur.getMonth() + 1);
    }
    return months.reverse();
  };

  const availableMonths = useMemo(() => generateMonths(), []);

  const monthlyData = useMemo(() => {
    const filtered = dataRows.filter((row) => String(row.date || "").startsWith(selectedMonth));
    filtered.sort((a, b) => {
      const da = String(a.date || "");
      const db_ = String(b.date || "");
      if (da !== db_) return da.localeCompare(db_);
      const sa = String(a.staff || "");
      const sb = String(b.staff || "");
      if (sa !== sb) return sa.localeCompare(sb);
      return Number(a.id) - Number(b.id);
    });
    return filtered;
  }, [dataRows, selectedMonth]);

  // --- 明細集計ロジック ---
  const memberPaystubs = useMemo(() => {
    const stubs = {};
    monthlyData.forEach(row => {
      if (!row.staff) return;
      if (!stubs[row.staff]) stubs[row.staff] = { items: [], total: 0 };
      stubs[row.staff].items.push({ date: row.date, amount: Number(row.cost) });
      stubs[row.staff].total += Number(row.cost);
    });
    return stubs;
  }, [monthlyData]);

  const totalSales = monthlyData.reduce((sum, row) => sum + Number(row.sales), 0);
  const totalCost = monthlyData.reduce((sum, row) => sum + Number(row.cost), 0);
  const totalProfit = totalSales - totalCost;

  const staffStats = {};
  monthlyData.forEach((row) => {
    if (!row.staff) return;
    if (!staffStats[row.staff]) staffStats[row.staff] = { profit: 0, days: 0 };
    staffStats[row.staff].profit += calculateProfit(Number(row.sales), Number(row.cost));
    staffStats[row.staff].days += 1;
  });

  const ranking = Object.entries(staffStats)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.profit - a.profit);

  const uniqueDates = [...new Set(monthlyData.map((row) => row.date))].sort();
  const uniqueStaff = [...new Set(monthlyData.map((row) => row.staff))].filter(Boolean);

  const getProfit = (date, staff) => {
    const row = monthlyData.find((r) => r.date === date && r.staff === staff);
    return row ? calculateProfit(Number(row.sales), Number(row.cost)) : null;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold text-gray-800">営業チーム売上管理</h1>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-1 rounded-full border ${syncStatus === "synced" ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}`}>
              {syncStatus === "synced" ? "同期OK" : "同期中…"}
            </span>
            <Calendar className="text-gray-600" size={20} />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 bg-white"
            >
              {availableMonths.map((month) => (
                <option key={month} value={month}>{month.split("-")[0]}年{month.split("-")[1]}月</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto scrollbar-hide">
          <button onClick={() => setActiveTab("data")} className={`px-6 py-3 font-semibold whitespace-nowrap ${activeTab === "data" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600"}`}>📊 入力</button>
          <button onClick={() => setActiveTab("paystub")} className={`px-6 py-3 font-semibold whitespace-nowrap ${activeTab === "paystub" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600"}`}>📁 明細</button>
          <button onClick={() => setActiveTab("dashboard")} className={`px-6 py-3 font-semibold whitespace-nowrap ${activeTab === "dashboard" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600"}`}>📈 指標</button>
          <button onClick={() => setActiveTab("settings")} className={`px-6 py-3 font-semibold whitespace-nowrap ${activeTab === "settings" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600"}`}>⚙️ 管理</button>
        </div>

        {activeTab === "paystub" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {Object.keys(memberPaystubs).length === 0 ? (
              <p className="text-gray-500 col-span-full text-center py-20 font-bold">この月の支払データはありません。</p>
            ) : (
              Object.entries(memberPaystubs).map(([name, stub]) => (
                <div key={name} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">
                  <div className="bg-blue-600 p-4 text-white">
                    <h3 className="text-xl font-bold">{name} 様</h3>
                    <p className="text-sm opacity-90">{selectedMonth.replace("-", "/")} 支払内訳明細</p>
                  </div>
                  <div className="p-4 flex-1 space-y-2 max-h-64 overflow-y-auto">
                    {stub.items.map((item, i) => (
                      <div key={i} className="flex justify-between border-b border-gray-50 py-2 text-sm">
                        <span className="text-gray-600 font-medium">{item.date.slice(5).replace("-", "/")}</span>
                        <span className="font-bold text-gray-800">¥{item.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-gray-50 p-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-700">月計</span>
                      <span className="text-2xl font-black text-blue-600">¥{stub.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "data" && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-700">{selectedMonth.replace("-", "/")}月分入力</h2>
              <button onClick={addRow} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"><Plus size={20} />追加</button>
            </div>
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left">日付</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">担当</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">売上</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">人件費</th>
                    <th className="border border-gray-300 px-4 py-2 text-right bg-yellow-50">粗利</th>
                    <th className="border border-gray-300 px-4 py-2 text-left w-64">備考</th>
                    <th className="border border-gray-300 px-4 py-2 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-2"><input type="date" value={row.date} onChange={(e) => updateRow(row.id, "date", e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                      <td className="border border-gray-300 px-2 py-2">
                        <select value={row.staff} onChange={(e) => updateRow(row.id, "staff", e.target.value)} className="w-full px-2 py-1 border rounded">
                          <option value="">選択してください</option>
                          {staffList.map((s) => (<option key={s} value={s}>{s}</option>))}
                        </select>
                      </td>
                      <td className="border border-gray-300 px-2 py-2"><input type="number" value={row.sales} onChange={(e) => updateRow(row.id, "sales", Number(e.target.value))} className="w-full px-2 py-1 border rounded text-right" /></td>
                      <td className="border border-gray-300 px-2 py-2"><input type="number" value={row.cost} onChange={(e) => updateRow(row.id, "cost", Number(e.target.value))} className="w-full px-2 py-1 border rounded text-right" /></td>
                      <td className="border border-gray-300 px-4 py-2 text-right font-bold bg-yellow-50 text-blue-600">¥{(row.sales - row.cost).toLocaleString()}</td>
                      <td className="border border-gray-300 px-2 py-2 relative h-[50px]">
                        <textarea
                          value={row.memo || ""}
                          onChange={(e) => updateRow(row.id, "memo", e.target.value)}
                          placeholder="備考を入力..."
                          className="absolute inset-x-2 top-2 h-8 w-[calc(100%-16px)] px-2 py-1 border border-gray-300 rounded text-sm transition-all duration-200 resize-none overflow-hidden focus:h-32 focus:z-20 focus:overflow-y-auto focus:shadow-xl bg-white"
                        />
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center"><button onClick={() => deleteRow(row.id)} className="text-red-400 hover:text-red-600"><Trash2 size={18} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center gap-3 mb-2"><DollarSign size={32} /><h3 className="text-lg font-semibold">月間売上合計</h3></div>
                <p className="text-4xl font-bold">¥{totalSales.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center gap-3 mb-2"><Users size={32} /><h3 className="text-lg font-semibold">月間人件費合計</h3></div>
                <p className="text-4xl font-bold">¥{totalCost.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center gap-3 mb-2"><TrendingUp size={32} /><h3 className="text-lg font-semibold">月間粗利合計</h3></div>
                <p className="text-4xl font-bold">¥{totalProfit.toLocaleString()}</p>
                <p className="text-sm mt-2 opacity-90">利益率: {totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0}%</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center gap-2 mb-4"><Users size={24} className="text-purple-600" /><h3 className="text-xl font-bold text-gray-700">メンバーランキング</h3></div>
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-100"><th className="px-2 py-2 text-left">順位</th><th className="px-2 py-2 text-left">担当者</th><th className="px-2 py-2 text-right">粗利</th><th className="px-2 py-2 text-right">日数</th></tr></thead>
                  <tbody>{ranking.map((item, index) => (<tr key={item.name} className="border-b hover:bg-gray-50"><td className="px-2 py-3 font-bold text-gray-600">{index + 1}</td><td className="px-2 py-3">{item.name}</td><td className="px-2 py-3 text-right font-bold text-green-600">¥{item.profit.toLocaleString()}</td><td className="px-2 py-3 text-right text-gray-600">{item.days}日</td></tr>))}</tbody>
                </table>
              </div>
              <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6 overflow-x-auto">
                <h3 className="text-xl font-bold text-gray-700 mb-4">日別×担当者 粗利マトリクス</h3>
                <table className="w-full border-collapse text-sm">
                  <thead><tr className="bg-gray-100"><th className="border border-gray-300 px-3 py-2 sticky left-0 bg-gray-100">日付</th>{uniqueStaff.map((staff) => (<th key={staff} className="border border-gray-300 px-3 py-2 text-center">{staff}</th>))}</tr></thead>
                  <tbody>{uniqueDates.map((date) => (<tr key={date} className="hover:bg-gray-50"><td className="border border-gray-300 px-3 py-2 font-semibold sticky left-0 bg-white">{date.slice(5).replace("-", "/")}</td>{uniqueStaff.map((staff) => {const profit = getProfit(date, staff);return (<td key={`${date}-${staff}`} className="border border-gray-300 px-3 py-2 text-right">{profit !== null ? (<span className="text-green-600 font-bold">¥{profit.toLocaleString()}</span>) : (<span className="text-gray-300">-</span>)}</td>);})}</tr>))}</tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-700 mb-4">担当者リスト管理</h2>
            <div className="flex gap-2 mb-4">
              <input type="text" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addStaff()} placeholder="名前を入力" className="flex-1 px-4 py-2 border rounded-lg" />
              <button onClick={addStaff} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors">追加</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {staffList.map((staff) => (
                <div key={staff} className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg border">
                  <span className="font-medium text-gray-700">{staff}</span>
                  <button onClick={() => removeStaff(staff)} className="text-red-400 hover:text-red-600"><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesManagementSheet;
