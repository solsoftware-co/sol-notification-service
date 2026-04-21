import { sendFormNotification } from "./form-notification";
import { weeklyAnalyticsScheduler } from "./weekly-analytics-scheduler";
import { monthlyAnalyticsScheduler } from "./monthly-analytics-scheduler";
import { sendAnalyticsReport } from "./analytics-report";

export { sendFormNotification, weeklyAnalyticsScheduler, monthlyAnalyticsScheduler, sendAnalyticsReport };
export const functions = [sendFormNotification, weeklyAnalyticsScheduler, monthlyAnalyticsScheduler, sendAnalyticsReport];
