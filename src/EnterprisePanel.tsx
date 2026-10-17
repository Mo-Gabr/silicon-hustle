import React, { useEffect, useRef } from 'react';
import { ENTERPRISE_BALANCE as B, capacity, slots, recurringRevenue, operatingFigures, focusBlock, premium, type Company, type Focus } from './foundersGamble';
import './founders-gamble.css';
const dollars = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
export const companyMoney = (n: number) => n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : dollars(n);
const focuses: {
    id: Focus;
    title: string;
    story: string;
    impact: string;
}[] = [
    { id: 'pilot', title: 'LAND THE FIRST YES', story: 'A customer will try your service. Their procurement team makes no promises.', impact: `${B.focuses.pilot.chance * 100}% chance · +${companyMoney(B.focuses.pilot.revenue)} recurring revenue/month · ${B.focuses.pilot.slots} slot` },
    { id: 'enterprise', title: 'WIN THE BIG ACCOUNT', story: 'The deck says enterprise-ready. Time to make the operations team agree.', impact: `${B.focuses.enterprise.chance * 100}% chance · +${companyMoney(B.focuses.enterprise.revenue)}/month · ${B.focuses.enterprise.slots} slot · needs ${B.pilotsRequired} pilots and reliability ${B.enterpriseReliability}` },
    { id: 'strategic', title: 'MAKE THE INDUSTRY CALL YOU', story: 'A giant wants a partner. Three departments and one very nervous lawyer stand between you and the signature.', impact: `${B.focuses.strategic.chance * 100}% chance · +${companyMoney(B.focuses.strategic.revenue)}/month · ${B.focuses.strategic.slots} slots · needs ${B.enterprisesRequired} enterprise customers and reliability ${B.strategicReliability}` },
    { id: 'capacity', title: 'BUILD ROOM TO GROW', story: 'Empty racks cost money. Full racks mean you kept your promises.', impact: `+${B.addedCapacity} delivery slots, up to ${B.maxCapacity} · +${companyMoney(B.slotOverhead)} monthly overhead per added slot` },
    { id: 'reliability', title: 'LET THE TEAM SLEEP', story: 'Invest in operations. Fewer midnight apologies, stronger customer confidence.', impact: `+1 reliability, up to ${B.maxReliability} · +${companyMoney(B.reliabilityOverhead)} monthly overhead · better valuation multiple` },
    { id: 'operate', title: 'DELIVER. BREATHE. REPEAT.', story: 'No new pitch this month. Serve the customers you already convinced.', impact: 'No new investment · normal service costs and incident risk still apply' }
];
/** Native dialog provides focus trapping, Escape handling and focus restoration in WebKit/Chromium. */
export function CompanyDialog({ title, children, onCancel }: {
    title: string;
    children: React.ReactNode;
    onCancel?: () => void;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const opener = document.activeElement;
        const dialog = ref.current;
        const cancel = (event: Event) => {
            event.preventDefault();
            onCancel?.();
        };
        dialog?.addEventListener('cancel', cancel);
        const keyboard = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                onCancel?.();
            }
        };
        dialog?.addEventListener('keydown', keyboard);
        const sync = () => {
            if (!dialog?.isConnected)
                return;
            if (document.querySelector('.sh-gate')) {
                if (dialog.open)
                    dialog.close();
            }
            else if (!dialog.open)
                dialog.showModal();
        };
        const closed = () => {
            if (!onCancel)
                sync();
        };
        dialog?.addEventListener('close', closed);
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(document.body, { childList: true, subtree: true });
        return () => {
            observer.disconnect();
            dialog?.removeEventListener('close', closed);
            dialog?.removeEventListener('keydown', keyboard);
            dialog?.removeEventListener('cancel', cancel);
            dialog?.close();
            if (opener instanceof HTMLElement && opener.isConnected)
                opener.focus();
        };
    }, []);
    return <dialog ref={ref} className="company-dialog" aria-label={title}><h2>{title}</h2>{children}</dialog>;
}
export default function EnterprisePanel({ company, onFocus, blocked }: {
    company: Company;
    onFocus: (focus: Focus) => void;
    blocked: boolean;
}) {
    const g = company.gamble;
    if (g?.decision !== 'extend')
        return null;
    const e = g.enterprise;
    const f = operatingFigures(e, company.labs);
    const last = e.ledger.at(-1);
    const focus = e.focus;
    const investment = B.focuses[focus].cost;
    const net = f.profit + company.labs * 270000;
    const projected = { ...e, contracts: [...e.contracts], reliability: e.reliability, purchasedSlots: e.purchasedSlots };
    if (focus === 'reliability' && e.reliability < B.maxReliability)
        projected.reliability++;
    if (focus === 'capacity')
        projected.purchasedSlots += Math.min(B.addedCapacity, B.maxCapacity - capacity(e, company.labs));
    if (focus === 'pilot' || focus === 'enterprise' || focus === 'strategic')
        projected.contracts.push({ kind: focus, month: company.month + 1 });
    const preview = operatingFigures(projected, company.labs);
    const bad = operatingFigures(projected, company.labs, true);
    return <section className="enterprise" aria-label="Build the Enterprise"><div className="eyebrow">THE FOUNDER’S GAMBLE · MONTHS 31–42</div><h2>BUILD THE ENTERPRISE</h2><p>Your investors already got their win. Now give your customers a reason to stay.</p><div className="enterprise-metrics">
 <div><small>AVAILABLE CASH</small><b>{companyMoney(company.cash)}</b></div><div><small>NEW RECURRING REVENUE / MONTH</small><b>{companyMoney(recurringRevenue(e))}</b></div><div><small>NORMAL MONTHLY OPERATING COST</small><b>{companyMoney(f.variable + f.fixed)}</b><span>{companyMoney(f.fixed)} fixed + {B.variableCost * 100}% of billing</span></div><div><small>NORMAL MONTHLY OPERATING PROFIT</small><b>{companyMoney(f.profit)}</b></div><div><small>DELIVERY CAPACITY</small><b>{slots(e)} / {capacity(e, company.labs)} slots</b></div><div><small>RELIABILITY</small><b>{e.reliability} / {B.maxReliability}</b><span>{B.incidentChance[e.reliability - 1] * 100}% monthly incident risk</span></div><div><small>NEW SERVICES PREMIUM</small><b>{companyMoney(premium(company))}</b><span>Separate from cash and the original company</span></div><div><small>NEW SERVICES MULTIPLE</small><b>{B.multiples[e.reliability - 1]}× annual revenue</b><span>{company.month <= e.discountThrough ? `${(1 - B.incidentPremium) * 100}% incident discount active` : 'No active service discount'}</span></div><div><small>RUNWAY AT CURRENT OPERATIONS</small><b>{net >= 0 ? 'Cash-flow positive' : Math.max(0, company.cash / -net).toFixed(1) + ' months'}</b><span>Includes original lab profit; excludes bids, crises and trades</span></div></div>
 <p className="standard-record">Month 30 victory locked: {companyMoney(g.standardResult.valuation)}. Standard Rankings peak: {companyMoney(g.standardResult.peak)}. This chapter is recorded separately.{g.unicornMonth ? ` Unicorn earned in Month ${g.unicornMonth}—yours to keep.` : ''}</p>
 <fieldset disabled={blocked || company.ended}><legend>CHOOSE NEXT MONTH’S FOCUS</legend><div className="enterprise-focuses">{focuses.map(item => {
        const reason = focusBlock(company, item.id);
        return <label key={item.id} className={focus === item.id ? 'selected-focus' : ''}><input type="radio" name="enterprise-focus" value={item.id} checked={focus === item.id} disabled={!!reason} onChange={() => onFocus(item.id)}/><span><b>{item.title} · {companyMoney(B.focuses[item.id].cost)}</b><span>{item.story}</span><small>{item.impact}</small>{reason && <small className="negative">{reason}</small>}</span></label>;
    })}</div></fieldset>
 {!company.ended && <div className="enterprise-preview" role="status"><b>NEXT MONTH: {focuses.find(x => x.id === focus)?.title}</b><p>Investment: {companyMoney(investment)}. {focus === 'pilot' || focus === 'enterprise' || focus === 'strategic' ? 'If signed, ' : 'After investment, '}normal new-business operating profit: {companyMoney(preview.profit)}; with an incident: {companyMoney(bad.profit)}. Original lab profit adds {companyMoney(company.labs * 270000)} separately.</p><p>Normal projected cash: {companyMoney(company.cash - investment + preview.profit + company.labs * 270000)} before boardroom costs. Failed bids keep their cost and earn no new revenue; cash would be {companyMoney(company.cash - investment + f.profit + company.labs * 270000)} without an incident. The planned reliability level carries a {B.incidentChance[projected.reliability - 1] * 100}% incident risk. NEXT MONTH commits this plan once.</p><p>New-services premium after a successful plan: {companyMoney(recurringRevenue(projected) * 12 * B.multiples[projected.reliability - 1])} before incident discounts; {companyMoney(recurringRevenue(projected) * 12 * B.multiples[projected.reliability - 1] * B.incidentPremium)} during a service discount. This is paper value, not spending money.</p></div>}
 {last && <div className="enterprise-settlement" role="status"><b>MONTH {last.month} · {last.incident ? 'SERVICE INCIDENT' : last.won ? 'CUSTOMER SIGNED' : 'OPERATIONS UPDATE'}</b><p>{last.message}</p><p>Investment {companyMoney(last.investment)} · Billed {companyMoney(last.billed)} · Delivery {companyMoney(last.variable)} · Fixed {companyMoney(last.fixed)} · Operating profit {companyMoney(last.profit)}</p></div>}
 <p className="report-fine">Unicorn: reach $1 billion in this chapter. Legendary MOGABR: finish Month 42 at $2 billion with a profitable original AI lab. Early exit never earns MOGABR. No further extension.</p>
 </section>;
}
