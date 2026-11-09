import { LayoutDashboard, MapPin, BriefcaseBusiness, Trees, Flower2, Images, ShieldCheck, Archive, FolderOpen, FilePenLine, Landmark, Map, Camera, FileText, Building2, ClipboardList, Circle, Clock3, CheckCircle2, XCircle } from 'lucide-react';
import { REVIEW } from '../../public/site-admin-model.js';

const icons = { home: LayoutDashboard, sites: MapPin, opportunities: BriefcaseBusiness, parks: Trees, gardens: Flower2, library: Images, review: ShieldCheck, transfer: Archive, entry: FilePenLine, legacy: FolderOpen };
export function AdminIcon({ name }) { const Icon = icons[name] || Landmark; return <Icon aria-hidden="true" focusable="false"/>; }
export function SectionIcon({ index = 0 }) { const Icon = [Building2, Landmark, ShieldCheck, Map, Camera, Trees, FileText, BriefcaseBusiness, ClipboardList][index] || FileText; return <Icon aria-hidden="true" focusable="false"/>; }
export function StatusBadge({ status }) { const Icon = { DRAFT: Circle, IN_REVIEW: Clock3, APPROVED: CheckCircle2, REJECTED: XCircle }[status] || Circle; return <span className="record-badge" data-status={status}><Icon aria-hidden="true" focusable="false"/>{REVIEW[status]}</span>; }
export function feedbackTone(message) {
 if (!message) return undefined;
 if (/^(تم|اكتمل)/.test(message)) return 'success';
 if (/^(اختر|لا توجد)/.test(message)) return 'notice';
 return 'error';
}

// RTL keyboard navigation changes only which existing tab is displayed.
export function tabKeyboardNavigation(event) {
 const tabs = [...event.currentTarget.querySelectorAll('[role=tab]')];
 const current = tabs.indexOf(event.target);
 if (current < 0 || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
 event.preventDefault();
 const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowLeft' ? 1 : -1) + tabs.length) % tabs.length;
 tabs[next].focus(); tabs[next].click();
}
