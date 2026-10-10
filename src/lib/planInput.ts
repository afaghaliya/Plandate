import type { Plan } from "@prisma/client";
import { parseNumberList, parseStringList } from "@/lib/json";
import type { PlanInput } from "@/lib/ai/catalog";
import type { BudgetTier, GroupType } from "@/lib/domain";

/** Rehydrates the planner input from a stored Plan row. */
export function planInputFromRow(plan: Plan): PlanInput {
  return {
    location: plan.location,
    point: plan.lat !== null && plan.lng !== null ? { lat: plan.lat, lng: plan.lng } : null,
    startTime: plan.startTime,
    endTime: plan.endTime,
    durationMinutes: plan.durationMinutes,
    groupType: plan.groupType as GroupType,
    adults: plan.adults,
    children: plan.children,
    childAges: parseNumberList(plan.childAges),
    budgetTier: plan.budgetTier as BudgetTier,
    budgetPerPerson: plan.budgetPerPerson,
    interests: parseStringList(plan.interests),
    surpriseMe: plan.surpriseMe,
    radiusKm: plan.radiusKm,
    notes: plan.notes,
  };
}
