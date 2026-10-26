import React, { useEffect, useRef } from 'react';
import { ENTERPRISE_BALANCE as B, capacity, recurringRevenue, operatingFigures, premium, type Company, type Focus } from './foundersGamble';
import './founders-gamble.css';
import {enterpriseActions,enterpriseProgress,clientSlots,showEnterpriseIntro} from './enterprisePresentation';
const dollars = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
export const companyMoney = (n: number) => n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : dollars(n);
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
    const focuses=enterpriseActions(company);
    const scheduled = focuses.find(item=>item.id===focus)!;
    const progress = enterpriseProgress(company);
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
    return <section className="lab enterprise" aria-label="Build the Enterprise">
      <div className="eyebrow">MONTHS 31–42</div><h2>BUILD THE ENTERPRISE</h2>
      {showEnterpriseIntro(company)&&<p className="enterprise-intro">12 months. One move per month. Land clients, grow revenue, and build toward $1 billion.</p>}
      <div className="enterprise-metrics" aria-label="Enterprise metrics">
        <div><small>REVENUE / MO</small><b>{companyMoney(recurringRevenue(e))}</b></div>
        <div><small>CLIENT SLOTS</small><b>{clientSlots(company)}</b></div>
        <div><small>RELIABILITY</small><b>{e.reliability} / {B.maxReliability}</b></div>
      </div>
      <ol className="enterprise-path" aria-label="Enterprise progression">
        {progress.map(step=><li key={step.id}>
          <b>{step.complete?'✓ ':''}{step.title}</b><small>{step.count}/{step.target} signed</small>
          {!step.complete&&<small>{step.requirements.filter(r=>['pilots','clients','reliability'].includes(r.key)).map(r=>`${r.met?'✓':'○'} ${r.text}`).join(' · ')}</small>}
        </li>)}
      </ol>
      {!company.ended&&<div className="enterprise-plan" role="status" aria-label="Scheduled enterprise action">
        <b>NEXT MONTH · {scheduled.title}</b>
        <p className={focus==='operate'?'focus-block':undefined}>{focus==='operate'?'Spend $0 · No clients or upgrades. Choose a growth action.':scheduled.description}</p>
        {scheduled.lockedCopy&&<p className="focus-block">Plan blocked: {scheduled.lockedCopy}</p>}
        {blocked&&<p className="focus-block">Resolve the boardroom event before this plan can settle.</p>}
        <small>After NEXT MONTH, focus resets to OPERATE.</small>
      </div>}
      <fieldset disabled={blocked||company.ended}><legend>NEXT MONTH’S FOCUS</legend>
        <div className="enterprise-focuses">{focuses.map(item=>{

          return <label key={item.id} className={focus===item.id?'selected-focus':''}>
            <input type="radio" name="enterprise-focus" value={item.id} checked={focus===item.id} disabled={item.disabled} onChange={()=>onFocus(item.id)}/>
            <span className="focus-copy"><span className="focus-heading"><b>{item.title}</b></span>
              <small>{item.description}</small>{item.disabled&&<small className="focus-block">{item.lockedCopy}</small>}{item.warning&&<small className="focus-block">{item.warning}</small>}
            </span>
          </label>;
        })}</div>
      </fieldset>
      {last&&<p className="enterprise-result" role="status">MONTH {last.month} · {last.incident?'SERVICE INCIDENT':last.won?'CUSTOMER SIGNED':['pilot','enterprise','strategic'].includes(last.focus)?'NO DEAL':'PLAN COMPLETE'}</p>}
      <details className="enterprise-details"><summary>Details</summary>
        <div className="enterprise-detail-content">
          <p>Month 30 victory: {companyMoney(g.standardResult.valuation)}. Rankings peak: {companyMoney(g.standardResult.peak)}. Both stay frozen.{g.unicornMonth?` Unicorn earned in Month ${g.unicornMonth}.`:''}</p>
          <dl className="enterprise-finances">
            <div><dt>Available cash</dt><dd>{companyMoney(company.cash)}</dd></div>
            <div><dt>Normal monthly costs</dt><dd>{companyMoney(f.variable+f.fixed)}</dd></div>
            <div><dt>Fixed overhead</dt><dd>{companyMoney(f.fixed)}</dd></div>
            <div><dt>Delivery costs</dt><dd>{B.variableCost*100}% of billing</dd></div>
            <div><dt>Normal operating profit</dt><dd>{companyMoney(f.profit)}</dd></div>
            <div><dt>Incident risk</dt><dd>{B.incidentChance[e.reliability-1]*100}% / month</dd></div>
            <div><dt>Services premium</dt><dd>{companyMoney(premium(company))}</dd></div>
            <div><dt>Revenue multiple</dt><dd>{B.multiples[e.reliability-1]}× annual revenue</dd></div>
            <div><dt>Runway including lab profit</dt><dd>{net>=0?'Cash-flow positive':Math.max(0,company.cash/-net).toFixed(1)+' months'}</dd></div>
          </dl>
          <p>Time warnings count the target attempt and assume every bid succeeds, with cash available for prerequisites and any lab upgrades. Funding delays or failed bids need more time.</p>
          <p>Pilots and enterprise customers use one slot; strategic partners use two. Idle capacity still costs money. Service incidents reduce billing by {Math.round((1-B.incidentBilling)*100)}% and discount the new-services premium by {Math.round((1-B.incidentPremium)*100)}% this month and next.</p>
          {!company.ended&&<div className="enterprise-preview">
            <b>{focuses.find(item=>item.id===focus)?.title} · {companyMoney(investment)}</b>
            <p>If the plan succeeds: {companyMoney(preview.profit)} normal new-business profit, or {companyMoney(bad.profit)} with an incident. Original lab profit adds {companyMoney(company.labs*270000)}.</p>
            <p>Projected cash: {companyMoney(company.cash-investment+preview.profit+company.labs*270000)} before crises. A failed bid still costs {companyMoney(investment)} and adds no revenue. With no incident, failed-bid cash would be {companyMoney(company.cash-investment+f.profit+company.labs*270000)}.</p>
            <p>Planned incident risk: {B.incidentChance[projected.reliability-1]*100}%. New-services premium if successful: {companyMoney(recurringRevenue(projected)*12*B.multiples[projected.reliability-1])}, or {companyMoney(recurringRevenue(projected)*12*B.multiples[projected.reliability-1]*B.incidentPremium)} during a discount. Paper value is not cash. NEXT MONTH settles the plan once.</p>
          </div>}
          {last&&<div className="enterprise-settlement"><b>MONTH {last.month}</b><p>{last.message}</p><p>Investment {companyMoney(last.investment)} · Billed {companyMoney(last.billed)} · Delivery {companyMoney(last.variable)} · Fixed {companyMoney(last.fixed)} · Profit {companyMoney(last.profit)}</p></div>}
          <p>Unicorn: $1 billion in Months 31–42, retained once earned. MOGABR: finish Month 42 at $2 billion with a profitable original AI lab. Early exit never earns MOGABR. No further extension.</p>
        </div>
      </details>
    </section>;
}
