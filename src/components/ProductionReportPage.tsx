import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Camera, Download, RefreshCw, Save, X } from 'lucide-react';
import { DriverRecord } from '../types';
import { captureElementAsDataUrl } from '../utils/tableScreenshot';
import '../styles/bcsx.css';

interface ProductionReportPageProps { isOpen: boolean; records: DriverRecord[]; onClose: () => void; }
type ReportTab = 'production' | 'equipment';

interface ProductionForm {
  productionTitle: string; month: string; reportDate: string;
  stationTsgToday: string; stationTsgCumulative: string;
  stationTntToday: string; stationTntCumulative: string;
  totalToday: string; totalCumulative: string;
  planDate: string; planNote: string; activeVehicles: string; totalVehicles: string;
  equipmentStatus: string; footer: string;
  issueDate: string; releaseNo: string; pageNo: string; locationText: string;
  inspectorName: string; reportOwner: string;
}

interface EquipmentRow { id: string; name: string; type: string; repairPlan: string; completionDate: string; executor: string; inspector: string; note: string; }

const EQUIPMENT_KEY = 'TASAGO_BCSX_EQUIPMENT_DRAFT_V1';
const PRODUCTION_KEY = 'TASAGO_BCSX_PRODUCTION_DRAFT_V1';
const BCSX_ASSET_BASE = `${import.meta.env.BASE_URL}bcsx/`;

function today() { return new Date().toLocaleDateString('vi-VN'); }
function monthLabel() { const now = new Date(); return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`; }
function nextDay() { const value = new Date(); value.setDate(value.getDate() + 1); return value.toLocaleDateString('vi-VN'); }
function number(value: number) { return String(Math.max(0, Math.round(Number(value) || 0))); }
function volume(value: number) { return Number(value || 0).toFixed(1); }
function vehicle(value: string) { return String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase(); }

function stats(records: DriverRecord[]) {
  const totalVolume = records.reduce((sum, row) => sum + (Number(row.stationVolume) || 0), 0);
  const activeVehicles = new Set(records.filter((row) => Number(row.totalTrips) > 0).map((row) => vehicle(row.vehicleNumber)).filter(Boolean)).size;
  const totalVehicles = new Set(records.map((row) => vehicle(row.vehicleNumber)).filter(Boolean)).size;
  return { totalVolume: Number(totalVolume.toFixed(1)), activeVehicles, totalVehicles };
}

function initialProduction(records: DriverRecord[]): ProductionForm {
  const source = stats(records); const total = volume(source.totalVolume);
  return {
    productionTitle: 'BÁO CÁO SẢN XUẤT', month: monthLabel(), reportDate: today(),
    stationTsgToday: '0.0', stationTsgCumulative: '0.0', stationTntToday: total, stationTntCumulative: total,
    totalToday: total, totalCumulative: total, planDate: nextDay(), planNote: '250m3 chưa tính khối lượng phát sinh.',
    activeVehicles: number(source.activeVehicles), totalVehicles: number(source.totalVehicles),
    equipmentStatus: 'xe xúc, cối trộn hoạt động bình thường.', footer: 'Trân trọng!',
    issueDate: '01/01/2022', releaseNo: '01', pageNo: '1/1', locationText: 'Tp. HCM', inspectorName: 'NGUYỄN MINH THƯỜNG', reportOwner: 'TRUNG THANH HÙNG',
  };
}

function initialEquipment(records: DriverRecord[]): EquipmentRow[] {
  const rows = Array.from(new Map(records.map((row) => [vehicle(row.vehicleNumber), row])).values()).filter((row) => vehicle(row.vehicleNumber)).slice(0, 22).map((row, index) => ({
    id: `vehicle-${index}-${vehicle(row.vehicleNumber)}`, name: `XB-${vehicle(row.vehicleNumber)}`, type: index % 3 === 1 ? 'CNHTC' : 'HOWO', repairPlan: 'BÌNH THƯỜNG', completionDate: '', executor: '', inspector: '', note: '',
  }));
  return [...rows, { id: 'loader', name: 'XE XÚC', type: 'LIUGONG/ZL50CN', repairPlan: 'BÌNH THƯỜNG', completionDate: '', executor: '', inspector: '', note: '' }, { id: 'mixer', name: 'TRẠM TRỘN 1', type: 'SICOMA 3M3', repairPlan: 'BÌNH THƯỜNG', completionDate: '', executor: '', inspector: '', note: '' }];
}

function readDraft<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key); if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(fallback)) return (Array.isArray(parsed) ? parsed : fallback) as T;
    return parsed && typeof parsed === 'object' ? { ...fallback, ...(parsed as object) } as T : fallback;
  } catch { return fallback; }
}

export const ProductionReportPage: React.FC<ProductionReportPageProps> = ({ isOpen, records, onClose }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const source = useMemo(() => stats(records), [records]);
  const [tab, setTab] = useState<ReportTab>('production');
  const [production, setProduction] = useState<ProductionForm>(() => readDraft(PRODUCTION_KEY, initialProduction(records)));
  const [equipment, setEquipment] = useState<EquipmentRow[]>(() => readDraft(EQUIPMENT_KEY, initialEquipment(records)));
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (!localStorage.getItem(PRODUCTION_KEY)) setProduction(initialProduction(records));
    if (!localStorage.getItem(EQUIPMENT_KEY)) setEquipment(initialEquipment(records));
  }, [isOpen, records]);

  const update = (field: keyof ProductionForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setProduction((current) => ({ ...current, [field]: event.target.value }));
  const updateRow = (id: string, field: keyof EquipmentRow) => (event: ChangeEvent<HTMLInputElement>) => setEquipment((rows) => rows.map((row) => row.id === id ? { ...row, [field]: event.target.value } : row));

  const syncDrivers = () => {
    const total = volume(source.totalVolume);
    setProduction((current) => ({ ...current, stationTntToday: total, stationTntCumulative: total, totalToday: total, totalCumulative: total, activeVehicles: number(source.activeVehicles), totalVehicles: number(source.totalVehicles) }));
    setMessage('Đã đồng bộ các số liệu từ toàn bộ tài xế.'); window.setTimeout(() => setMessage(''), 2500);
  };
  const saveDraft = () => { localStorage.setItem(PRODUCTION_KEY, JSON.stringify(production)); localStorage.setItem(EQUIPMENT_KEY, JSON.stringify(equipment)); setMessage('Đã lưu bản nháp BCSX trên thiết bị này.'); window.setTimeout(() => setMessage(''), 2500); };
  const capture = async () => { if (!reportRef.current || busy) return; setBusy(true); try { setPreview(await captureElementAsDataUrl(reportRef.current)); } finally { setBusy(false); } };
  const download = () => { if (!preview) return; const link = document.createElement('a'); link.href = preview; link.download = `BCSX_${tab === 'production' ? 'SanXuat' : 'ThietBi'}_${new Date().toISOString().slice(0, 10)}.png`; link.click(); };
  if (!isOpen) return null;

  return <div className="bcsx-page"><header className="bcsx-page-toolbar"><div className="bcsx-page-heading"><button type="button" onClick={onClose} aria-label="Quay lại dashboard"><ArrowLeft /></button><div><p>BCSX · MẪU BÁO CÁO</p><h1>Báo cáo sản xuất &amp; tình trạng thiết bị</h1></div></div><div className="bcsx-page-actions"><button type="button" onClick={syncDrivers}><RefreshCw />Đồng bộ từ tài xế</button><button type="button" onClick={saveDraft}><Save />Lưu bản nháp</button><button type="button" onClick={capture} disabled={busy}>{busy ? 'Đang tạo ảnh...' : `Chụp ${tab === 'production' ? 'mục 1' : 'mục 2'}`}<Camera /></button></div></header><nav className="bcsx-page-tabs"><button type="button" className={tab === 'production' ? 'active' : ''} onClick={() => setTab('production')}>MỤC 1 · BÁO CÁO SẢN XUẤT</button><button type="button" className={tab === 'equipment' ? 'active' : ''} onClick={() => setTab('equipment')}>MỤC 2 · TÌNH TRẠNG THIẾT BỊ</button></nav>{message && <div className="bcsx-page-message">{message}</div>}<main className="bcsx-page-workspace">{tab === 'production' ? <ProductionFixedCanvas ref={reportRef} form={production} update={update} /> : <EquipmentFixedCanvas ref={reportRef} form={production} update={update} rows={equipment} updateRow={updateRow} />}</main>{preview && <div className="bcsx-preview-backdrop"><div className="bcsx-preview-dialog"><div className="bcsx-preview-header"><div><p>XEM TRƯỚC ẢNH BCSX</p><strong>Kiểm tra đúng bố cục mẫu trước khi tải</strong></div><button type="button" onClick={() => setPreview(null)} aria-label="Đóng xem trước"><X /></button></div><div className="bcsx-preview-body"><img src={preview} alt="Xem trước báo cáo BCSX" /></div><div className="bcsx-preview-footer"><button type="button" onClick={() => setPreview(null)}>Chỉnh sửa lại</button><button type="button" onClick={download}><Download />Tải ảnh PNG</button></div></div></div>}</div>;
};

interface CanvasProps { form: ProductionForm; update: (field: keyof ProductionForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void; }

const ProductionFixedCanvas = React.forwardRef<HTMLDivElement, CanvasProps>(({ form, update }, ref) => <div ref={ref} data-table-capture className="bcsx-image-report bcsx-image-production"><img src={`${BCSX_ASSET_BASE}reference-production.png`} alt="Mẫu báo cáo sản xuất cố định" /><div className="bcsx-overlay production-overlay"><input className="p-title" value={form.productionTitle} onChange={update('productionTitle')} aria-label="Tiêu đề báo cáo sản xuất" /><input className="p-month" value={form.month} onChange={update('month')} aria-label="Tháng báo cáo" /><input className="p-date" value={form.reportDate} onChange={update('reportDate')} aria-label="Ngày báo cáo" /><input className="p-r1c" value={form.stationTsgToday} onChange={update('stationTsgToday')} aria-label="TSG phát sinh" /><input className="p-r1l" value={form.stationTsgCumulative} onChange={update('stationTsgCumulative')} aria-label="TSG lũy kế" /><input className="p-r2c" value={form.stationTntToday} onChange={update('stationTntToday')} aria-label="TNT phát sinh" /><input className="p-r2l" value={form.stationTntCumulative} onChange={update('stationTntCumulative')} aria-label="TNT lũy kế" /><input className="p-r3c" value={form.totalToday} onChange={update('totalToday')} aria-label="Tổng phát sinh" /><input className="p-r3l" value={form.totalCumulative} onChange={update('totalCumulative')} aria-label="Tổng lũy kế" /><input className="p-r4v" value={form.planDate} onChange={update('planDate')} aria-label="Ngày kế hoạch" /><input className="p-r4n" value={form.planNote} onChange={update('planNote')} aria-label="Ghi chú kế hoạch" /><div className="p-r5v"><input value={form.activeVehicles} onChange={update('activeVehicles')} aria-label="Xe hoạt động" /><span>/</span><input value={form.totalVehicles} onChange={update('totalVehicles')} aria-label="Tổng xe" /></div><input className="p-r6n" value={form.equipmentStatus} onChange={update('equipmentStatus')} aria-label="Tình trạng thiết bị" /><input className="p-footer" value={form.footer} onChange={update('footer')} aria-label="Lời kết" /></div></div>);
ProductionFixedCanvas.displayName = 'ProductionFixedCanvas';

interface EquipmentProps extends CanvasProps { rows: EquipmentRow[]; updateRow: (id: string, field: keyof EquipmentRow) => (event: ChangeEvent<HTMLInputElement>) => void; }
const EquipmentFixedCanvas = React.forwardRef<HTMLDivElement, EquipmentProps>(({ form, update, rows, updateRow }, ref) => <div ref={ref} data-table-capture className="bcsx-image-report bcsx-image-equipment"><img src={`${BCSX_ASSET_BASE}reference-equipment.png`} alt="Mẫu báo cáo thiết bị cố định" /><div className="bcsx-overlay equipment-overlay"><div className="e-rows">{rows.slice(0, 24).map((row, index) => <div className="e-row" key={row.id}><span>{index + 1}</span>{(['name', 'type', 'repairPlan', 'completionDate', 'executor', 'inspector', 'note'] as const).map((field) => <input key={field} value={row[field]} onChange={updateRow(row.id, field)} aria-label={`${field} dòng ${index + 1}`} />)}</div>)}</div><div className="e-footer"><input className="e-inspector" value={form.inspectorName} onChange={update('inspectorName')} aria-label="Người kiểm tra" /><input className="e-location" value={form.locationText} onChange={update('locationText')} aria-label="Địa điểm" /><input className="e-footer-date" value={form.reportDate} onChange={update('reportDate')} aria-label="Ngày lập" /><input className="e-owner" value={form.reportOwner} onChange={update('reportOwner')} aria-label="Người lập" /></div></div></div>);
EquipmentFixedCanvas.displayName = 'EquipmentFixedCanvas';
