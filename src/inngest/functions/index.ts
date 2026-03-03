import { helloWorld } from "./hello-world";
import { sendFormNotification } from "./form-notification";
import { weeklyAnalyticsScheduler } from "./weekly-analytics-scheduler";
import { sendWeeklyAnalyticsReport } from "./weekly-analytics-report";

export { helloWorld, sendFormNotification, weeklyAnalyticsScheduler, sendWeeklyAnalyticsReport };
export const functions = [helloWorld, sendFormNotification, weeklyAnalyticsScheduler, sendWeeklyAnalyticsReport];
