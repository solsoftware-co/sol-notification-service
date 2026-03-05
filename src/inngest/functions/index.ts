import { helloWorld } from "./hello-world";
import { sendFormNotification } from "./form-notification";
import { weeklyAnalyticsScheduler } from "./weekly-analytics-scheduler";
import { sendAnalyticsReport } from "./analytics-report";

export { helloWorld, sendFormNotification, weeklyAnalyticsScheduler, sendAnalyticsReport };
export const functions = [helloWorld, sendFormNotification, weeklyAnalyticsScheduler, sendAnalyticsReport];
