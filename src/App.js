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
  // 初期データ（Firestoreが空の場合の予備）
  // ----------------------------
  const loadDataFallback = () => [
    { id: 1, date: "2025-01-06", staff: "山田太郎", sales: 50000, cost: 15000, memo: "" },
  ];
  const loadStaffFallback = () => ["山田太郎"];

  // ----------------------------
  // ステート管理
  // ----------------------------
  const [activeTab, setActiveTab] = useState("data");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
  // Firestore 同期ロジック (バグ対策済み)
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
          isApplyingRemote.current = true;
          setStaffList(Array.isArray(d.staffList) ? d.staffList : loadStaffFallback());
          setDataRows(Array.isArray(d.salesData) ? d.salesData : loadDataFallback());
          isApplyingRemote.current = false;
          hasHydrated.current = true;
          setSyncStatus("synced");
        } catch (e) {
          setSyncStatus("error");
          isApplyingRemote.current = false;
        }
      },
      (err) => setSyncStatus("error")
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const writeToFirestore = async (nextStaffList, nextDataRows) => {
    const ref = doc(db, DOC_PATH.col, DOC_PATH.id);
    const now = Date.now();
    lastLocalWriteAt.current = now;
    await setDoc(
      ref,
      { staffList: nextStaffList, salesData: nextDataRows, updatedAt: now },
      { merge: true }
    );
  };

  const scheduleSave = () => {
    if (!hasHydrated.current || isApplyingRemote.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await writeToFirestore(staffList, dataRows);
        setSyncStatus("synced");
      } catch (e) {
        setSyncStatus("error");
      }
    }, 500);
  };

  useEffect(() => {
    scheduleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffList, dataRows]);

  // ----------------------------
  // ヘルパー関数
  // ----------------------------
  const addStaff = () => {
    const name = newStaffName.trim();
    if (!name || staffList.includes(name)) { setNewStaffName(""); return; }
    setStaffList([...staffList, name]);
    setNewStaffName("");
  };

  const removeStaff = (name) => {
    if (window.confirm(`${name}を削除しますか?`)) {
      setStaffList(staffList.filter(s => s !== name));
    }
  };

  const addRow = () => {
    const uid = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setDataRows([...dataRows, { id: uid, date: selectedMonth + "-01", staff: "", sales: 0, cost: 0, memo: "" }]);
  };

  const updateRow = (id, field, value) => {
    setDataRows(dataRows.map(row => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const deleteRow = (id) => setDataRows(dataRows.filter(row => row.id !== id));

  // ----------------------------
  // データ集計 (明細・ダッシュボード用)
  // ----------------------------
  const availableMonths = useMemo(() => {
    const months = [];
    const [minY, minM] = MIN_MONTH.split("-").map(Number);
    const start = new Date(minY, minM - 1, 1);
    const end = new Date(new Date().getFullYear(), new Date().getMonth() + 18, 1);
    const cur = new Date(start);
    while (cur <= end) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
      cur.setMonth(cur.getMonth() + 1);
    }
    return months.reverse();
  }, []);

  const monthlyData = useMemo(() => {
    return dataRows
      .filter((row) => String(row.date || "").startsWith(selectedMonth))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [dataRows, selectedMonth]);

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

  // ----------------------------
  // UI レンダリング
  // ----------------------------
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">営業チーム売上管理システム</h1>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-1 rounded-full border ${syncStatus === "synced" ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}`}>
              {syncStatus === "synced" ? "同期OK" : "同期中…"}
            </span>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm">
              {availableMonths.map(m => <option key={m} value={m}>{m.replace("-", "年")}月</option>)}
            </select>
          </div>
        </div>

        {/* タブ切り替え */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto scrollbar-hide">
          <button onClick={() => setActiveTab("data")} className={`px-4 py-3 whitespace-nowrap font-semibold ${activeTab === "data" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}>📊 data</button>
          <button onClick={() => setActiveTab("paystub")} className={`px-4 py-3 whitespace-nowrap font-semibold ${activeTab === "paystub" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}>🗂 paystub (明細)</button>
          <button onClick={() => setActiveTab("dashboard")} className={`px-4 py-3 whitespace-nowrap font-semibold ${activeTab === "dashboard" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}>📈 dashboard</button>
          <button onClick={() => setActiveTab("settings")} className={`px-4 py-3 whitespace-nowrap font-semibold ${activeTab === "settings" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}>⚙️ settings</button>
        </div>

        {/* 明細タブ (Paystub) */}
        {activeTab === "paystub" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {Object.keys(memberPaystubs).length === 0 ? (
              <p className="text-gray-500 col-span-full text-center py-20">この月の支払データはありません。</p>
            ) : (
              Object.entries(memberPaystubs).map(([name, stub]) => (
                <div key={name} className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden flex flex-col">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-4 text-white">
                    <h3 className="text-lg font-bold">{name} 様</h3>
                    <p className="text-xs opacity-80">{selectedMonth.replace("-", "年")}月 支払内訳明細</p>
                  </div>
                  <div className="p-4 flex-1 space-y-2 max-h-72 overflow-y-auto">
                    {stub.items.map((item, i) => (
                      <div key={i} className="flex justify-between border-b border-gray-50 py-2 text-sm">
                        <span className="text-gray-500">{item.date.split("-")[1]}/{item.date.split("-")[2]}</span>
                        <span className="font-semibold text-gray-700">¥{item.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-blue-50 p-4 border-t border-blue-100">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-blue-800">月間合計額</span>
                      <span className="text-xl font-black text-blue-700">¥{stub.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 入力データタブ */}
        {activeTab === "data" && (
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-700">入力シート: {selectedMonth}</h2>
              <button onClick={addRow} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-blue-700"><Plus size={16} />行を追加</button>
            </div>
            <div className="overflow-x-auto min-h-[450px]">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border-b border-gray-200 p-3 text-left">日付</th>
                    <th className="border-b border-gray-200 p-3 text-left">担当者</th>
                    <th className="border-b border-gray-200 p-3 text-right">売上</th>
                    <th className="border-b border-gray-200 p-3 text-right">人件費</th>
                    <th className="border-b border-gray-200 p-3 text-right text-blue-600 bg-blue-50">粗利</th>
                    <th className="border-b border-gray-200 p-3 text-left w-64">備考</th>
                    <th className="border-b border-gray-200 p-3 text-center">削除</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-2"><input type="date" value={row.date} onChange={(e) => updateRow(row.id, "date", e.target.value)} className="w-full p-1 border rounded" /></td>
                      <td className="p-2"><select value={row.staff} onChange={(e) => updateRow(row.id, "staff", e.target.value)} className="w-full p-1 border rounded"><option value="">選択</option>{staffList.map(s => <option key={s} value={s}>{s}</option>)}</select></td>
                      <td className="p-2"><input type="number" value={row.sales} onChange={(e) => updateRow(row.id, "sales", Number(e.target.value))} className="w-full p-1 border rounded text-right" /></td>
                      <td className="p-2"><input type="number" value={row.cost} onChange={(e) => updateRow(row.id, "cost", Number(e.target.value))} className="w-full p-1 border rounded text-right" /></td>
                      <td className="p-2 text-right font-bold text-blue-600 bg-blue-50">¥{(row.sales - row.cost).toLocaleString()}</td>
                      <td className="p-2 relative h-[50px]"><textarea value={row.memo || ""} onChange={(e) => updateRow(row.id, "memo", e.target.value)} className="absolute inset-x-2 top-2 h-8 w-[calc(100%-16px)] p-1 border rounded text-xs focus:h-32 focus:z-20 transition-all bg-white resize-none" placeholder="..." /></td>
                      <td className="p-2 text-center"><button onClick={() => deleteRow(row.id)} className="text-red-400 hover:text-red-600"><Trash2 size={18} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ダッシュボードタブ */}
        {activeTab === "dashboard" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-blue-500"><h4 className="text-gray-500 text-sm font-bold">売上合計</h4><p className="text-3xl font-black text-gray-800">¥{totalSales.toLocaleString()}</p></div>
            <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-orange-500"><h4 className="text-gray-500 text-sm font-bold">人件費合計</h4><p className="text-3xl font-black text-gray-800">¥{totalCost.toLocaleString()}</p></div>
            <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-green-500"><h4 className="text-gray-500 text-sm font-bold">粗利合計</h4><p className="text-3xl font-black text-gray-800">¥{totalProfit.toLocaleString()}</p></div>
          </div>
        )}

        {/* 設定タブ */}
        {activeTab === "settings" && (
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-lg font-bold mb-4">メンバー管理</h2>
            <div className="flex gap-2 mb-6"><input type="text" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addStaff()} placeholder="名前を入力" className="flex-1 p-2 border rounded-lg" /><button onClick={addStaff} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold">追加</button></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{staffList.map(s => <div key={s} className="flex justify-between p-3 bg-gray-50 border rounded-lg"><span>{s}</span><button onClick={() => removeStaff(s)} className="text-red-500"><Trash2 size={18} /></button></div>)}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesManagementSheet;
