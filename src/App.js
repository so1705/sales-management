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
  Download,
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const DOC_PATH = { col: "teams", id: "team_default" };
const MIN_MONTH = "2025-11";
const COMPANY_NAME = "森平心"; // 発行者名

const SalesManagementSheet = () => {
  // ----------------------------
  // State
  // ----------------------------
  const [activeTab, setActiveTab] = useState("data");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return ym < MIN_MONTH ? MIN_MONTH : ym;
  });

  const loadDataFallback = () => [
    { id: 1, date: "2026-02-01", staff: "後藤陽喜", sales: 16000, cost: 13000, memo: "" },
    { id: 2, date: "2026-02-01", staff: "坂田優希", sales: 16000, cost: 13000, memo: "" },
  ];

  const loadStaffFallback = () => [
    "後藤陽喜", "坂田優希", "林侑吾", "斉藤洋斗", "松田弘之", "東桂木光希",
  ];

  const [staffList, setStaffList] = useState(loadStaffFallback);
  const [newStaffName, setNewStaffName] = useState("");
  const [dataRows, setDataRows] = useState(loadDataFallback);
  const [syncStatus, setSyncStatus] = useState("connecting");

  const isApplyingRemote = useRef(false);
  const saveTimer = useRef(null);
  const hasHydrated = useRef(false);
  const lastLocalWriteAt = useRef(0); // 同期バグ防止用のタイムスタンプ
  const pdfTemplateRef = useRef(null);

  // PDF出力用のデータ保持
  const [pdfData, setPdfData] = useState({ name: "", items: [], total: 0 });

  // ----------------------------
  // Helper functions
  // ----------------------------
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

  // ----------------------------
  // PDF出力ロジック
  // ----------------------------
  const exportPDF = async (staffName) => {
    const element = pdfTemplateRef.current;
    if (!element) return;

    element.style.display = "block";

    try {
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, Math.min(pdfHeight, 297));
      pdf.save(`${selectedMonth}_支払明細書_${staffName}.pdf`);
    } catch (error) {
      console.error("PDF Export Error:", error);
    } finally {
      element.style.display = "none";
    }
  };

  // ----------------------------
  // Firestore連携 & 同期バグ対策
  // ----------------------------
  useEffect(() => {
    const ref = doc(db, DOC_PATH.col, DOC_PATH.id);
    const unsub = onSnapshot(ref, { includeMetadataChanges: true }, async (snap) => {
        if (snap.metadata.hasPendingWrites) return;
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;
        
        if (!snap.exists()) {
          try {
            isApplyingRemote.current = true;
            await setDoc(ref, { staffList: loadStaffFallback(), salesData: loadDataFallback(), updatedAt: Date.now() });
            isApplyingRemote.current = false;
            hasHydrated.current = true;
            setSyncStatus("synced");
          } catch (e) { setSyncStatus("error"); }
          return;
        }

        const d = snap.data() || {};
        const remoteUpdatedAt = Number(d.updatedAt || 0);

        // 重要: 自分の最新の書き込みより古いデータが届いたら無視する
        if (remoteUpdatedAt && remoteUpdatedAt < lastLocalWriteAt.current) return;

        isApplyingRemote.current = true;
        setStaffList(Array.isArray(d.staffList) ? d.staffList : loadStaffFallback());
        setDataRows(Array.isArray(d.salesData) ? d.salesData : loadDataFallback());
        isApplyingRemote.current = false;
        hasHydrated.current = true;
        setSyncStatus("synced");
      }, (err) => setSyncStatus("error")
    );
    return () => unsub();
  }, []);

  // 自動保存ロジック
  useEffect(() => {
    if (!hasHydrated.current || isApplyingRemote.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    
    saveTimer.current = setTimeout(async () => {
      try {
        const ref = doc(db, DOC_PATH.col, DOC_PATH.id);
        const now = Date.now();
        // 保存直前にタイムスタンプを更新
        lastLocalWriteAt.current = now;

        await setDoc(ref, { 
          staffList, 
          salesData: dataRows, 
          updatedAt: now 
        }, { merge: true });

        setSyncStatus("synced");
      } catch (e) { 
        console.error(e);
        setSyncStatus("error"); 
      }
    }, 500);
  }, [staffList, dataRows]);

  // ----------------------------
  // 各種操作ロジック
  // ----------------------------
  const addStaff = () => {
    const name = newStaffName.trim();
    if (!name || staffList.includes(name)) { setNewStaffName(""); return; }
    
    // 追加した瞬間にタイムスタンプを更新して同期上書きをブロック
    lastLocalWriteAt.current = Date.now();
    setStaffList((prev) => [...prev, name]);
    setNewStaffName("");
  };

  const removeStaff = (name) => {
    if (window.confirm(`${name}を削除しますか?`)) {
      lastLocalWriteAt.current = Date.now();
      setStaffList(staffList.filter(s => s !== name));
    }
  };

  const addRow = () => {
    const uid = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setDataRows([...dataRows, { id: uid, date: selectedMonth + "-01", staff: "", sales: 0, cost: 0, memo: "" }]);
  };

  const updateRow = (id, field, value) => {
    setDataRows(dataRows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const deleteRow = (id) => setDataRows(dataRows.filter(row => row.id !== id));

  // ----------------------------
  // 集計用ロジック
  // ----------------------------
  const monthlyData = useMemo(() => {
    return dataRows
      .filter(row => String(row.date || "").startsWith(selectedMonth))
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

  const totalSales = monthlyData.reduce((sum, r) => sum + Number(r.sales), 0);
  const totalCost = monthlyData.reduce((sum, r) => sum + Number(r.cost), 0);
  const totalProfit = totalSales - totalCost;

  const staffStats = {};
  monthlyData.forEach(row => {
    if (!row.staff) return;
    if (!staffStats[row.staff]) staffStats[row.staff] = { profit: 0, days: 0 };
    staffStats[row.staff].profit += (Number(row.sales) - Number(row.cost));
    staffStats[row.staff].days += 1;
  });

  const ranking = Object.entries(staffStats).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.profit - a.profit);
  const uniqueDates = [...new Set(monthlyData.map(r => r.date))].sort();
  const uniqueStaff = [...new Set(monthlyData.map(r => r.staff))].filter(Boolean);

  // ----------------------------
  // UI Render
  // ----------------------------
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* --- PDF出力用隠しコンポーネント --- */}
      <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
        <div 
          ref={pdfTemplateRef} 
          className="bg-white p-16 text-gray-800" 
          style={{ width: "210mm", minHeight: "297mm", fontFamily: "sans-serif" }}
        >
          <div className="flex justify-between items-start mb-16">
            <div>
              <h1 className="text-4xl font-bold tracking-[0.2em] text-gray-900 mb-10">支払明細書</h1>
              <div className="text-xl border-b-2 border-gray-800 pb-1 w-80">
                <span className="font-bold">{pdfData.name}</span> 様
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm mb-1">発行日: {new Date().toLocaleDateString('ja-JP')}</p>
              <p className="font-bold text-xl">{COMPANY_NAME}</p>
            </div>
          </div>

          <div className="mb-10">
            <p className="text-sm mb-3">下記の通り、お支払い内容をご通知申し上げます。</p>
            <div className="bg-gray-50 p-6 flex justify-between items-center border-y-2 border-gray-800">
              <span className="text-lg font-bold">お支払い合計金額</span>
              <span className="text-3xl font-black">¥{pdfData.total.toLocaleString()}-</span>
            </div>
          </div>

          {/* 金額項目を「給料」に変更し、備考を削除 */}
          <table className="w-full border-collapse border border-gray-400 mb-10">
            <thead>
              <tr className="bg-gray-100 text-gray-800">
                <th className="border border-gray-400 p-3 text-sm">日付</th>
                <th className="border border-gray-400 p-3 text-sm text-right">給料</th>
              </tr>
            </thead>
            <tbody>
              {pdfData.items.map((item, idx) => (
                <tr key={idx} className="border border-gray-400">
                  <td className="border border-gray-400 p-3 text-center text-sm">{item.date.replace(/-/g, "/")}</td>
                  <td className="border border-gray-400 p-3 text-right text-sm font-medium">¥{item.amount.toLocaleString()}</td>
                </tr>
              ))}
              {[...Array(Math.max(0, 10 - pdfData.items.length))].map((_, i) => (
                <tr key={`empty-${i}`} className="border border-gray-400 h-11">
                  <td className="border border-gray-400"></td>
                  <td className="border border-gray-400"></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-bold">
                <td className="border border-gray-400 p-3 text-right">合計金額</td>
                <td className="border border-gray-400 p-3 text-right text-lg text-blue-600">¥{pdfData.total.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
          <div className="text-xs text-gray-400 mt-20 border-t pt-4">
            ※本明細書の内容についてご不明な点がございましたら、森平までご連絡ください。
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* メインヘッダー */}
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold text-gray-800">営業チーム売上管理</h1>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-1 rounded-full border transition-colors ${syncStatus === "synced" ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}`}>
              {syncStatus === "synced" ? "同期OK" : "同期中…"}
            </span>
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

        {/* タブメニュー */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto scrollbar-hide">
          <button onClick={() => setActiveTab("data")} className={`px-6 py-3 font-semibold whitespace-nowrap ${activeTab === "data" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600"}`}>📊 入力</button>
          <button onClick={() => setActiveTab("paystub")} className={`px-6 py-3 font-semibold whitespace-nowrap ${activeTab === "paystub" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600"}`}>📁 明細</button>
          <button onClick={() => setActiveTab("dashboard")} className={`px-6 py-3 font-semibold whitespace-nowrap ${activeTab === "dashboard" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600"}`}>📈 指標</button>
          <button onClick={() => setActiveTab("settings")} className={`px-6 py-3 font-semibold whitespace-nowrap ${activeTab === "settings" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600"}`}>⚙️ 管理</button>
        </div>

        {/* 📁 明細タブ */}
        {activeTab === "paystub" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {Object.keys(memberPaystubs).length === 0 ? (
              <p className="text-gray-500 col-span-full text-center py-20 font-bold">この月の支払データはありません。</p>
            ) : (
              Object.entries(memberPaystubs).map(([name, stub]) => (
                <div key={name} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">
                  <div className="bg-blue-600 p-4 text-white flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold">{name} 様</h3>
                      <p className="text-sm opacity-90">{selectedMonth.replace("-", "/")} 支払内訳</p>
                    </div>
                    <button 
                      onClick={async () => {
                        await setPdfData({ name, items: stub.items, total: stub.total });
                        setTimeout(() => exportPDF(name), 100);
                      }}
                      className="p-2 bg-white/20 hover:bg-white/40 rounded-full transition-all"
                      title="明細書をPDF出力"
                    >
                      <Download size={20} />
                    </button>
                  </div>
                  <div className="p-4 flex-1 space-y-2 max-h-64 overflow-y-auto bg-white">
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

        {/* 📊 入力タブ */}
        {activeTab === "data" && (
          <div className="bg-white rounded-lg shadow-md p-6 text-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{selectedMonth.replace("-", "/")}月分入力</h2>
              <button onClick={addRow} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"><Plus size={20} />追加</button>
            </div>
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-700">
                    <th className="border border-gray-300 px-4 py-2 text-left">日付</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">担当</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">売上</th>
                    <th className="border border-gray-300 px-4 py-2 text-right font-bold">人件費</th>
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
                      <td className="border border-gray-300 px-2 py-2"><input type="number" value={row.cost} onChange={(e) => updateRow(row.id, "cost", Number(e.target.value))} className="w-full px-2 py-1 border rounded text-right font-bold text-blue-600" /></td>
                      <td className="border border-gray-300 px-4 py-2 text-right font-bold bg-yellow-50">¥{(row.sales - row.cost).toLocaleString()}</td>
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

        {/* 📈 指標タブ */}
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-gray-700">
               <div className="bg-white rounded-lg shadow-md p-6">
                 <div className="flex items-center gap-2 mb-4"><Users size={24} className="text-purple-600" /><h3 className="text-xl font-bold">メンバーランキング</h3></div>
                 <table className="w-full text-sm">
                   <thead><tr className="bg-gray-100"><th className="px-2 py-2 text-left">順位</th><th className="px-2 py-2 text-left">担当者</th><th className="px-2 py-2 text-right">粗利</th><th className="px-2 py-2 text-right">日数</th></tr></thead>
                   <tbody>{ranking.map((item, index) => (<tr key={item.name} className="border-b hover:bg-gray-50"><td className="px-2 py-3 font-bold">{index + 1}</td><td className="px-2 py-3">{item.name}</td><td className="px-2 py-3 text-right font-bold text-green-600">¥{item.profit.toLocaleString()}</td><td className="px-2 py-3 text-right">{item.days}日</td></tr>))}</tbody>
                 </table>
               </div>
               <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6 overflow-x-auto">
                 <h3 className="text-xl font-bold mb-4 text-gray-700">日別×担当者 粗利マトリクス</h3>
                 <table className="w-full border-collapse text-sm">
                   <thead><tr className="bg-gray-100 text-gray-700"><th className="border border-gray-300 px-3 py-2 sticky left-0 bg-gray-100">日付</th>{uniqueStaff.map((s) => (<th key={s} className="border border-gray-300 px-3 py-2 text-center">{s}</th>))}</tr></thead>
                   <tbody>{uniqueDates.map((date) => (<tr key={date} className="hover:bg-gray-50"><td className="border border-gray-300 px-3 py-2 font-semibold sticky left-0 bg-white text-gray-700">{date.slice(5).replace("-", "/")}</td>{uniqueStaff.map((staff) => {const row = monthlyData.find(r => r.date === date && r.staff === staff);return (<td key={`${date}-${staff}`} className="border border-gray-300 px-3 py-2 text-right">{row ? (<span className="text-green-600 font-bold">¥{(row.sales-row.cost).toLocaleString()}</span>) : (<span className="text-gray-300">-</span>)}</td>);})}</tr>))}</tbody>
                 </table>
               </div>
            </div>
          </div>
        )}

        {/* ⚙️ 管理タブ */}
        {activeTab === "settings" && (
          <div className="bg-white rounded-lg shadow-md p-6 text-gray-700">
            <h2 className="text-xl font-bold mb-4">担当者リスト管理</h2>
            <div className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={newStaffName} 
                onChange={(e) => setNewStaffName(e.target.value)} 
                onKeyDown={(e) => e.key === "Enter" && addStaff()} 
                placeholder="新しいインターン生の名前を入力" 
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              />
              <button onClick={addStaff} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition-colors">追加</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {staffList.map((staff) => (
                <div key={staff} className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg border">
                  <span className="font-medium text-gray-700">{staff}</span>
                  <button onClick={() => removeStaff(staff)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
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
