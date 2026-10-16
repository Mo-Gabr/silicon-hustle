import type {BoardView} from './leaderboardCore';

export type SavedPeakCheck={status:'checking'|'ready'|'blocked';value?:number;message?:string};

// This is display eligibility only. Submission still repeats attributedPeak().
export function pendingPublication(view:BoardView,check:SavedPeakCheck){
 return check.status==='ready'&&typeof check.value==='number'&&Number.isSafeInteger(check.value)&&check.value>=0&&
  Math.max(check.value,view.peak)>(view.self?.best_valuation??0)&&view.loadedAt!==null&&view.status!=='unavailable';
}

export function savedPeakExplanation(error:unknown):string {
 const message=error instanceof Error?error.message:'';
 if(message.includes('cloud save'))return 'Finish choosing your save in Account, or wait for sync, then check again.';
 if(message.includes('Open your saved game'))return 'Open your saved game, then check again.';
 if(message.includes('account')||message.includes('Account'))return 'Check your signed-in account, then try again.';
 return 'Your saved peak could not be checked. Please try again.';
}
