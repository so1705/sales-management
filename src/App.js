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
} from "lucide-react";

const DOC_PATH = { col: "teams", id: "team_default" };

// 今の年月を "YYYY-MM" で返す（ローカル時間）
const getCurrentMonthKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const SalesManagementSheet = () => {
  // ----------------------------
  // Local initial loaders (fallback)
  // ----------------------------
  const loadDataFallback = () => [
    { id: 1, date: "2025-01-06", staff: "山田太郎", sales: 50000, cost: 15000 },
    { id: 2, date: "2025-01-06", staff: "佐藤花子", sales: 45000, cost: 15000 },
    { id: 3, date: "2025-01-06", staff: "鈴木一郎", sales: 60000, cost: 18000 },
    { id: 4, date: "2025-01-07", staff: "山田太郎", sales: 55000, cost: 15000 },
    { id: 5, date: "2025-01-07", staff: "田中美咲", sales: 48000, cost: 15000 },
    { id: 6, date: "2025-01-08", staff: "佐藤花子", sales: 52000, cost: 15000 },
    { id: 7, date: "2025-01-08", staff: "鈴木一郎", sales: 58000, cost: 18000 },
    { id: 8, date: "2025-01-08", staff: "田中美咲", sales: 51000, cost: 15000 },
  ];

  const loadStaffFallback = () => [
    "山田太郎",
    "佐藤花子",
    "鈴木一郎",
    "田中美咲",
    "高橋健太",
    "伊藤由美",
  ];

  // ----------------------------
  // State
  // ----------------------------
  const [activeTab, setActiveTab] = useState("data");

  // 起動時は「今の年月」を開く
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());

  const [staffList, setStaffList] = useState(loadStaffFallback);
  const [newStaffName, setNewStaffName] = useState("");
  const [dataRows, setDataRows] = useState(loadDataFallback);

  // Firestore sync status
  const [syncStatus, setSyncStatus] = useState("connecting"); // connecting | synced | error
  const isApplyingRemote = useRef(false);
  const saveTimer = useRef(null);

  // ★ 初回のFirestore読み込みが完了するまで保存させないためのフラグ
  const hasLoadedRemote = useRef(false);

  // ----------------------------
  // Firestore: realtime load (onSnapshot)
  // ----------------------------
  useEffect(() => {
    const ref = doc(db, DOC_PATH.col, DOC_PATH.id);

    const unsub = onSnapshot(
      ref,
      async (snap) => {
        // 初回: ドキュメントが無い場合は作成
        if (!snap.exists()) {
          try {
            isApplyingRemote.current = true;
            await setDoc(ref, {
              staffList: loadStaffFallback(),
              salesData: loadDataFallback(),
              updatedAt: Date.now(),
            });
            isApplyingRemote.current = false;

            // ★ ここで「読み込み完了扱い」にして保存を許可
            hasLoadedRemote.current = true;

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
          const d = snap.data();
          const remoteStaff = Array.isArray(d.staffList) ? d.staffList : loadStaffFallback();
          const remoteRows = Array.isArray(d.salesData) ? d.salesData : loadDataFallback();

          isApplyingRemote.current = true;
          setStaffList(remoteStaff);
          setDataRows(remoteRows);
          isApplyingRemote.current = false;

          // ★ ここで初回読み込み完了
          hasLoadedRemote.current = true;

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

  // ----------------------------
  // Firestore: save (debounced)
  // ----------------------------
  const scheduleSave = () => {
    // ★ 初回の読み込みが終わるまで保存しない（リセット原因の根本対策）
    if (!hasLoadedRemote.current) return;

    if (isApplyingRemote.current) return;

    // debounce
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const ref = doc(db, DOC_PATH.col, DOC_PATH.id);
        await setDoc(
          ref,
          {
            staffList,
            salesData: dataRows,
            updatedAt: Date.now(),
          },
          { merge: true }
        );
        setSyncStatus("synced");
      } catch (e) {
        console.error(e);
        setSyncStatus("error");
      }
    }, 500);
  };

  useEffect(() => {
    scheduleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffList, dataRows]);

  // ----------------------------
  // Helpers
  // ----------------------------
  const addStaff = () => {
    const name = newStaffName.trim();
    if (name && !staffList.includes(name)) {
      setStaffList([...staffList, name]);
      setNewStaffName("");
    }
  };

  const removeStaff = (staffName) => {
    if (window.confirm(`${staffName}を削除しますか?`)) {
      setStaffList(staffList.filter((s) => s !== staffName));
    }
  };

  const addRow = () => {
    const newId = Math.max(...dataRows.map((r) => r.id), 0) + 1;
    setDataRows([
      ...dataRows,
      {
        id: newId,
        date: selectedMonth + "-01",
        staff: "",
        sales: 0,
        cost: 0,
      },
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

  // ----------------------------
  // Month list
  // 2025-11 未満を全部消す（= 2025-11 から表示）
  // ----------------------------
  const generateMonths = () => {
    const months = [];

    const start = new Date(2025, 10, 1); // 2025-11-01（月は0始まりなので10=11月）
    const end = new Date(2026, 11, 1);   // 2026-12-01（必要なら伸ばせる）

    let cur = new Date(start);
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
  // selectedMonth が「一覧に無い月」なら、最も近い（最新）に合わせる
  // （例: 今が2027年などになった時でも落ちないよう保険）
  // ----------------------------
  useEffect(() => {
    if (!availableMonths.includes(selectedMonth)) {
      // 今月が一覧に無い場合は、一覧の先頭（= 最新月）を選ぶ
      setSelectedMonth(availableMonths[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableMonths]);

  // ----------------------------
  // Filter + SORT by date automatically (important)
  // ----------------------------
  const monthlyData = useMemo(() => {
    const filtered = dataRows.filter((row) => String(row.date || "").startsWith(selectedMonth));
    // 日付昇順 → 同じ日付なら staff → さらに id
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

  // Monthly totals
  const totalSales = monthlyData.reduce((sum, row) => sum + Number(row.sales), 0);
  const totalCost = monthlyData.reduce((sum, row) => sum + Number(row.cost), 0);
  const totalProfit = totalSales - totalCost;

  // Ranking by staff
  const staffStats = {};
  monthlyData.forEach((row) => {
    if (!row.staff) return;
    if (!staffStats[row.staff]) {
      staffStats[row.staff] = { profit: 0, days: 0 };
    }
    staffStats[row.staff].profit += calculateProfit(Number(row.sales), Number(row.cost));
    staffStats[row.staff].days += 1;
  });

  const ranking = Object.entries(staffStats)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.profit - a.profit);

  // Daily matrix
  const uniqueDates = [...new Set(monthlyData.map((row) => row.date))].sort();
  const uniqueStaff = [...new Set(monthlyData.map((row) => row.staff))].filter(Boolean);

  const getProfit = (date, staff) => {
    const row = monthlyData.find((r) => r.date === date && r.staff === staff);
    return row ? calculateProfit(Number(row.sales), Number(row.cost)) : null;
  };

  // ----------------------------
  // UI
  // ----------------------------
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold text-gray-800">
            営業チーム売上管理システム
          </h1>

          <div className="flex items-center gap-3">
            <span
              className={`text-xs px-2 py-1 rounded-full border ${
                syncStatus === "synced"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : syncStatus === "connecting"
                  ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                  : "bg-red-50 text-red-700 border-red-200"
              }`}
              title="Firestore同期状態"
            >
              {syncStatus === "synced"
                ? "同期OK"
                : syncStatus === "connecting"
                ? "同期中…"
                : "同期エラー"}
            </span>

            <Calendar className="text-gray-600" size={20} />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 bg-white"
            >
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {month.split("-")[0]}年{month.split("-")[1]}月
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("data")}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === "data"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            📊 data (入力用)
          </button>
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === "dashboard"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            📈 dashboard (ダッシュボード)
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === "settings"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            ⚙️ settings (担当者管理)
          </button>
        </div>

        {activeTab === "settings" && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-700 mb-4">担当者リスト管理</h2>

            <div className="mb-6">
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addStaff()}
                  placeholder="新しい担当者名を入力"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                />
                <button
                  onClick={addStaff}
                  className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <UserPlus size={20} />
                  追加
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {staffList.map((staff) => (
                <div
                  key={staff}
                  className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg border border-gray-200"
                >
                  <span className="font-medium text-gray-700">{staff}</span>
                  <button
                    onClick={() => removeStaff(staff)}
                    className="text-red-600 hover:text-red-800 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "data" && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-700">
                データ入力シート - {selectedMonth.split("-")[0]}年{selectedMonth.split("-")[1]}月
              </h2>
              <button
                onClick={addRow}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={20} />
                行を追加
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left">日付</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">担当者名</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">売上</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">人件費</th>
                    <th className="border border-gray-300 px-4 py-2 text-right bg-yellow-50">
                      粗利 (自動)
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-center">削除</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-2">
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) => updateRow(row.id, "date", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                        />
                      </td>
                      <td className="border border-gray-300 px-2 py-2">
                        <select
                          value={row.staff}
                          onChange={(e) => updateRow(row.id, "staff", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                        >
                          <option value="">選択してください</option>
                          {staffList.map((staff) => (
                            <option key={staff} value={staff}>
                              {staff}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-300 px-2 py-2">
                        <input
                          type="number"
                          value={row.sales}
                          onChange={(e) => updateRow(row.id, "sales", Number(e.target.value))}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-right"
                        />
                      </td>
                      <td className="border border-gray-300 px-2 py-2">
                        <input
                          type="number"
                          value={row.cost}
                          onChange={(e) => updateRow(row.id, "cost", Number(e.target.value))}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-right"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right font-semibold bg-yellow-50">
                        ¥{calculateProfit(Number(row.sales), Number(row.cost)).toLocaleString()}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        <button
                          onClick={() => deleteRow(row.id)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="text-xs text-gray-500 mt-3">
                ※日付を編集すると自動で日付順に並び替わります（同日なら担当者名→ID順）。
              </p>
            </div>
          </div>
        )}

        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign size={32} />
                  <h3 className="text-lg font-semibold">月間売上合計</h3>
                </div>
                <p className="text-4xl font-bold">¥{totalSales.toLocaleString()}</p>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <Users size={32} />
                  <h3 className="text-lg font-semibold">月間人件費合計</h3>
                </div>
                <p className="text-4xl font-bold">¥{totalCost.toLocaleString()}</p>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp size={32} />
                  <h3 className="text-lg font-semibold">月間粗利合計</h3>
                </div>
                <p className="text-4xl font-bold">¥{totalProfit.toLocaleString()}</p>
                <p className="text-sm mt-2 opacity-90">
                  利益率: {totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users size={24} className="text-purple-600" />
                  <h3 className="text-xl font-bold text-gray-700">メンバーランキング</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-100 text-sm">
                      <th className="px-2 py-2 text-left">順位</th>
                      <th className="px-2 py-2 text-left">担当者</th>
                      <th className="px-2 py-2 text-right">粗利</th>
                      <th className="px-2 py-2 text-right">日数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((item, index) => (
                      <tr key={item.name} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-2 py-3 font-bold text-gray-600">{index + 1}</td>
                        <td className="px-2 py-3">{item.name}</td>
                        <td className="px-2 py-3 text-right font-semibold text-green-600">
                          ¥{item.profit.toLocaleString()}
                        </td>
                        <td className="px-2 py-3 text-right text-gray-600">{item.days}日</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6 overflow-x-auto">
                <h3 className="text-xl font-bold text-gray-700 mb-4">日別×担当者 粗利マトリクス</h3>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-3 py-2 sticky left-0 bg-gray-100">
                        日付
                      </th>
                      {uniqueStaff.map((staff) => (
                        <th key={staff} className="border border-gray-300 px-3 py-2 text-center">
                          {staff}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {uniqueDates.map((date) => (
                      <tr key={date} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-3 py-2 font-semibold sticky left-0 bg-white">
                          {date}
                        </td>
                        {uniqueStaff.map((staff) => {
                          const profit = getProfit(date, staff);
                          return (
                            <td
                              key={`${date}-${staff}`}
                              className="border border-gray-300 px-3 py-2 text-right"
                            >
                              {profit !== null ? (
                                <span className="text-green-600 font-semibold">
                                  ¥{profit.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesManagementSheet;
