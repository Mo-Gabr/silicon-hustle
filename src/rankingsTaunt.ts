import {FIXED_RANKINGS} from './fixedRankings';

/** Presentation only: reuse the eligible Personal Best and its actual local rank. */
export function personalBestTaunt(value:number|null,rank?:number):string{
 if(value===null||!Number.isFinite(value)||value<0)return "You haven't built an empire. You've barely opened the spreadsheet. Welcome to Silicon Hustle.";
 if(value>FIXED_RANKINGS[0].valuation)return "You outvalued MOGABR. He's still #1. You thought this was a democracy?";
 if(value>FIXED_RANKINGS[1].valuation)return "You're worth more than Gabe M. He's still #2. Welcome to corporate governance.";
 if(rank===3)return "Third place. Two people still own the room, and you're paying for the coffee.";
 if(rank!==undefined&&Number.isInteger(rank)&&rank>=4&&rank<=6)return "You're climbing the rankings. Your investors are already asking why you're not higher.";
 if(rank!==undefined&&Number.isInteger(rank)&&rank>=7&&rank<=10)return "Congratulations, you made the Top 10. You're also one bad quarter away from being forgotten.";
 if(value>=1e9)return "You built a billion-dollar company and still didn't crack the Top 10. Welcome to Silicon Hustle.";
 if(value>=1e8)return "You built a hundred-million-dollar company. Unfortunately, nobody here is impressed by millions.";
 return "You're calling this a startup? Your investors are calling it a tax write-off.";
}
