/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import {
  Trash2,
  Plus,
} from "lucide-react";

const DOC_PATH = { col: "teams", id: "team_default" };
const MIN_MONTH = "2025-11";

const SalesManagementSheet = () => {
  const loadDataFallback = () => [
    { id: 1, date: "2025-01-06", staff: "山田太郎", sales: 50000, cost: 15000, memo: "" },
  ];
  const loadStaffFallback = () => ["山田太郎"];

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

  useEffect(() => {
    const ref = doc(db, DOC_PATH.col, DOC_PATH.id);
    const unsub = onSnapshot(ref, { includeMetadataChanges: true }, async (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return; 

      if (!snap.exists()) {
        try {
          isApplyingRemote.current = true;
          const now = Date.now();
          await setDoc(ref, { staffList: loadStaffFallback(), salesData: loadDataFallback(), updatedAt: now });
          isApplyingRemote.current = false;
          hasHydrated.current = true;
          setSyncStatus("synced");
        } catch (e) { setSyncStatus("error"); isApplyingRemote.current = false; }
        return;
      }
      try {
        const d = snap.data() || {};
        const remoteUpdatedAt = Number(d.updatedAt || 0);
        if (remoteUpdatedAt && remoteUpdatedAt < lastLocalWriteAt.current) return;
        isApplyingRemote.current = true;
        setStaffList(Array.isArray(d.staffList) ? d.staffList : loadStaffFallback());
        setDataRows(Array.isArray(d.salesData) ? d.salesData : loadDataFallback());
        isApplyingRemote.current = false;
        hasHydrated.current = true;
        setSyncStatus("synced");
      } catch (e) { setSyncStatus("error"); isApplyingRemote.current = false; }
    });
    return () => unsub();
  }, []);

  const writeToFirestore = async (nextStaffList, nextDataRows) => {
    const ref = doc(db, DOC_PATH.col, DOC_PATH.id);
    const now = Date.now();
    lastLocalWriteAt.current = now;
    await setDoc(ref, { staffList: nextStaffList, salesData: nextDataRows, updatedAt: now }, { merge: true });
  };

  const scheduleSave = () => {
    if (!hasHydrated.current || isApplyingRemote.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await writeToFirestore(staffList, dataRows); setSyncStatus("synced"); } catch (e) { setSyncStatus("error"); }
    }, 500);
  };

  useEffect(() => { scheduleSave(); }, [staffList, dataRows]);

  const addStaff = () => {
    const name = newStaffName.trim();
    if (!name || staffList.includes(name)) { setNewStaffName(""); return; }
    setStaffList([...staffList, name]);
    setNewStaffName("");
  };

  const removeStaff = (name) => {
    if (window.confirm(`${name}を削除しますか?`)) setStaffList(staffList.filter(s => s !== name));
  };

  const addRow = () => {
    const uid = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setDataRows([...dataRows, { id: uid, date: selectedMonth + "-01", staff: "", sales: 0, cost: 0, memo: "" }]);
  };

  const updateRow = (id, field, value) => {
    setDataRows(dataRows.map(row => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const deleteRow = (id) => setDataRows(dataRows.filter(row => row.id !== id));

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

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans text-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl md:text-2xl font-black">営業チーム売上管理</h1>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${syncStatus === "synced" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
              {syncStatus === "synced" ? "同期OK" : "同期中"}
            </span>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-2 py-1 border rounded text-sm bg-white">
              {availableMonths.map(m => <option key={m} value={m}>{m.replace("-", "/")}月</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-1 mb-6 border-b overflow-x-auto">
          <button onClick={() => setActiveTab("data")} className={`px-4 py-2 text-sm font-bold ${activeTab === "data" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400"}`}>📊 入力</button>
          <button onClick={() => setActiveTab("paystub")} className={`px-4 py-2 text-sm font-bold ${activeTab === "paystub" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400"}`}>🗂 明細</button>
          <button onClick={() => setActiveTab("dashboard")} className={`px-4 py-2 text-sm font-bold ${activeTab === "dashboard" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400"}`}>📈 指標</button>
          <button onClick={() => setActiveTab("settings")} className={`px-4 py-2 text-sm font-bold ${activeTab === "settings" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400"}`}>⚙️ 管理</button>
        </div>

        {activeTab === "paystub" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(memberPaystubs).map(([name, stub]) => (
              <div key={name} className="bg-white rounded-lg shadow border overflow-hidden">
                <div className="bg-blue-600 p-3 text-white">
                  <h3 className="font-bold">{name} 様</h3>
                  <p className="text-[10px] opacity-80">{selectedMonth} 支払明細</p>
                </div>
                <div className="p-3 space-y-1 max-h-48 overflow-y-auto text-sm">
                  {stub.items.map((item, i) => (
                    <div key={i} className="flex justify-between border-b py-1">
                      <span className="text-gray-500">{item.date.slice(5)}</span>
                      <span className="font-medium">¥{item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-blue-50 p-3 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-blue-800">月計</span>
                    <span className="text-lg font-black text-blue-700">¥{stub.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "data" && (
          <div className="bg-white rounded-lg shadow p-4 overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold">{selectedMonth}月分入力</h2>
              <button onClick={addRow} className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1"><Plus size={14} />追加</button>
            </div>
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="p-2 text-left">日付</th><th className="p-2 text-left">担当</th><th className="p-2 text-right">売上</th><th className="p-2 text-right">人件費</th><th className="p-2 text-right bg-blue-50">粗利</th><th className="p-2 text-left">備考</th><th className="p-2 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="p-1"><input type="date" value={row.date} onChange={(e) => updateRow(row.id, "date", e.target.value)} className="w-full p-1 border rounded" /></td>
                      <td className="p-1"><select value={row.staff} onChange={(e) => updateRow(row.id, "staff", e.target.value)} className="w-full p-1 border rounded"><option value="">選択</option>{staffList.map(s => <option key={s} value={s}>{s}</option>)}</select></td>
                      <td className="p-1"><input type="number" value={row.sales} onChange={(e) => updateRow(row.id, "sales", Number(e.target.value))} className="w-full p-1 border rounded text-right" /></td>
                      <td className="p-1"><input type="number" value={row.cost} onChange={(e) => updateRow(row.id, "cost", Number(e.target.value))} className="w-full p-1 border rounded text-right" /></td>
                      <td className="p-1 text-right font-bold text-blue-600 bg-blue-50">¥{(row.sales - row.cost).toLocaleString()}</td>
                      <td className="p-1 relative"><textarea value={row.memo || ""} onChange={(e) => updateRow(row.id, "memo", e.target.value)} className="w-full p-1 border rounded h-8 focus:h-24 transition-all bg-white resize-none" /></td>
                      <td className="p-1 text-center"><button onClick={() => deleteRow(row.id)} className="text-red-300 hover:text-red-500"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "dashboard" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-bold text-white">
            <div className="bg-blue-500 p-4 rounded-lg shadow"><h4>売上計</h4><p className="text-2xl">¥{totalSales.toLocaleString()}</p></div>
            <div className="bg-orange-500 p-4 rounded-lg shadow"><h4>支払計</h4><p className="text-2xl">¥{totalCost.toLocaleString()}</p></div>
            <div className="bg-green-500 p-4 rounded-lg shadow"><h4>利益計</h4><p className="text-2xl">¥{totalProfit.toLocaleString()}</p></div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="font-bold mb-4">メンバー管理</h2>
            <div className="flex gap-2 mb-4"><input type="text" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addStaff()} placeholder="名前" className="flex-1 p-2 border rounded" /><button onClick={addStaff} className="bg-green-600 text-white px-4 py-1 rounded">追加</button></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{staffList.map(s => <div key={s} className="flex justify-between p-2 bg-gray-50 border rounded text-sm"><span>{s}</span><button onClick={() => removeStaff(s)} className="text-red-400">×</button></div>)}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesManagementSheet;
