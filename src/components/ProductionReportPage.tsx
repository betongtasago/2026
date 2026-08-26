import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BarChart3, CalendarDays, Camera, Download, Factory, FileText, MapPin, RefreshCw, Save, Send, Star, Truck, Wrench, X } from 'lucide-react';
import { DriverRecord } from '../types';
import { captureElementAsDataUrl } from '../utils/tableScreenshot';

interface ProductionReportPageProps {
  isOpen: boolean;
  records: DriverRecord[];
  onClose: () => void;
}

type ReportTab = 'production' | 'equipment';

interface ProductionForm {
  logoText: string;
  companyName: string;
  companySubname: string;
  productionTitle: string;
  address: string;
  month: string;
  reportDate: string;
  stationTsgToday: string;
  stationTsgCumulative: string;
  stationTntToday: string;
  stationTntCumulative: string;
  totalToday: string;
  totalCumulative: string;
  planDate: string;
  planNote: string;
  activeVehicles: string;
  totalVehicles: string;
  equipmentStatus: string;
  footer: string;
  stationTsgLabel: string;
  stationTntLabel: string;
  totalLabel: string;
  planLabel: string;
  activeVehiclesLabel: string;
  equipmentLabel: string;
  equipmentCompanyName: string;
  equipmentTitle: string;
  recipientLabel: string;
  recipientText: string;
  issueDate: string;
  releaseNo: string;
  pageNo: string;
  inspectorLabel: string;
  inspectorName: string;
  locationText: string;
  reportOwner: string;
}

interface EquipmentRow {
  id: string;
  name: string;
  type: string;
  repairPlan: string;
  completionDate: string;
  executor: string;
  inspector: string;
  note: string;
}

const EQUIPMENT_KEY = 'TASAGO_BCSX_EQUIPMENT_DRAFT_V1';
const PRODUCTION_KEY = 'TASAGO_BCSX_PRODUCTION_DRAFT_V1';

function today(): string {
  return new Date().toLocaleDateString('vi-VN');
}

function monthLabel(): string {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

function dateAfterToday(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toLocaleDateString('vi-VN');
}

function cleanNumber(value: string): string {
  return value.replace(/[^0-9.,-]/g, '');
}

function formatVolume(value: number): string {
  return Number(value || 0).toFixed(1);
}

function formatCount(value: number): string {
  return String(Math.max(0, Math.round(Number(value) || 0)));
}

function sourceStats(records: DriverRecord[]) {
  const totalVolume = records.reduce((sum, record) => sum + (Number(record.stationVolume) || 0), 0);
  const activeVehicles = new Set(records.filter((record) => Number(record.totalTrips) > 0).map((record) => String(record.vehicleNumber || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()).filter(Boolean)).size;
  const totalVehicles = new Set(records.map((record) => String(record.vehicleNumber || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()).filter(Boolean)).size;
  return { totalVolume: Number(totalVolume.toFixed(1)), activeVehicles, totalVehicles };
}

function initialProduction(records: DriverRecord[]): ProductionForm {
  const stats = sourceStats(records);
  const volume = formatVolume(stats.totalVolume);
  return {
    logoText: 'TSG–TNT',
    companyName: 'CÔNG TY CỔ PHẦN',
    companySubname: 'SX KD DV BÊ TÔNG TSG TNT',
    productionTitle: 'BÁO CÁO SẢN XUẤT',
    address: 'Lô B3-4, Đường DB2, KCN Thành Thành Công, P. Trảng Bàng, Tỉnh Tây Ninh',
    month: monthLabel(),
    reportDate: today(),
    stationTsgToday: '0.0',
    stationTsgCumulative: '0.0',
    stationTntToday: volume,
    stationTntCumulative: volume,
    totalToday: volume,
    totalCumulative: volume,
    planDate: dateAfterToday(),
    planNote: 'Dữ liệu kế hoạch chưa cấu hình.',
    activeVehicles: formatCount(stats.activeVehicles),
    totalVehicles: formatCount(stats.totalVehicles),
    equipmentStatus: 'Xe xúc, cối trộn hoạt động bình thường.',
    footer: 'Trân trọng!',
    stationTsgLabel: 'Trạm TSG-TN sản xuất',
    stationTntLabel: 'Trạm TNT-TN sản xuất',
    totalLabel: 'Tổng khối lượng sản xuất',
    planLabel: 'Kế hoạch sản xuất Nhà máy',
    activeVehiclesLabel: 'Số xe bồn hoạt động',
    equipmentLabel: 'Thiết bị',
    equipmentCompanyName: 'CÔNG TY CỔ PHẦN ĐẦU TƯ TASAGO',
    equipmentTitle: 'BÁO CÁO TÌNH TRẠNG THIẾT BỊ HOẠT ĐỘNG HẰNG NGÀY',
    recipientLabel: 'KÍNH GỬI:',
    recipientText: 'BAN LÃNH ĐẠO CÔNG TY TÌNH HÌNH THIẾT BỊ HOẠT ĐỘNG NGÀY',
    issueDate: '01/01/2022',
    releaseNo: '01',
    pageNo: '1/1',
    inspectorLabel: 'Người kiểm tra',
    inspectorName: 'ĐẠI DIỆN VẬN HÀNH',
    locationText: 'Tp. HCM',
    reportOwner: 'NGƯỜI LẬP BÁO CÁO',
  };
}

function initialEquipment(records: DriverRecord[]): EquipmentRow[] {
  const vehicles = records.map((record) => String(record.vehicleNumber || '').trim()).filter(Boolean);
  const rows = vehicles.map((vehicle, index) => ({
    id: `vehicle-${index}-${vehicle}`,
    name: `XB-${vehicle.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`,
    type: index % 3 === 1 ? 'CNHTC' : 'HOWO',
    repairPlan: 'BÌNH THƯỜNG',
    completionDate: '',
    executor: '',
    inspector: '',
    note: 'Theo dõi định kỳ',
  }));
  return [...rows, {
    id: 'loader-1', name: 'XE XÚC', type: 'LIUGONG/ZL50CN', repairPlan: 'BÌNH THƯỜNG', completionDate: '', executor: '', inspector: '', note: 'Theo dõi định kỳ',
  }, {
    id: 'mixer-1', name: 'TRẠM TRỘN 1', type: 'SICOMA 3M3', repairPlan: 'BÌNH THƯỜNG', completionDate: '', executor: '', inspector: '', note: 'Theo dõi định kỳ',
  }];
}

function readDraft<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(fallback)) return (Array.isArray(parsed) ? parsed : fallback) as T;
    if (parsed && typeof parsed === 'object') return { ...fallback, ...(parsed as object) } as T;
    return fallback;
  } catch {
    return fallback;
  }
}

export const ProductionReportPage: React.FC<ProductionReportPageProps> = ({ isOpen, records, onClose }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const stats = useMemo(() => sourceStats(records), [records]);
  const [activeTab, setActiveTab] = useState<ReportTab>('production');
  const [production, setProduction] = useState<ProductionForm>(() => readDraft(PRODUCTION_KEY, initialProduction(records)));
  const [equipment, setEquipment] = useState<EquipmentRow[]>(() => readDraft(EQUIPMENT_KEY, initialEquipment(records)));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [captureError, setCaptureError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setProduction((current) => ({ ...current, reportDate: today() }));
    try {
      if (!localStorage.getItem(PRODUCTION_KEY)) setProduction(initialProduction(records));
      if (!localStorage.getItem(EQUIPMENT_KEY)) setEquipment(initialEquipment(records));
    } catch {
      setProduction(initialProduction(records));
      setEquipment(initialEquipment(records));
    }
  }, [isOpen, records]);

  const syncFromDrivers = () => {
    const nextVolume = formatVolume(stats.totalVolume);
    setProduction((current) => ({
      ...current,
      stationTntToday: nextVolume,
      stationTntCumulative: nextVolume,
      totalToday: nextVolume,
      totalCumulative: nextVolume,
      activeVehicles: formatCount(stats.activeVehicles),
      totalVehicles: formatCount(stats.totalVehicles),
    }));
    setSavedMessage('Đã đồng bộ khối lượng từ toàn bộ tài xế.');
  };

  const saveDraft = () => {
    try {
      localStorage.setItem(PRODUCTION_KEY, JSON.stringify(production));
      localStorage.setItem(EQUIPMENT_KEY, JSON.stringify(equipment));
      setSavedMessage('Đã lưu bản nháp BCSX trên thiết bị này.');
      window.setTimeout(() => setSavedMessage(''), 2500);
    } catch {
      setSavedMessage('Không thể lưu bản nháp trên trình duyệt.');
    }
  };

  const updateProduction = (field: keyof ProductionForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProduction((current) => ({ ...current, [field]: event.target.value }));
  };

  const updateEquipment = (id: string, field: keyof EquipmentRow) => (event: ChangeEvent<HTMLInputElement>) => {
    setEquipment((rows) => rows.map((row) => row.id === id ? { ...row, [field]: event.target.value } : row));
  };

  const handleCapture = async () => {
    if (!reportRef.current || isCapturing) return;
    setIsCapturing(true);
    setCaptureError('');
    try {
      setPreviewUrl(await captureElementAsDataUrl(reportRef.current));
    } catch (error) {
      console.error('Lỗi chụp BCSX:', error);
      setCaptureError(error instanceof Error ? error.message : 'Không thể tạo ảnh xem trước.');
    } finally {
      setIsCapturing(false);
    }
  };

  const downloadPreview = () => {
    if (!previewUrl) return;
    const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = `BCSX_${activeTab === 'production' ? 'SanXuat' : 'ThietBi'}_${dateTag}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex min-h-screen flex-col bg-[#eaf2ee] text-slate-900">
      <header className="shrink-0 border-b border-emerald-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3"><button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Quay lại dashboard"><ArrowLeft className="h-5 w-5" /></button><div className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><BarChart3 className="h-5 w-5" /></div><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">BCSX · Trang báo cáo riêng</p><h1 className="text-lg font-black text-slate-950">Báo cáo sản xuất &amp; tình trạng thiết bị</h1></div></div>
          <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={syncFromDrivers} className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800 hover:bg-cyan-100"><RefreshCw className="h-4 w-4" />Đồng bộ từ tài xế</button><button type="button" onClick={saveDraft} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"><Save className="h-4 w-4" />Lưu bản nháp</button><button type="button" onClick={handleCapture} disabled={isCapturing || !records.length} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"><Camera className="h-4 w-4" />{isCapturing ? 'Đang tạo ảnh...' : `Chụp ${activeTab === 'production' ? 'báo cáo sản xuất' : 'thiết bị'}`}</button></div>
        </div>
        <div className="flex gap-2 border-t border-slate-100 px-4 py-2 lg:px-8"><button type="button" onClick={() => setActiveTab('production')} className={`rounded-xl px-4 py-2 text-sm font-black ${activeTab === 'production' ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-500 hover:bg-emerald-50'}`}>Mục 1 · Báo cáo sản xuất</button><button type="button" onClick={() => setActiveTab('equipment')} className={`rounded-xl px-4 py-2 text-sm font-black ${activeTab === 'equipment' ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-500 hover:bg-emerald-50'}`}>Mục 2 · Tình trạng thiết bị</button></div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-3 sm:p-6">
        {savedMessage && <div className="mx-auto mb-3 max-w-[1450px] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">{savedMessage}</div>}
        {captureError && <div className="mx-auto mb-3 max-w-[1450px] rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800">{captureError}</div>}

        {activeTab === 'production' ? (
          <ProductionReportCanvas ref={reportRef} form={production} update={updateProduction} />
        ) : (
          <EquipmentReportCanvas ref={reportRef} form={production} update={updateProduction} rows={equipment} updateRow={updateEquipment} />
        )}
      </main>

      {previewUrl && <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950/85 p-3 backdrop-blur-sm sm:p-6"><div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col overflow-hidden rounded-2xl bg-slate-100 shadow-2xl"><div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Xem trước ảnh BCSX</p><h2 className="text-base font-black">Kiểm tra trước khi tải xuống</h2></div><button type="button" onClick={() => setPreviewUrl(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800" aria-label="Đóng xem trước"><X className="h-5 w-5" /></button></div><div className="min-h-0 flex-1 overflow-auto bg-slate-200 p-3 sm:p-6"><img src={previewUrl} alt="Bản xem trước báo cáo BCSX" className="mx-auto block h-auto min-w-[900px] max-w-none bg-white shadow-xl" /></div><div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-6"><button type="button" onClick={() => setPreviewUrl(null)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">Chỉnh sửa lại</button><button type="button" onClick={downloadPreview} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-800"><Download className="h-4 w-4" />Tải ảnh PNG</button></div></div></div>}
    </div>
  );
};

interface ProductionCanvasProps {
  form: ProductionForm;
  update: (field: keyof ProductionForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

const ProductionReportCanvas = React.forwardRef<HTMLDivElement, ProductionCanvasProps>(({ form, update }, ref) => (
  <div ref={ref} data-table-capture className="mx-auto w-[1280px] overflow-hidden rounded-[22px] border border-[#c8ded0] bg-white font-sans text-slate-800 shadow-sm">
    <div className="flex items-center justify-between border-b-2 border-[#0a6841] bg-gradient-to-r from-white via-white to-[#eff8f1] px-10 py-7"><div className="flex items-center gap-6"><input value={form.logoText} aria-label="Logo công ty" onChange={update('logoText')} className="flex h-28 w-28 items-center justify-center rounded-full border-[6px] border-[#079447] bg-white text-center text-[21px] font-black text-[#087c42] outline-none" /><div className="border-l border-slate-300 pl-6"><input value={form.companyName} onChange={update('companyName')} aria-label="Tên công ty dòng 1" className="block w-[650px] border-0 bg-transparent text-[27px] font-black leading-tight text-[#07563c] outline-none" /><input value={form.companySubname} onChange={update('companySubname')} aria-label="Tên công ty dòng 2" className="mt-1 block w-[650px] border-0 bg-transparent text-[27px] font-black leading-tight text-[#07563c] outline-none" /><div className="mt-3 flex items-center gap-2"><MapPin className="h-4 w-4 text-[#087c42]" /><input value={form.address} onChange={update('address')} aria-label="Địa chỉ công ty" className="w-[670px] border-0 bg-transparent text-[13px] font-semibold text-slate-500 outline-none" /></div></div></div><div className="flex items-center gap-4"><div className="hidden text-right sm:block"><p className="text-[11px] font-bold text-slate-500">TRẠM TRỘN TSG–TNT</p><Truck className="ml-auto h-20 w-28 text-[#16854b]" /></div><div className="rounded-xl border border-[#b9dfc1] bg-white px-4 py-3 text-center"><p className="text-[11px] font-bold text-slate-500">Ngày báo cáo</p><input value={form.reportDate} onChange={update('reportDate')} aria-label="Ngày báo cáo" className="mt-1 w-[130px] border-0 bg-transparent text-center text-[18px] font-black text-slate-800 outline-none" /></div></div></div>
    <div className="mx-8 mt-6 flex items-center justify-between rounded-xl bg-gradient-to-r from-[#0d7b43] via-[#158b4d] to-[#07563c] px-7 py-4 text-white"><div className="flex items-center gap-4"><div className="rounded-full bg-white/15 p-2"><BarChart3 className="h-7 w-7" /></div><input value={form.productionTitle} onChange={update('productionTitle')} aria-label="Tiêu đề báo cáo sản xuất" className="w-[440px] border-0 bg-transparent text-[31px] font-black tracking-wide text-white outline-none" /></div><div className="flex items-center gap-2"><span className="text-[20px] font-black">THÁNG</span><input value={form.month} onChange={update('month')} aria-label="Tháng báo cáo" className="w-[120px] rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-center text-[20px] font-black text-white outline-none" /></div></div>
    <div className="space-y-3 px-8 py-7"><ProductionLine number="1" icon={<Factory className="h-6 w-6" />} labelField="stationTsgLabel" todayField="stationTsgToday" cumulativeField="stationTsgCumulative" form={form} update={update} /><ProductionLine number="2" icon={<Factory className="h-6 w-6" />} labelField="stationTntLabel" todayField="stationTntToday" cumulativeField="stationTntCumulative" form={form} update={update} /><ProductionLine number="3" icon={<BarChart3 className="h-6 w-6" />} labelField="totalLabel" todayField="totalToday" cumulativeField="totalCumulative" form={form} update={update} strong /><EditableProductionLine number="4" icon={<CalendarDays className="h-6 w-6" />} labelField="planLabel" valueField="planDate" noteField="planNote" form={form} update={update} /><EditableProductionLine number="5" icon={<Truck className="h-6 w-6" />} labelField="activeVehiclesLabel" valueField="activeVehicles" noteField="totalVehicles" form={form} update={update} /><SingleEditableLine number="6" icon={<Wrench className="h-6 w-6" />} labelField="equipmentLabel" field="equipmentStatus" form={form} update={update} /></div>
    <div className="mx-8 mb-8 flex items-center gap-4 rounded-2xl border border-[#a8c9b0] bg-gradient-to-r from-white to-[#eef8f0] px-7 py-5"><div className="rounded-full bg-[#087c42] p-2 text-white"><Star className="h-6 w-6 fill-current" /></div><input value={form.footer} onChange={update('footer')} aria-label="Lời kết báo cáo" className="w-[400px] border-0 bg-transparent text-[23px] font-black italic text-[#07563c] outline-none" /></div>
  </div>
));
ProductionReportCanvas.displayName = 'ProductionReportCanvas';

function ReportNumber({ number, icon }: { number: string; icon: React.ReactNode }) { return <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eaf5ed] text-[#087c42]"><span className="absolute -left-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#087c42] text-sm font-black text-white">{number}</span>{icon}</div>; }

function ProductionLine({ number, icon, labelField, todayField, cumulativeField, form, update, strong = false }: { number: string; icon: React.ReactNode; labelField: keyof ProductionForm; todayField: keyof ProductionForm; cumulativeField: keyof ProductionForm; form: ProductionForm; update: ProductionCanvasProps['update']; strong?: boolean }) { const label = String(form[labelField] || ''); return <div className={`flex items-center gap-4 rounded-2xl border border-slate-200 px-5 py-4 shadow-sm ${strong ? 'bg-gradient-to-r from-white to-[#eff8f1]' : 'bg-white'}`}><ReportNumber number={number} icon={icon} /><input value={label} aria-label={`Tên dòng ${number}`} onChange={update(labelField)} className={`min-w-[325px] border-0 bg-transparent text-[19px] font-bold outline-none ${strong ? 'text-[#07563c]' : 'text-slate-800'}`} /><input value={form[todayField] as string} onChange={update(todayField)} aria-label={`${label} phát sinh`} className={`w-[155px] border-0 bg-transparent text-right text-[24px] font-black outline-none ${strong ? 'text-[#07563c]' : 'text-[#087c42]'}`} /><span className="text-xl text-slate-300">|</span><span className="text-[16px] font-semibold text-slate-600">Lũy kế</span><input value={form[cumulativeField] as string} onChange={update(cumulativeField)} aria-label={`${label} lũy kế`} className={`ml-auto w-[155px] border-0 bg-transparent text-right text-[24px] font-black outline-none ${strong ? 'text-[#07563c]' : 'text-[#087c42]'}`} /><span className="text-[16px] font-bold text-[#087c42]">m³</span></div>; }

function EditableProductionLine({ number, icon, labelField, valueField, noteField, form, update }: { number: string; icon: React.ReactNode; labelField: keyof ProductionForm; valueField: keyof ProductionForm; noteField: keyof ProductionForm; form: ProductionForm; update: ProductionCanvasProps['update'] }) { const label = String(form[labelField] || ''); return <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"><ReportNumber number={number} icon={icon} /><input value={label} onChange={update(labelField)} aria-label={`Tên dòng ${number}`} className="min-w-[325px] border-0 bg-transparent text-[19px] font-bold text-slate-800 outline-none" /><input value={form[valueField] as string} onChange={update(valueField)} aria-label={`${label} giá trị`} className="w-[190px] border-0 bg-transparent text-[22px] font-black text-[#087c42] outline-none" /><input value={form[noteField] as string} onChange={update(noteField)} aria-label={`${label} ghi chú`} className="ml-auto min-w-[350px] border-0 bg-transparent text-[16px] font-semibold text-slate-600 outline-none" /></div>; }

function SingleEditableLine({ number, icon, labelField, field, form, update }: { number: string; icon: React.ReactNode; labelField: keyof ProductionForm; field: keyof ProductionForm; form: ProductionForm; update: ProductionCanvasProps['update'] }) { const label = String(form[labelField] || ''); return <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"><ReportNumber number={number} icon={icon} /><input value={label} onChange={update(labelField)} aria-label={`Tên dòng ${number}`} className="min-w-[325px] border-0 bg-transparent text-[19px] font-bold text-slate-800 outline-none" /><textarea value={form[field] as string} onChange={update(field)} aria-label={label} rows={1} className="ml-auto min-w-[600px] resize-none border-0 bg-transparent text-[16px] font-semibold text-slate-600 outline-none" /></div>; }

interface EquipmentCanvasProps extends ProductionCanvasProps { rows: EquipmentRow[]; updateRow: (id: string, field: keyof EquipmentRow) => (event: ChangeEvent<HTMLInputElement>) => void; }
const EquipmentReportCanvas = React.forwardRef<HTMLDivElement, EquipmentCanvasProps>(({ form, update, rows, updateRow }, ref) => <div ref={ref} data-table-capture className="mx-auto w-[1450px] overflow-hidden rounded-[22px] border border-[#c8ded0] bg-white font-sans text-slate-800 shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-white via-white to-[#eff8f1] px-9 py-6"><div className="flex items-center gap-6"><input value={form.logoText} onChange={update('logoText')} aria-label="Logo công ty" className="h-24 w-24 rounded-full border-4 border-[#079447] text-center text-[19px] font-black text-[#087c42] outline-none" /><div className="border-l border-slate-300 pl-6"><input value={form.equipmentCompanyName} onChange={update('equipmentCompanyName')} aria-label="Tên công ty thiết bị" className="block w-[700px] border-0 bg-transparent text-[27px] font-black text-[#07563c] outline-none" /><div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#07563c] px-4 py-2 text-[14px] font-black text-white"><Send className="h-4 w-4" /><input value={form.equipmentTitle} onChange={update('equipmentTitle')} aria-label="Tiêu đề báo cáo thiết bị" className="w-[570px] border-0 bg-transparent text-white outline-none" /></div></div></div><div className="grid grid-cols-2 gap-1 text-[13px]"><InfoBox label="Ngày ban hành" value={form.issueDate} onChange={update('issueDate')} /><InfoBox label="Lần ban hành" value={form.releaseNo} onChange={update('releaseNo')} /><InfoBox label="Trang" value={form.pageNo} onChange={update('pageNo')} /><InfoBox label="Ngày báo cáo" value={form.reportDate} onChange={update('reportDate')} /></div></div><div className="mx-7 mt-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3"><div className="rounded-lg bg-[#07563c] p-2 text-white"><Send className="h-5 w-5" /></div><input value={form.recipientLabel} onChange={update('recipientLabel')} aria-label="Kính gửi nhãn" className="w-[100px] border-0 bg-transparent text-[14px] font-black outline-none" /><input value={form.recipientText} onChange={update('recipientText')} aria-label="Nội dung kính gửi" className="w-[650px] border-0 bg-transparent text-[14px] font-semibold outline-none" /><CalendarDays className="ml-auto h-5 w-5 text-[#07563c]" /><input value={form.reportDate} onChange={update('reportDate')} aria-label="Ngày trên phiếu thiết bị" className="w-[120px] border-0 bg-transparent text-[15px] font-black outline-none" /></div><div className="mx-7 mt-4 overflow-hidden rounded-xl border border-slate-300"><div className="grid grid-cols-[55px_210px_190px_1fr_180px_180px_180px_190px] bg-[#eaf5ed] text-[12px] font-black text-[#07563c]"><HeaderCell text="STT" /><HeaderCell text="TÊN THIẾT BỊ" /><HeaderCell text="LOẠI THIẾT BỊ" /><HeaderCell text="PHƯƠNG ÁN SỬA CHỮA" /><HeaderCell text="NGÀY HOÀN THÀNH" /><HeaderCell text="NV THỰC HIỆN" /><HeaderCell text="NGƯỜI KIỂM TRA" /><HeaderCell text="GHI CHÚ" /></div>{rows.map((row, index) => <EquipmentRowView key={row.id} row={row} index={index + 1} update={updateRow} />)}</div><div className="mx-7 mb-7 mt-6 flex items-end justify-between rounded-xl border border-slate-200 bg-gradient-to-r from-white to-[#f1f8f2] px-12 py-7"><div><input value={form.inspectorLabel} onChange={update('inspectorLabel')} aria-label="Nhãn người kiểm tra" className="block w-[250px] border-0 bg-transparent text-[13px] font-bold text-slate-500 outline-none" /><input value={form.inspectorName} onChange={update('inspectorName')} aria-label="Người kiểm tra" className="mt-5 block w-[300px] border-0 bg-transparent text-[15px] font-black outline-none" /></div><div className="text-right"><div className="flex items-center justify-end gap-1"><input value={form.locationText} onChange={update('locationText')} aria-label="Địa điểm ngày lập" className="w-[90px] border-0 bg-transparent text-right text-[13px] font-bold italic text-slate-500 outline-none" /><span className="text-[13px] font-bold italic text-slate-500">, ngày</span><input value={form.reportDate} onChange={update('reportDate')} aria-label="Ngày lập báo cáo" className="w-[105px] border-0 bg-transparent text-[13px] font-bold italic text-slate-500 outline-none" /></div><input value={form.reportOwner} onChange={update('reportOwner')} aria-label="Người lập báo cáo" className="mt-5 block w-[300px] border-0 bg-transparent text-right text-[15px] font-black outline-none" /></div></div></div>);
EquipmentReportCanvas.displayName = 'EquipmentReportCanvas';

function HeaderCell({ text }: { text: string }) { return <div className="border-r border-slate-300 px-3 py-3 last:border-r-0">{text}</div>; }
function InfoBox({ label, value, onChange }: { label: string; value: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) { return <label className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"><span className="font-semibold text-slate-500">{label}</span><input value={value} onChange={onChange} aria-label={label} className="w-[110px] border-0 bg-transparent text-right font-black text-slate-800 outline-none" /></label>; }
function EquipmentRowView({ row, index, update }: { key?: React.Key; row: EquipmentRow; index: number; update: EquipmentCanvasProps['updateRow'] }) { return <div className="grid min-h-[42px] grid-cols-[55px_210px_190px_1fr_180px_180px_180px_190px] border-t border-slate-200 text-[12px]"><div className="border-r border-slate-200 px-2 py-3 text-center font-bold">{index}</div>{(['name', 'type', 'repairPlan', 'completionDate', 'executor', 'inspector', 'note'] as const).map((field) => <div key={field} className="border-r border-slate-200 px-2 py-1 last:border-r-0"><input value={row[field]} onChange={update(row.id, field)} aria-label={`${field} dòng ${index}`} className={`h-full w-full min-w-0 border-0 bg-transparent px-1 py-2 outline-none ${field === 'repairPlan' ? 'font-semibold text-emerald-700' : ''}`} /></div>)}</div>; }
