import {useEffect,useRef,useState} from 'react';
import {chipCode,maxBuyQuantity,monthlyChange,ORDER_LIMIT,positionMetrics,reliablePosition,type ChipPosition} from './chipTrading';
import './chip-trading.css';

type Props={
 asset:{id:string;name:string;maker:string};price:number;month:number;previousMarket:unknown;
 position:ChipPosition;cash:number;quantity:number;count:number;buyFee:number;sellFee:number;
 buyTotal:number;sellTotal:number;sellProfit:number;blockedReason:string|null;
 onQuantity:(quantity:number)=>void;onTrade:(side:'buy'|'sell')=>void;onDismiss:()=>void;
};
const money=(value:number)=>'$'+Math.round(value).toLocaleString('en-US');
const signedMoney=(value:number)=>(value<0?'−':value>0?'+':'')+money(Math.abs(value));
const percent=(value:number)=>(value>0?'+':'')+value.toFixed(2)+'%';
const amount=(value:number|null)=>value===null?'Unavailable':money(value);

export default function ChipTradingPanel(props:Props){
 const {asset,price,month,previousMarket,position,cash,quantity,count,buyFee,sellFee,buyTotal,sellTotal,sellProfit,blockedReason,onQuantity,onTrade,onDismiss}=props;
 const dialog=useRef<HTMLDialogElement>(null);
 const dismiss=useRef(onDismiss);dismiss.current=onDismiss;
 const [side,setSide]=useState<'buy'|'sell'>('buy');
 useEffect(()=>{
  const opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  dialog.current?.showModal();
  // Main's existing account/conflict UI must never be hidden by a top-layer sheet.
  const watch=new MutationObserver(()=>{if(document.querySelector('.sh-gate'))dismiss.current();});
  watch.observe(document.body,{childList:true,subtree:true});
  const current=dialog.current;
  return ()=>{watch.disconnect();current?.close();document.body.style.overflow=previousOverflow;if(opener?.isConnected)opener.focus();};
 },[]);
 const change=monthlyChange(month,asset.id,price,previousMarket);
 const metrics=positionMetrics(price,position,sellFee);
 const positionValid=reliablePosition(position);
 const quantityValid=Number.isSafeInteger(quantity)&&quantity>=1&&quantity<=ORDER_LIMIT;
 const priceValid=Number.isFinite(price)&&price>0;
 const maximum=maxBuyQuantity(cash,price,buyFee);
 const sellAll=positionValid?Math.min(position.qty,ORDER_LIMIT):0;
 const unavailable=blockedReason||(!positionValid?'Trading is unavailable because this position has an invalid quantity or cost.':!priceValid?'Trading is unavailable because the price is invalid.':!Number.isFinite(cash)?'Trading is unavailable because the cash balance is invalid.':null);
 const orderError=unavailable||(!quantityValid?`Enter a whole quantity from 1 to ${ORDER_LIMIT}.`:side==='buy'&&cash<buyTotal?'Not enough cash for this order.':side==='sell'&&position.qty<count?'Not enough chips owned for this order.':null);
 const saleBasis=positionValid&&position.qty>0?position.cost/position.qty*count:null;
 const salePercent=saleBasis!==null&&saleBasis>0?sellProfit/saleBasis*100:null;
 function step(delta:number){onQuantity(Math.max(1,Math.min(ORDER_LIMIT,(Number.isFinite(quantity)?Math.floor(quantity):0)+delta)));}
 return <dialog className="chip-trading-panel" ref={dialog} aria-labelledby="chip-panel-title" aria-describedby="chip-panel-description"
  onKeyDown={event=>{if(event.key!=='Tab')return;const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')).filter(control=>control.getClientRects().length>0);const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}}
  onCancel={event=>{event.preventDefault();onDismiss();}}
  onClick={event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)onDismiss();}}>
  <div className="chip-panel-header">
   <div><span className="eyebrow">{asset.maker} · <b>{chipCode(asset.id)}</b></span><h2 id="chip-panel-title">{asset.name}</h2></div>
   <button type="button" className="chip-close" aria-label="Close trading panel" autoFocus onClick={onDismiss}>✕</button>
  </div>
  <div className="chip-panel-content">
   <p id="chip-panel-description">Month {month} · Prices update at NEXT MONTH.</p>
   <section aria-labelledby="chip-market-heading">
    <h3 id="chip-market-heading">MONTHLY CHANGE</h3>
    <dl className="chip-metrics">
     <div><dt>Current price</dt><dd data-testid="chip-price">{priceValid?money(price):'Unavailable'}</dd></div>
     <div><dt>Previous month’s price</dt><dd data-testid="chip-previous-price">{amount(change?.previous??null)}</dd></div>
     <div className="chip-metric-wide"><dt>Change versus previous month</dt><dd data-testid="chip-monthly-change" className={change?change.dollars<0?'chip-loss':'chip-gain':''}>{change?`${signedMoney(change.dollars)} (${percent(change.percent)})`:'Unavailable'}</dd></div>
    </dl>
    {!change&&<p className="chip-note">No reliable previous-month price is saved. Monthly change becomes available after NEXT MONTH.</p>}
   </section>
   <section aria-labelledby="chip-position-heading">
    <h3 id="chip-position-heading">YOUR POSITION</h3>
    <dl className="chip-metrics" aria-live="polite">
     <div><dt>Quantity owned</dt><dd data-testid="chip-owned">{Number.isSafeInteger(position.qty)&&position.qty>=0?position.qty.toLocaleString('en-US'):'Unavailable'}</dd></div>
     <div><dt>Average purchase cost</dt><dd data-testid="chip-average">{amount(metrics.average)}</dd></div>
     <div><dt>Holdings market value</dt><dd data-testid="chip-market-value">{amount(metrics.marketValue)}</dd></div>
     <div><dt>Unrealized profit / loss</dt><dd data-testid="chip-unrealized" className={metrics.profit!==null?metrics.profit<0?'chip-loss':'chip-gain':''}>{position.qty>0&&metrics.profit!==null?`${signedMoney(metrics.profit)} (${metrics.percent===null?'Unavailable':percent(metrics.percent)})`:'Unavailable'}</dd></div>
    </dl>
    <p className="chip-note">Average includes buy fees · P/L after {sellFee*100}% sale fee · Market value before fees.</p>
   </section>
   <section className="chip-order" aria-labelledby="chip-order-heading">
    <h3 id="chip-order-heading">PLACE AN ORDER</h3>
    <div className="chip-sides" aria-label="Order direction">
     <button type="button" className="chip-buy" aria-pressed={side==='buy'} onClick={()=>setSide('buy')}>BUY</button>
     <button type="button" className="chip-sell" aria-pressed={side==='sell'} disabled={!positionValid||position.qty===0} onClick={()=>setSide('sell')}>SELL</button>
    </div>
    <label htmlFor="chip-quantity">Quantity</label>
    <div className="chip-quantity-controls">
     <button type="button" aria-label="Decrease quantity" disabled={quantity<=1} onClick={()=>step(-1)}>−</button>
     <input id="chip-quantity" type="number" inputMode="numeric" min="1" max={ORDER_LIMIT} step="1" value={Number.isFinite(quantity)?quantity:''} onChange={event=>onQuantity(event.target.value===''?0:Number(event.target.value))}/>
     <button type="button" aria-label="Increase quantity" disabled={quantity>=ORDER_LIMIT} onClick={()=>step(1)}>+</button>
     {side==='buy'?<button type="button" disabled={maximum===0} onClick={()=>onQuantity(maximum)}>MAX</button>:<button type="button" disabled={sellAll===0} onClick={()=>onQuantity(sellAll)}>ALL</button>}
    </div>
    <p className="chip-note">Cash available: {money(cash)} · Up to {ORDER_LIMIT} chips per order.{side==='sell'&&position.qty>ORDER_LIMIT?' ALL selects the maximum 999; remaining chips can be sold in another order.':''}</p>
    <dl className="chip-order-preview" aria-live="polite">
     <div><dt>{side==='buy'?'Total cost':'Net proceeds'} · {side==='buy'?buyFee*100:sellFee*100}% fee included</dt><dd data-testid="chip-order-total">{quantityValid&&priceValid?money(side==='buy'?buyTotal:sellTotal):'Unavailable'}</dd></div>
     {side==='sell'&&<div><dt>Estimated realized profit / loss</dt><dd data-testid="chip-realized">{quantityValid&&saleBasis!==null&&priceValid&&position.qty>=count?`${signedMoney(sellProfit)} (${salePercent===null?'Unavailable':percent(salePercent)})`:'Unavailable'}</dd></div>}
    </dl>
    {orderError&&<p className="chip-order-error" role="status">{orderError}</p>}
    <button id="chip-confirm" type="button" className={side==='buy'?'chip-confirm chip-buy':'chip-confirm chip-sell'} disabled={!!orderError} onClick={()=>{if(!orderError)onTrade(side);}}>CONFIRM {side.toUpperCase()}{quantityValid&&priceValid?` · ${money(side==='buy'?buyTotal:sellTotal)}`:''}</button>
   </section>
  </div>
 </dialog>;
}
