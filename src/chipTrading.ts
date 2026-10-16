// Display and quantity helpers only. Orders still run through App.trade().
export type PreviousMarket={forMonth:number;prices:Record<string,number>};
export type ChipPosition={qty:number;cost:number};
export const ORDER_LIMIT=999;
export function chipCode(id:string):string {
 return ({mi300:'MI300X',mi325:'MI325X',gaudi:'GAUDI 3'} as Record<string,string>)[id]??id.toUpperCase();
}
export function monthlyChange(month:number,id:string,price:number,history:unknown):{previous:number;dollars:number;percent:number}|null {
 if(!history||typeof history!=='object'||month<=1||!Number.isFinite(price)||price<=0)return null;
 const prior=history as PreviousMarket;
 const previous=prior.prices?.[id];
 if(prior.forMonth!==month||!Number.isFinite(previous)||previous<=0)return null;
 const dollars=price-previous;
 return {previous,dollars,percent:dollars/previous*100};
}
export function reliablePosition(position:ChipPosition):boolean {
 return Number.isSafeInteger(position.qty)&&position.qty>=0&&Number.isFinite(position.cost)&&position.cost>=0;
}
export function positionMetrics(price:number,position:ChipPosition,sellFee:number){
 const validQty=Number.isSafeInteger(position.qty)&&position.qty>=0;
 const marketValue=validQty&&Number.isFinite(price)&&price>0?position.qty*price:null;
 const reliable=reliablePosition(position)&&marketValue!==null;
 const average=reliable&&position.qty>0?position.cost/position.qty:null;
 const netValue=reliable?Math.round(position.qty*price*(1-sellFee)):null;
 const profit=netValue===null?null:netValue-position.cost;
 const percent=profit!==null&&position.qty>0&&position.cost>0?profit/position.cost*100:null;
 return {marketValue,average,profit,percent};
}
export function maxBuyQuantity(cash:number,price:number,buyFee:number):number {
 if(!Number.isFinite(cash)||cash<0||!Number.isFinite(price)||price<=0||!Number.isFinite(buyFee)||buyFee<0)return 0;
 // Binary search uses the handler's rounded total, including half-dollar edges.
 let low=0,high=ORDER_LIMIT;
 while(low<high){const mid=Math.ceil((low+high)/2);if(Math.round(mid*price*(1+buyFee))<=cash)low=mid;else high=mid-1;}
 return low;
}
