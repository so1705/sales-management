import React, { useState, useEffect } from 'react';
import {
  Calendar, UserPlus, Trash2, Plus, DollarSign, Users, TrendingUp
} from 'lucide-react';


const SalesManagementSheet = () => {
  // ローカルストレージからデータを読み込む
  const loadData = () => {
    const saved = localStorage.getItem('salesData');
    if (saved) {
      return JSON.parse(saved);
    }
    return [
      { id: 1, date: '2025-01-06', staff: '山田太郎', sales: 50000, cost: 15000 },
      { id: 2, date: '2025-01-06', staff: '佐藤花子', sales: 45000, cost: 15000 },
      { id: 3, date: '2025-01-06', staff: '鈴木一郎', sales: 60000, cost: 18000 },
      { id: 4, date: '2025-01-07', staff: '山田太郎', sales: 55000, cost: 15000 },
      { id: 5, date: '2025-01-07', staff: '田中美咲', sales: 48000, cost: 15000 },
      { id: 6, date: '2025-01-08', staff: '佐藤花子', sales: 52000, cost: 15000 },
      { id: 7, date: '2025-01-08', staff: '鈴木一郎', sales: 58000, cost: 18000 },
      { id: 8, date: '2025-01-08', staff: '田中美咲', sales: 51000, cost: 15000 },
    ];
  };

  const loadStaff = () => {
    const saved = localStorage.getItem('staffList');
    if (saved) {
      return JSON.parse(saved);
    }
    return ['山田太郎', '佐藤花子', '鈴木一郎', '田中美咲', '高橋健太', '伊藤由美'];
  };

  const [activeTab, setActiveTab] = useState('data');
  const [selectedMonth, setSelectedMonth] = useState('2025-01');
  const [staffList, setStaffList] = useState(loadStaff);
  const [newStaffName, setNewStaffName] = useState('');
  const [dataRows, setDataRows] = useState(loadData);

  // データが変更されたら自動保存
  useEffect(() => {
    localStorage.setItem('salesData', JSON.stringify(dataRows));
  }, [dataRows]);

  useEffect(() => {
    localStorage.setItem('staffList', JSON.stringify(staffList));
  }, [staffList]);

  const addStaff = () => {
    if (newStaffName.trim() && !staffList.includes(newStaffName.trim())) {
      setStaffList([...staffList, newStaffName.trim()]);
      setNewStaffName('');
    }
  };

  const removeStaff = (staffName) => {
    if (window.confirm(`${staffName}を削除しますか?`)) {
      setStaffList(staffList.filter(s => s !== staffName));
    }
  };

  const addRow = () => {
    const newId = Math.max(...dataRows.map(r => r.id), 0) + 1;
    setDataRows([...dataRows, {
      id: newId,
      date: selectedMonth + '-01',
      staff: '',
      sales: 0,
      cost: 0
    }]);
  };

  const deleteRow = (id) => {
    setDataRows(dataRows.filter(row => row.id !== id));
  };

  const updateRow = (id, field, value) => {
    setDataRows(dataRows.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  const calculateProfit = (sales, cost) => sales - cost;

  // Filter data by selected month
  const monthlyData = dataRows.filter(row => {
    return row.date.startsWith(selectedMonth);
  });

  // Generate months for 3 years (2024-2026)
  const generateMonths = () => {
    const months = [];
    for (let year = 2024; year <= 2026; year++) {
      for (let month = 1; month <= 12; month++) {
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;
        months.push(monthStr);
      }
    }
    return months.reverse();
  };
  
  const availableMonths = generateMonths();

  // Monthly totals
  const totalSales = monthlyData.reduce((sum, row) => sum + Number(row.sales), 0);
  const totalCost = monthlyData.reduce((sum, row) => sum + Number(row.cost), 0);
  const totalProfit = totalSales - totalCost;

  // Ranking by staff
  const staffStats = {};
  monthlyData.forEach(row => {
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
  const uniqueDates = [...new Set(monthlyData.map(row => row.date))].sort();
  const uniqueStaff = [...new Set(monthlyData.map(row => row.staff))];

  const getProfit = (date, staff) => {
    const row = monthlyData.find(r => r.date === date && r.staff === staff);
    return row ? calculateProfit(Number(row.sales), Number(row.cost)) : null;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">営業チーム売上管理システム</h1>
          
          <div className="flex items-center gap-3">
            <Calendar className="text-gray-600" size={20} />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 bg-white"
            >
              {availableMonths.map(month => (
                <option key={month} value={month}>
                  {month.split('-')[0]}年{month.split('-')[1]}月
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('data')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'data'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📊 data (入力用)
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'dashboard'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📈 dashboard (ダッシュボード)
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'settings'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            ⚙️ settings (担当者管理)
          </button>
        </div>

        {activeTab === 'settings' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-700 mb-4">担当者リスト管理</h2>
            
            <div className="mb-6">
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addStaff()}
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
              {staffList.map(staff => (
                <div key={staff} className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg border border-gray-200">
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

        {activeTab === 'data' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-700">
                データ入力シート - {selectedMonth.split('-')[0]}年{selectedMonth.split('-')[1]}月
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
                    <th className="border border-gray-300 px-4 py-2 text-right bg-yellow-50">粗利 (自動)</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">削除</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map(row => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-2 py-2">
                        <input
                          type="date"
                          value={row.date}
                          onChange={(e) => updateRow(row.id, 'date', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                        />
                      </td>
                      <td className="border border-gray-300 px-2 py-2">
                        <select
                          value={row.staff}
                          onChange={(e) => updateRow(row.id, 'staff', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                        >
                          <option value="">選択してください</option>
                          {staffList.map(staff => (
                            <option key={staff} value={staff}>{staff}</option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-gray-300 px-2 py-2">
                        <input
                          type="number"
                          value={row.sales}
                          onChange={(e) => updateRow(row.id, 'sales', Number(e.target.value))}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-right"
                        />
                      </td>
                      <td className="border border-gray-300 px-2 py-2">
                        <input
                          type="number"
                          value={row.cost}
                          onChange={(e) => updateRow(row.id, 'cost', Number(e.target.value))}
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
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
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
                      <th className="border border-gray-300 px-3 py-2 sticky left-0 bg-gray-100">日付</th>
                      {uniqueStaff.map(staff => (
                        <th key={staff} className="border border-gray-300 px-3 py-2 text-center">
                          {staff}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {uniqueDates.map(date => (
                      <tr key={date} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-3 py-2 font-semibold sticky left-0 bg-white">
                          {date}
                        </td>
                        {uniqueStaff.map(staff => {
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