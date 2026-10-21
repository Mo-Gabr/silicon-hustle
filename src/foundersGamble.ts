/** Shared web/iOS rules. Fictional balance values; never used by Months 1–30. */
export const ENTERPRISE_BALANCE = {
    standardMonth: 30, finalMonth: 42, target: 100000000, unicorn: 1000000000, mogabr: 2000000000,
    maxCapacity: 12, baseCapacity: 2, labsPerSlot: 4, addedCapacity: 2, maxReliability: 5, enterpriseReliability: 3, pilotsRequired: 2, strategicReliability: 5, enterprisesRequired: 2, discountFollowingMonths: 1,
    slotOverhead: 200000, reliabilityOverhead: 150000, variableCost: .4,
    incidentBilling: .8, incidentPremium: .75,
    multiples: [3, 4, 6, 7.5, 9], incidentChance: [.18, .12, .08, .04, .02],
    focuses: { operate: { cost: 0 }, pilot: { cost: 2000000, chance: .85, revenue: 1500000, slots: 1 }, enterprise: { cost: 4000000, chance: .65, revenue: 2500000, slots: 1 }, strategic: { cost: 8000000, chance: .3, revenue: 5000000, slots: 2 }, capacity: { cost: 6000000 }, reliability: { cost: 3000000 } }
} as const;
export type Focus = keyof typeof ENTERPRISE_BALANCE.focuses;
export type Contract = {
    kind: 'pilot' | 'enterprise' | 'strategic';
    month: number;
};
export type Settlement = {
    month: number;
    focus: Focus;
    investment: number;
    won: boolean;
    incident: boolean;
    billed: number;
    variable: number;
    fixed: number;
    profit: number;
    message: string;
};
export type Enterprise = {
    reliability: number;
    purchasedSlots: number;
    contracts: Contract[];
    discountThrough: number;
    focus: Focus;
    ledger: Settlement[];
};
export type StandardResult = {
    month: 30;
    valuation: number;
    peak: number;
    success: true;
    ending: 'ipo' | 'acquisition';
};
export type ExtensionOutcome = {
    month: number;
    valuation: number;
    reason: 'completed' | 'early' | 'bankrupt' | 'fraud';
    unicorn: boolean;
    mogabr: boolean;
};
export type Gamble = {
    version: 1;
    decision: 'pending' | 'exit' | 'extend';
    standardResult: StandardResult;
    enterprise: Enterprise;
    unicornMonth?: number;
    extensionOutcome?: ExtensionOutcome;
};
export type Company = {
    month: number;
    cash: number;
    labs: number;
    seed: number;
    ended: boolean;
    endingChoice?: string;
    gamble?: Gamble;
    reports?: {
        month: number;
        valuation: number;
    }[];
};
export const freshEnterprise = (): Enterprise => ({ reliability: 1, purchasedSlots: 0, contracts: [], discountThrough: 0, focus: 'operate', ledger: [] });
export function capacity(e: Enterprise, labs: number) {
    return Math.min(ENTERPRISE_BALANCE.maxCapacity, ENTERPRISE_BALANCE.baseCapacity + Math.floor(labs / ENTERPRISE_BALANCE.labsPerSlot) + e.purchasedSlots);
}
export function slots(e: Enterprise) {
    return e.contracts.reduce((n, c) => n + ENTERPRISE_BALANCE.focuses[c.kind].slots, 0);
}
export function recurringRevenue(e: Enterprise) {
    return e.contracts.reduce((n, c) => n + ENTERPRISE_BALANCE.focuses[c.kind].revenue, 0);
}
export function operatingFigures(e: Enterprise, labs: number, incident = false) {
    const billed = recurringRevenue(e) * (incident ? ENTERPRISE_BALANCE.incidentBilling : 1);
    const variable = billed * ENTERPRISE_BALANCE.variableCost;
    const fixed = capacity(e, labs) * ENTERPRISE_BALANCE.slotOverhead + e.reliability * ENTERPRISE_BALANCE.reliabilityOverhead;
    return { billed, variable, fixed, profit: billed - variable - fixed };
}
export function premium(s: Company) {
    const g = s.gamble;
    if (g?.decision !== 'extend' || s.cash < 0 || s.endingChoice === 'bankrupt' || s.endingChoice === 'fraud')
        return 0;
    const e = g.enterprise;
    return recurringRevenue(e) * 12 * ENTERPRISE_BALANCE.multiples[e.reliability - 1] * (s.month <= e.discountThrough ? ENTERPRISE_BALANCE.incidentPremium : 1);
}
export function focusBlock(s: Company, focus: Focus): string | null {
    const g = s.gamble;
    if (g?.decision !== 'extend' || s.ended || s.month >= ENTERPRISE_BALANCE.finalMonth)
        return 'The enterprise chapter is closed.';
    const e = g.enterprise;
    const rule = ENTERPRISE_BALANCE.focuses[focus];
    if (s.cash < rule.cost)
        return 'Not enough available cash for this initiative.';
    if (focus === 'reliability' && e.reliability >= ENTERPRISE_BALANCE.maxReliability)
        return `Operations are already at level ${ENTERPRISE_BALANCE.maxReliability}.`;
    if (focus === 'capacity' && capacity(e, s.labs) >= ENTERPRISE_BALANCE.maxCapacity)
        return 'Delivery capacity is already at its limit.';
    if (focus === 'pilot' || focus === 'enterprise' || focus === 'strategic') {
        if (capacity(e, s.labs) - slots(e) < ruleSlots(focus))
            return 'Expand delivery capacity before promising another customer a slot.';
        if (focus === 'enterprise' && (e.reliability < ENTERPRISE_BALANCE.enterpriseReliability || e.contracts.filter(c => c.kind === 'pilot').length < ENTERPRISE_BALANCE.pilotsRequired))
            return `Needs reliability ${ENTERPRISE_BALANCE.enterpriseReliability} and ${ENTERPRISE_BALANCE.pilotsRequired} signed pilots.`;
        if (focus === 'strategic' && (e.reliability < ENTERPRISE_BALANCE.strategicReliability || e.contracts.filter(c => c.kind === 'enterprise').length < ENTERPRISE_BALANCE.enterprisesRequired))
            return `Needs reliability ${ENTERPRISE_BALANCE.strategicReliability} and ${ENTERPRISE_BALANCE.enterprisesRequired} enterprise customers.`;
    }
    return null;
}
function ruleSlots(focus: 'pilot' | 'enterprise' | 'strategic') {
    return ENTERPRISE_BALANCE.focuses[focus].slots;
}
/** Integer mixing: independent sales/service channels, stable across reload and platforms. */
export function enterpriseRandom(seed: number, month: number, channel: 'sales' | 'service') {
    let x = (seed ^ Math.imul(month, 0x9e3779b1) ^ (channel === 'sales' ? 0x85ebca6b : 0xc2b2ae35)) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
export function settleEnterprise(s: Company): {
    enterprise: Enterprise;
    settlement: Settlement;
} {
    const g = s.gamble;
    if (!g)
        throw Error('No enterprise decision.');
    const e = g.enterprise;
    const month = s.month + 1;
    const block = focusBlock(s, e.focus);
    if (block)
        throw Error(block);
    if (month <= ENTERPRISE_BALANCE.standardMonth || month > ENTERPRISE_BALANCE.finalMonth || e.ledger.some(x => x.month === month))
        throw Error('This month cannot settle twice.');
    let next: Enterprise = { ...e, contracts: [...e.contracts], ledger: [...e.ledger] };
    const focus = e.focus;
    let won = false;
    const rule = ENTERPRISE_BALANCE.focuses[focus];
    let message = 'Your team delivers. No new empire was promised at this meeting.';
    if (focus === 'capacity') {
        next.purchasedSlots += Math.min(ENTERPRISE_BALANCE.addedCapacity, ENTERPRISE_BALANCE.maxCapacity - capacity(e, s.labs));
        message = `More racks, more runway to burn. ${next.purchasedSlots-e.purchasedSlots} new delivery lanes are ready.`;
    }
    if (focus === 'reliability') {
        next.reliability++;
        message = 'The on-call team finally slept. Customers—and your valuation multiple—noticed.';
    }
    if (focus === 'pilot' || focus === 'enterprise' || focus === 'strategic') {
        won = enterpriseRandom(s.seed, month, 'sales') < ENTERPRISE_BALANCE.focuses[focus].chance;
        if (won)
            next.contracts.push({ kind: focus, month });
        message = won ? 'SIGNED. Procurement found the budget. Now comes the part where you actually deliver.' : 'The customer loved the deck. Legal loved the delay. The bid budget is spent; no contract this month.';
    }
    const incident = enterpriseRandom(s.seed, month, 'service') < ENTERPRISE_BALANCE.incidentChance[next.reliability - 1];
    if (incident) {
        next.discountThrough = month + ENTERPRISE_BALANCE.discountFollowingMonths;
        message += ' A service outage cut this month’s billing by 20%; the new-business premium is discounted this month and next.';
    }
    const figures = operatingFigures(next, s.labs, incident);
    const settlement = { month, focus, investment: rule.cost, won, incident, ...figures, message };
    next = { ...next, focus: 'operate', ledger: [...next.ledger, settlement] };
    return { enterprise: next, settlement };
}
export function freezeStandard(s: Company, value: number): Gamble {
    if (s.gamble || s.month !== ENTERPRISE_BALANCE.standardMonth || s.cash < 0 || s.endingChoice === 'fraud' || !Number.isFinite(value) || value < ENTERPRISE_BALANCE.target)
        throw Error('This run cannot choose an extension.');
    return { version: 1, decision: 'pending', standardResult: { month: 30, valuation: value, peak: Math.round(Math.max(value, ...(s.reports || []).filter(r => r.month <= 30).map(r => r.valuation))), success: true, ending: value >= 150000000 && s.labs * 420000 * 12 >= 12000000 && s.labs * 270000 > 0 ? 'ipo' : 'acquisition' }, enterprise: freshEnterprise() };
}
export function decideGamble<T extends Company>(s: T, decision: 'exit' | 'extend'): T {
    if (s.gamble?.decision !== 'pending' || s.month !== ENTERPRISE_BALANCE.standardMonth)
        throw Error('This decision has already been made.');
    return { ...s, ended: decision === 'exit', gamble: { ...s.gamble, decision } };
}
export function recordMilestones<T extends Company>(s: T, value: number, reason?: ExtensionOutcome['reason']): T {
    const g = s.gamble;
    if (g?.decision !== 'extend')
        return s;
    let next = { ...g };
    if (s.month > ENTERPRISE_BALANCE.standardMonth && s.month <= ENTERPRISE_BALANCE.finalMonth && s.cash >= 0 && s.endingChoice !== 'fraud' && value >= ENTERPRISE_BALANCE.unicorn && !next.unicornMonth)
        next.unicornMonth = s.month;
    if (reason && !g.extensionOutcome)
        next.extensionOutcome = { month: s.month, valuation: value, reason, unicorn: !!next.unicornMonth, mogabr: reason === 'completed' && s.month === ENTERPRISE_BALANCE.finalMonth && s.cash >= 0 && s.endingChoice !== 'fraud' && value >= ENTERPRISE_BALANCE.mogabr && s.labs * 270000 > 0 };
    return { ...s, gamble: next };
}
/** Fail closed for unrecognized post-30 snapshots. Never observe extended report peaks. */
export function standardRankingValue(raw: unknown, current: number): number | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const s = raw as Company;
    if (!Number.isInteger(s.month) || s.month < 1 || s.month > ENTERPRISE_BALANCE.finalMonth || (s.reports !== undefined && !Array.isArray(s.reports)))
        return null;
    const g = s.gamble;
    if (g !== undefined) {
        if (!g || typeof g !== 'object')
            return null;
        const r = g.standardResult;
        if (g.version !== 1 || !['pending', 'exit', 'extend'].includes(g.decision) || (g.decision !== 'extend' && s.month !== ENTERPRISE_BALANCE.standardMonth) || !r || r.month !== 30 || r.success !== true || !Number.isFinite(r.valuation) || r.valuation < 100000000 || !Number.isSafeInteger(r.peak) || r.peak < Math.round(r.valuation) || r.peak > 1e12 || s.month < 30 || s.month > 42)
            return null;
        return r.peak;
    }
    if (s.month > 30 || (s.reports || []).some(r => r.month > 30))
        return null;
    const value = Math.round(Math.max(current, ...(s.reports || []).map(r => r.valuation)));
    return Number.isSafeInteger(value) && value >= 0 && value <= 1e12 ? value : null;
}
/** Highest eligible valuation in the current run, including the extension. */
export function personalBestValue(raw: unknown, current: number): number | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const s = raw as Company;
    if (!Number.isInteger(s.month) || s.month < 1 || s.month > ENTERPRISE_BALANCE.finalMonth || !Number.isFinite(current) || current < 0 || (s.reports !== undefined && !Array.isArray(s.reports)))
        return null;

    // Reuse standard-score validation for legacy and extension snapshots.
    const standard = standardRankingValue(s, current);
    if (standard === null)
        return null;

    const values = [standard, current];
    for (const report of s.reports || []) {
        if (!report || !Number.isInteger(report.month) || report.month < 1 || report.month > s.month || !Number.isFinite(report.valuation) || report.valuation < 0)
            return null;
        values.push(report.valuation);
    }

    if (s.gamble?.decision === 'extend' && s.gamble.extensionOutcome) {
        const outcome = s.gamble.extensionOutcome;
        if (!Number.isInteger(outcome.month) || outcome.month < 31 || outcome.month > 42 || outcome.month > s.month || !Number.isFinite(outcome.valuation) || outcome.valuation < 0)
            return null;
        values.push(outcome.valuation);
    }

    const best = Math.round(Math.max(...values));
    return Number.isSafeInteger(best) && best <= 1e12 ? best : null;
}

export function losingStory(value: number, month: number) {
    if (value < 25000000)
        return { title: 'THE INVESTORS WANT THEIR MONEY BACK.', body: "The good news? You disrupted an industry. The bad news? It was your own balance sheet. Your CFO has stopped answering calls, and the board has discovered the phrase 'fiduciary responsibility.'" };
    if (value < 50000000)
        return { title: month === 30 ? 'THIRTY MONTHS. COUNTLESS MEETINGS.' : `${month} MONTHS. COUNTLESS MEETINGS.`, body: "You started with a $25M valuation and managed to build something worth a little more. The investors would like to know what you've been doing. You've scheduled a meeting to discuss scheduling that meeting." };
    if (value < 90000000)
        return { title: 'CONGRATS. YOU FAILED UPWARD.', body: "You built a company worth millions. Just not the $100M exit you promised. The board calls it a learning experience. Your LinkedIn profile already says 'Serial Entrepreneur.' Somehow, you're still getting invited to speak at conferences." };
    return { title: 'SO CLOSE. THE BOARD IS FURIOUS.', body: month === 30 ? "You were one good quarter away from $100M. Unfortunately, you ran out of quarters. Investors are calling it a temporary setback. Your therapist is calling it job security." : `You finished Month ${month} just short of $100M. Investors are calling it a temporary setback. Your therapist is calling it job security.` };
}
