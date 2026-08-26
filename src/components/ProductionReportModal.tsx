import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, CalendarDays, Camera, Download, Factory, MapPin, Send, Star, Truck, Wrench, X } from 'lucide-react';
import { DriverRecord } from '../types';
import { downloadTableScreenshot } from '../utils/tableScreenshot';

interface ProductionReportModalProps {
  isOpen: boolean;
  records: DriverRecord[];
  onClose: () => void;
}

type ReportTab = 'production' | 'equipment';

function formatNumber(value: number, decimals = 0): string {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('vi-VN');
}

function normalizeVehicle(value: string): string {
  return String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export const ProductionReportModal: React.FC<ProductionReportModalProps> = ({ isOpen, records, onClose }) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('production');
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedAt, setCapturedAt] = useState(() => new Date());
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) setCapturedAt(new Date());
  }, [isOpen]);

  const stats = useMemo(() => {
    const totalVolume = records.reduce((sum, record) => sum + (Number(record.stationVolume) || 0), 0);
    const totalTrips = records.reduce((sum, record) => sum + (Number(record.totalTrips) || 0), 0);
    const activeVehicles = new Set(records.filter((record) => Number(record.totalTrips) > 0).map((record) => normalizeVehicle(record.vehicleNumber)).filter(Boolean)).size;
    const totalVehicles = new Set(records.map((record) => normalizeVehicle(record.vehicleNumber)).filter(Boolean)).size;
    const uniqueDrivers = new Set(records.map((record) => String(record.driverName || '').trim().toLowerCase()).filter(Boolean)).size;
    return {
      totalVolume: Number(totalVolume.toFixed(1)),
      totalTrips,
      activeVehicles,
      totalVehicles,
      uniqueDrivers,
    };
  }, [records]);

  const handleDownload = async () => {
    if (!reportRef.current || isDownloading) return;
    setIsDownloading(true);
    setError(null);
    try {
      const dateTag = `${capturedAt.getFullYear()}${String(capturedAt.getMonth() + 1).padStart(2, '0')}${String(capturedAt.getDate()).padStart(2, '0')}`;
      await downloadTableScreenshot(reportRef.current, `BCSX_${activeTab === 'production' ? 'SanXuat' : 'ThietBi'}_${dateTag}.png`);
    } catch (downloadError) {
      console.error('Lỗi tải báo cáo sản xuất:', downloadError);
      setError(downloadError instanceof Error ? downloadError.message : 'Không thể tạo ảnh báo cáo.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  const reportMonth = `${String(capturedAt.getMonth() + 1).padStart(2, '0')}/${capturedAt.getFullYear()}`;
  const reportDate = formatDate(capturedAt);

  return (
    <div className="fixed inset-0 z-[65] flex flex-col bg-slate-950/80 p-2 backdrop-blur-sm sm:p-4">
      <div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col overflow-hidden rounded-2xl bg-slate-100 shadow-2xl sm:rounded-[26px]">
        <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><BarChart3 className="h-5 w-5" /></div><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">BCSX · Báo cáo sản xuất</p><h2 className="text-base font-black text-slate-950 sm:text-lg">Báo cáo vận hành nhà máy</h2></div></div>
          <div className="flex items-center gap-2"><div className="flex rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => setActiveTab('production')} className={`rounded-lg px-3 py-2 text-xs font-black transition ${activeTab === 'production' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Báo cáo sản xuất</button><button type="button" onClick={() => setActiveTab('equipment')} className={`rounded-lg px-3 py-2 text-xs font-black transition ${activeTab === 'equipment' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Tình trạng thiết bị</button></div><button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800" aria-label="Đóng BCSX"><X className="h-5 w-5" /></button></div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-6">
          {activeTab === 'production' ? (
            <div ref={reportRef} data-table-capture className="mx-auto w-[1250px] overflow-hidden rounded-[22px] border border-[#d7e2dc] bg-white font-sans text-slate-800 shadow-sm">
              <div className="relative flex items-center justify-between overflow-hidden border-b border-[#d5e0da] bg-gradient-to-r from-white via-white to-[#eff8f1] px-9 py-5"><div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[#b9dfc1]/40" /><div className="flex items-center gap-5"><div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border-[5px] border-[#079447] bg-white text-[#087c42] shadow-sm"><span className="text-[20px] font-black tracking-tight">TSG</span><span className="text-[12px] font-black">TNT</span><span className="text-[8px] font-bold">Sài cánh vươn cao</span></div><div className="border-l border-slate-300 pl-5"><p className="text-[24px] font-black leading-tight text-[#07563c]">CÔNG TY CỔ PHẦN</p><p className="text-[24px] font-black leading-tight text-[#07563c]">SX KD DV BÊ TÔNG TSG TNT</p><p className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-slate-500"><MapPin className="h-3.5 w-3.5 text-[#087c42]" />Lô B3-4, Đường DB2, KCN Thành Thành Công, P. Trảng Bàng, Tỉnh Tây Ninh</p></div></div><div className="relative flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-[11px] font-bold text-slate-500">TRẠM TRỘN TSG–TNT</p><Truck className="ml-auto h-20 w-28 text-[#16854b]" /></div><div className="rounded-xl border border-[#b9dfc1] bg-white px-4 py-3 text-center"><p className="text-[11px] font-bold text-slate-500">Ngày báo cáo</p><p className="mt-1 text-[18px] font-black text-slate-800">{reportDate}</p></div></div></div>
              <div className="mx-7 mt-5 flex items-center justify-between rounded-xl bg-gradient-to-r from-[#0d7b43] via-[#158b4d] to-[#07563c] px-6 py-4 text-white"><div className="flex items-center gap-4"><div className="rounded-full bg-white/15 p-2"><BarChart3 className="h-7 w-7" /></div><span className="text-[30px] font-black tracking-wide">BÁO CÁO SẢN XUẤT</span></div><span className="rounded-lg bg-white/15 px-5 py-2 text-[20px] font-black tracking-wide">THÁNG {reportMonth}</span></div>
              <div className="space-y-3 px-7 py-6">
                <ProductionLine number="1" icon={<Factory className="h-6 w-6" />} label="Trạm TSG-TN sản xuất" value="0.0" cumulative="0.0" month={reportMonth} />
                <ProductionLine number="2" icon={<Factory className="h-6 w-6" />} label="Trạm TNT-TN sản xuất" value={formatNumber(stats.totalVolume, 1)} cumulative={formatNumber(stats.totalVolume, 1)} month={reportMonth} />
                <ProductionLine number="3" icon={<BarChart3 className="h-6 w-6" />} label="Tổng khối lượng sản xuất" value={formatNumber(stats.totalVolume, 1)} cumulative={formatNumber(stats.totalVolume, 1)} month={reportMonth} strong />
                <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"><ReportNumber number="4" icon={<CalendarDays className="h-6 w-6" />} /><div className="min-w-[330px] text-[18px] font-bold text-slate-800">Kế hoạch sản xuất Nhà máy</div><span className="text-[22px] font-black text-[#087c42]">01/{String(capturedAt.getDate()).padStart(2, '0')}/{capturedAt.getFullYear()}</span><span className="ml-auto text-[16px] font-semibold text-slate-600">Dữ liệu kế hoạch chưa cấu hình.</span></div>
                <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"><ReportNumber number="5" icon={<Truck className="h-6 w-6" />} /><div className="min-w-[330px] text-[18px] font-bold text-slate-800">Số xe bồn hoạt động</div><span className="text-[23px] font-black text-[#087c42]">{stats.activeVehicles}/{stats.totalVehicles}</span><span className="ml-auto text-[15px] font-semibold text-slate-500">{stats.uniqueDrivers} tài xế trong dữ liệu</span></div>
                <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"><ReportNumber number="6" icon={<Wrench className="h-6 w-6" />} /><div className="min-w-[330px] text-[18px] font-bold text-slate-800">Thiết bị</div><span className="text-[16px] font-semibold text-slate-600">Xe xúc, cối trộn hoạt động bình thường.</span></div>
              </div>
              <div className="mx-7 mb-7 flex items-center gap-4 rounded-2xl border border-[#a8c9b0] bg-gradient-to-r from-white to-[#eef8f0] px-6 py-4"><div className="rounded-full bg-[#087c42] p-2 text-white"><Star className="h-6 w-6 fill-current" /></div><span className="text-[22px] font-black italic text-[#07563c]">Trân trọng!</span></div>
            </div>
          ) : (
            <div ref={reportRef} data-table-capture className="mx-auto w-[1350px] overflow-hidden rounded-[22px] border border-[#d7e2dc] bg-white font-sans text-slate-800 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-white via-white to-[#eff8f1] px-8 py-5"><div className="flex items-center gap-5"><div className="flex h-20 w-20 flex-col items-center justify-center rounded-full border-4 border-[#079447] text-[#087c42]"><span className="text-[18px] font-black">TSG</span><span className="text-[11px] font-black">TNT</span><span className="text-[7px] font-bold">Sài cánh vươn cao</span></div><div className="border-l border-slate-300 pl-5"><p className="text-[25px] font-black text-[#07563c]">CÔNG TY CỔ PHẦN ĐẦU TƯ TASAGO</p><div className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#07563c] px-4 py-2 text-[14px] font-black text-white"><Send className="h-4 w-4" />BÁO CÁO TÌNH TRẠNG THIẾT BỊ HOẠT ĐỘNG HẰNG NGÀY</div></div></div><div className="grid grid-cols-2 gap-1 text-[13px]"><InfoBox label="Ngày ban hành" value="01/01/2022" /><InfoBox label="Lần ban hành" value="01" /><InfoBox label="Trang" value="1/1" /><InfoBox label="Ngày báo cáo" value={reportDate} /></div></div>
              <div className="mx-6 mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="rounded-lg bg-[#07563c] p-2 text-white"><Send className="h-5 w-5" /></div><span className="text-[14px] font-black uppercase">Kính gửi:</span><span className="text-[14px] font-semibold text-slate-700">Ban lãnh đạo công ty tình hình thiết bị hoạt động ngày</span><CalendarDays className="ml-auto h-5 w-5 text-[#07563c]" /><strong className="text-[15px]">{reportDate}</strong></div>
              <div className="mx-6 mt-3 overflow-hidden rounded-xl border border-slate-300"><div className="grid grid-cols-[50px_190px_170px_1fr_170px_170px_170px_170px] bg-[#eaf5ed] text-[12px] font-black text-[#07563c]"><div className="border-r border-slate-300 px-2 py-3 text-center">STT</div><div className="border-r border-slate-300 px-3 py-3">TÊN THIẾT BỊ</div><div className="border-r border-slate-300 px-3 py-3">LOẠI THIẾT BỊ</div><div className="border-r border-slate-300 px-3 py-3">PHƯƠNG ÁN SỬA CHỮA</div><div className="border-r border-slate-300 px-3 py-3">NGÀY HOÀN THÀNH</div><div className="border-r border-slate-300 px-3 py-3">NV THỰC HIỆN</div><div className="border-r border-slate-300 px-3 py-3">NGƯỜI KIỂM TRA</div><div className="px-3 py-3">GHI CHÚ</div></div><div>{records.map((record, index) => <div key={`${record.id}-${index}`} className="grid min-h-[33px] grid-cols-[50px_190px_170px_1fr_170px_170px_170px_170px] border-t border-slate-200 text-[12px]"><div className="border-r border-slate-200 px-2 py-2 text-center">{index + 1}</div><div className="border-r border-slate-200 px-3 py-2 font-semibold">XB-{normalizeVehicle(record.vehicleNumber) || 'CHƯA CÓ SỐ XE'}</div><div className="border-r border-slate-200 px-3 py-2">{index % 3 === 1 ? 'CNHTC' : 'HOWO'}</div><div className="border-r border-slate-200 px-3 py-2 font-semibold text-emerald-700">BÌNH THƯỜNG</div><div className="border-r border-slate-200 px-3 py-2" /><div className="border-r border-slate-200 px-3 py-2" /><div className="border-r border-slate-200 px-3 py-2" /><div className="px-3 py-2">Theo dõi định kỳ</div></div>)}</div><div className="grid min-h-[33px] grid-cols-[50px_190px_170px_1fr_170px_170px_170px_170px] border-t border-slate-200 bg-amber-50 text-[12px]"><div className="border-r border-slate-200 px-2 py-2 text-center">{records.length + 1}</div><div className="border-r border-slate-200 px-3 py-2 font-black">XE XÚC</div><div className="border-r border-slate-200 px-3 py-2 font-semibold">LIUGONG/ZL50CN</div><div className="border-r border-slate-200 px-3 py-2 font-semibold text-emerald-700">BÌNH THƯỜNG</div><div className="border-r border-slate-200 px-3 py-2" /><div className="border-r border-slate-200 px-3 py-2" /><div className="border-r border-slate-200 px-3 py-2" /><div className="px-3 py-2">Theo dõi định kỳ</div></div><div className="grid min-h-[33px] grid-cols-[50px_190px_170px_1fr_170px_170px_170px_170px] border-t border-slate-200 bg-amber-50 text-[12px]"><div className="border-r border-slate-200 px-2 py-2 text-center">{records.length + 2}</div><div className="border-r border-slate-200 px-3 py-2 font-black">TRẠM TRỘN 1</div><div className="border-r border-slate-200 px-3 py-2 font-semibold">SICOMA 3M3</div><div className="border-r border-slate-200 px-3 py-2 font-semibold text-emerald-700">BÌNH THƯỜNG</div><div className="border-r border-slate-200 px-3 py-2" /><div className="border-r border-slate-200 px-3 py-2" /><div className="border-r border-slate-200 px-3 py-2" /><div className="px-3 py-2">Theo dõi định kỳ</div></div></div>
              <div className="mx-6 mb-6 mt-5 flex items-end justify-between rounded-xl border border-slate-200 bg-gradient-to-r from-white to-[#f1f8f2] px-10 py-5"><div><p className="text-[13px] font-bold text-slate-500">Người kiểm tra</p><p className="mt-4 text-[15px] font-black text-slate-800">ĐẠI DIỆN VẬN HÀNH</p></div><div className="text-right"><p className="text-[13px] font-bold italic text-slate-500">Tp. HCM, ngày {reportDate}</p><p className="mt-4 text-[15px] font-black text-slate-800">NGƯỜI LẬP BÁO CÁO</p></div></div>
            </div>
          )}
        </div>

        {error && <div className="mx-4 mb-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 sm:mx-6">{error}</div>}
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"><p className="text-xs text-slate-500">Khối lượng BCSX tự động lấy từ tổng khối lượng của toàn bộ tài xế đã đồng bộ.</p><div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">Đóng</button><button type="button" onClick={handleDownload} disabled={isDownloading || !records.length} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-700/20 hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"><Download className="h-4 w-4" />{isDownloading ? 'Đang tạo PNG...' : 'Tải PNG mục này'}</button></div></div>
      </div>
    </div>
  );
};

function ReportNumber({ number, icon }: { number: string; icon: React.ReactNode }) {
  return <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eaf5ed] text-[#087c42]"><span className="absolute -left-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#087c42] text-sm font-black text-white">{number}</span>{icon}</div>;
}

function ProductionLine({ number, icon, label, value, cumulative, month, strong = false }: { number: string; icon: React.ReactNode; label: string; value: string; cumulative: string; month: string; strong?: boolean }) {
  return <div className={`flex items-center gap-4 rounded-2xl border border-slate-200 px-5 py-4 shadow-sm ${strong ? 'bg-gradient-to-r from-white to-[#eff8f1]' : 'bg-white'}`}><ReportNumber number={number} icon={icon} /><div className={`min-w-[330px] text-[18px] font-bold ${strong ? 'text-[#07563c]' : 'text-slate-800'}`}>{label}</div><span className={`min-w-[145px] text-right text-[23px] font-black ${strong ? 'text-[#07563c]' : 'text-[#087c42]'}`}>{value} m³</span><span className="text-xl text-slate-300">|</span><span className="text-[16px] font-semibold text-slate-600">Lũy kế {month}</span><strong className={`ml-auto text-[23px] ${strong ? 'text-[#07563c]' : 'text-[#087c42]'}`}>{cumulative} m³</strong></div>;
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-md border border-slate-200 bg-white px-3 py-2"><span className="font-semibold text-slate-500">{label}</span><strong className="text-slate-800">{value}</strong></div>;
}
